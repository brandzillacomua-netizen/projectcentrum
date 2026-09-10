export async function deleteInventoryItem(client, inventoryId) {
  const { data: requests, count, error: dependencyError } = await client
    .from('material_requests')
    .select('id,status,details,created_at', { count: 'exact' })
    .eq('inventory_id', inventoryId)
    .order('created_at', { ascending: false })
    .limit(5)
  if (dependencyError) {
    throw new Error('Не вдалося перевірити пов’язані заявки. Позицію не видалено. Спробуйте ще раз.')
  }
  if (count > 0) {
    const statusNames = { pending: 'очікує', issued: 'видано / зарезервовано', completed: 'завершено', cancelled: 'скасовано', canceled: 'скасовано' }
    const examples = (requests || []).map(request => {
      const status = statusNames[request.status] || request.status || 'статус не вказано'
      const date = request.created_at ? String(request.created_at).slice(0, 10) : 'дата не вказана'
      const details = String(request.details || '').replace(/\s+/g, ' ').slice(0, 180)
      return `• ${status}, ${date}\n  ${details || 'Без опису'}\n  ID заявки: ${request.id}`
    }).join('\n')
    const remaining = count > (requests || []).length ? `\nУсього пов’язаних заявок: ${count}.` : ''
    throw new Error(`Позицію не видалено: на неї посилаються заявки на матеріали (${count}). Блок «Заявки на комплектацію» показує не всі записи: скасовані, завершені та частина виданих заявок у ньому приховані. Перевірка виконана за ID складського запису, а не за назвою номенклатури.\n\n${examples}${remaining}\n\nІсторію заявок збережено.`)
  }

  const { data, error } = await client.from('inventory').delete().eq('id', inventoryId).select('id')
  if (error?.code === '23503') {
    // The database remains authoritative if a reference appeared after the check,
    // is hidden by RLS, or belongs to another table.
    throw new Error('Позицію не видалено: вона пов’язана із заявками або іншими складськими документами. Спочатку потрібно перевірити ці зв’язки; історію обліку збережено.')
  }
  if (error) throw error
  if (!data?.length) {
    throw new Error('Позицію не видалено: запис уже відсутній або немає прав на його видалення. Оновіть склад і перевірте доступ.')
  }
}
