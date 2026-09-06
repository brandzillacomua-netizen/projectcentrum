import { supabase } from '../supabase.js';

export const ARCHIVE_PAGE_SIZE = 50;

/**
 * Розраховує діапазон рядків PostgreSQL для пагінації (0-indexed).
 */
export function calculatePaginationRange(page = 0, pageSize = ARCHIVE_PAGE_SIZE) {
  const parsedPage = parseInt(page, 10);
  const safePage = Number.isFinite(parsedPage) && parsedPage >= 0 ? parsedPage : 0;
  
  const parsedPageSize = parseInt(pageSize, 10);
  const safePageSize = Number.isFinite(parsedPageSize) && parsedPageSize > 0 ? parsedPageSize : ARCHIVE_PAGE_SIZE;
  
  const from = safePage * safePageSize;
  const to = from + safePageSize - 1;
  return { from, to, safePage, safePageSize };
}

/**
 * Завантажує пагінований архів нарядів із серверною фільтрацією за статусом та наскрізним пошуком.
 * Не завантажує всю базу даних у пам'ять браузера.
 * 
 * @param {Object} options
 * @param {number} [options.page=0] - номер сторінки (0-indexed)
 * @param {number} [options.pageSize=50] - розмір сторінки
 * @param {string} [options.status='all'] - фільтр статусу ('all', 'completed', 'in-progress', 'pending', 'paused')
 * @param {string} [options.search=''] - пошуковий рядок (номер замовлення, клієнт, крок виробництва)
 * @param {Array} [options.knownOrders=[]] - вже завантажені замовлення для уникнення повторних запитів
 * @returns {Promise<{ tasks: Array, totalCount: number, page: number, pageSize: number, totalPages: number, error: any }>}
 */
export async function fetchArchiveTasksPaged({
  page = 0,
  pageSize = ARCHIVE_PAGE_SIZE,
  status = 'all',
  search = '',
  knownOrders = []
} = {}) {
  const { from, to, safePage, safePageSize } = calculatePaginationRange(page, pageSize);
  const trimmedSearch = (search || '').trim();

  // 1. Якщо задано пошуковий запит — шукаємо збіги за номером замовлення та клієнтом
  let matchedOrderIds = [];
  if (trimmedSearch) {
    try {
      const { data: matchedOrders } = await supabase
        .from('orders')
        .select('id')
        .or(`order_num.ilike.%${trimmedSearch}%,customer.ilike.%${trimmedSearch}%`)
        .limit(100);

      matchedOrderIds = (matchedOrders || []).map(o => o.id).filter(Boolean);
    } catch (err) {
      console.warn('[ArchiveService] Order search lookup failed, falling back to task search:', err);
    }
  }

  // 2. Формуємо основний запит до таблиці tasks
  let query = supabase
    .from('tasks')
    .select('id, order_id, step, status, planned_sets, batch_index, created_at, completed_at, plan_snapshot', { count: 'exact' });

  // 3. Фільтр за статусом
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  // 4. Застосування пошуку
  if (trimmedSearch) {
    if (matchedOrderIds.length > 0) {
      const orderIdList = matchedOrderIds.join(',');
      query = query.or(`step.ilike.%${trimmedSearch}%,order_id.in.(${orderIdList})`);
    } else {
      query = query.ilike('step', `%${trimmedSearch}%`);
    }
  }

  // 5. Сортування та діапазон сторінки
  query = query
    .order('created_at', { ascending: false })
    .range(from, to);

  const { data: rawTasks, count, error } = await query;

  if (error) {
    console.error('[ArchiveService] Failed to fetch archive tasks:', error);
    return {
      tasks: [],
      totalCount: 0,
      page: safePage,
      pageSize: safePageSize,
      totalPages: 0,
      error
    };
  }

  const taskList = rawTasks || [];
  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / safePageSize);

  // 6. Точкове завантаження замовлень тільки для поточних рядків (якщо немає в кеші)
  const knownOrdersMap = new Map((knownOrders || []).map(o => [String(o.id), o]));
  const missingOrderIds = [...new Set(
    taskList
      .map(t => t.order_id)
      .filter(id => id && !knownOrdersMap.has(String(id)))
  )];

  const fetchedOrdersMap = new Map();
  if (missingOrderIds.length > 0) {
    try {
      const chunks = [];
      for (let i = 0; i < missingOrderIds.length; i += 50) {
        chunks.push(missingOrderIds.slice(i, i + 50));
      }
      const results = await Promise.all(
        chunks.map(chunk => supabase.from('orders').select('id, order_num, customer').in('id', chunk))
      );
      results.forEach(res => {
        (res.data || []).forEach(o => fetchedOrdersMap.set(String(o.id), o));
      });
    } catch (orderFetchErr) {
      console.warn('[ArchiveService] Failed to load supplemental orders:', orderFetchErr);
    }
  }

  // 7. Збагачуємо завдання даними про замовлення
  const enrichedTasks = taskList.map(task => {
    const order = knownOrdersMap.get(String(task.order_id)) 
      || fetchedOrdersMap.get(String(task.order_id)) 
      || null;

    return {
      ...task,
      _order: order
    };
  });

  return {
    tasks: enrichedTasks,
    totalCount,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
    error: null
  };
}
