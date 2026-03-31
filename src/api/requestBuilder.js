/**
 * requestBuilder.js
 * Цей файл відповідає за мапінг даних з компонентів у "чистий" JSON
 * з ключами у форматі snake_case, який очікуватиметься на бекенді.
 */

// Допоміжна функція: перетворення пустих значень на null
const parseValue = (val) => {
  if (val === undefined || val === null || val === '') {
    return null;
  }
  return val;
};

export const requestBuilder = {
  /**
   * Побудова корисного навантаження (payload) для нового замовлення
   */
  buildOrderPayload: (orderHeader, items) => {
    return {
      order_date: parseValue(orderHeader.orderDate),
      order_num: parseValue(orderHeader.orderNum),
      customer: parseValue(orderHeader.customer),
      official_customer: parseValue(orderHeader.official_customer),
      nomenclature_id: parseValue(orderHeader.nomenclature_id),
      unit: parseValue(orderHeader.unit),
      quantity: parseValue(orderHeader.quantity) ? Number(orderHeader.quantity) : null,
      entered_by: parseValue(orderHeader.entered_by),
      responsible_person: parseValue(orderHeader.responsible_person),
      deadline: parseValue(orderHeader.deadline),
      actual_date: parseValue(orderHeader.actual_date),
      source: parseValue(orderHeader.source),
      report: parseValue(orderHeader.report),
      accessories: parseValue(orderHeader.accessories),
      // Тут можна додати логіку для items, якщо на бекенді вони теж потрібні в певному форматі
      items: items ? items.map(item => ({
        nomenclature_id: parseValue(item.nomenclature_id),
        quantity: parseValue(item.quantity) ? Number(item.quantity) : null
      })) : []
    };
  },

  /**
   * Побудова payload для створення або оновлення номенклатури (продукту, деталі, сировини)
   */
  buildNomenclaturePayload: (nomData) => {
    return {
      id: parseValue(nomData.id), // присутнє, якщо це редагування
      name: parseValue(nomData.name),
      type: parseValue(nomData.type),
      material_type: parseValue(nomData.material_type),
      cnc_program: parseValue(nomData.cnc_program),
      units_per_sheet: parseValue(nomData.units_per_sheet) ? Number(nomData.units_per_sheet) : null,
      time_per_unit: parseValue(nomData.time_per_unit) ? Number(nomData.time_per_unit) : null
    };
  },

  /**
   * Побудова payload для збереження складу виробу (BOM - Bill of Materials)
   */
  buildBOMPayload: (parentId, draftBOM) => {
    return {
      parent_id: parseValue(parentId),
      bom_items: draftBOM ? draftBOM.map(item => ({
        child_id: parseValue(item.child_id),
        quantity_per_parent: parseValue(item.qty) ? Number(item.qty) : null
      })) : []
    };
  },

  /**
   * Побудова payload для створення нової позиції на складі (Inventory)
   */
  buildInventoryPayload: (itemData) => {
    return {
      name: parseValue(itemData.name),
      unit: parseValue(itemData.unit),
      total_qty: parseValue(itemData.total_qty) ? Number(itemData.total_qty) : null,
      type: parseValue(itemData.type)
    };
  },

  /**
   * Побудова payload для запиту на закупівлю сировини/матеріалів (Purchase Request)
   */
  buildPurchaseRequestPayload: (orderId, orderNum, items) => {
    return {
      order_id: parseValue(orderId),
      order_num: parseValue(orderNum),
      request_items: items ? items.map(it => ({
        inventory_id: parseValue(it.inventory_id),
        nomenclature_id: parseValue(it.nomenclature_id),
        details: parseValue(it.reqDetails),
        missing_amount: parseValue(it.missingAmount) ? Number(it.missingAmount) : null,
        needed_amount: parseValue(it.needed) ? Number(it.needed) : null
      })) : []
    };
  },

  /**
   * Побудова payload для підтвердження прийомки зі складу постачання
   */
  buildConfirmReceptionPayload: (docId) => {
    return {
      document_id: parseValue(docId),
      confirmed_at: new Date().toISOString()
    };
  },

  /**
   * Побудова payload для списання матеріалів під конкретну потребу (Issue Materials)
   */
  buildIssueMaterialsPayload: (reqId) => {
    return {
      demand_request_id: parseValue(reqId),
      issued_at: new Date().toISOString()
    };
  },

  /**
   * Побудова payload для підтвердження виконання складського завдання (Approve Warehouse Task)
   */
  buildApproveWarehouseTaskPayload: (taskId) => {
    return {
      task_id: parseValue(taskId),
      approved_at: new Date().toISOString()
    };
  },

  /**
   * Створення нового документу прийомки (Reception Doc) для постачання
   */
  buildCreateReceptionDocPayload: (items) => {
    return {
      created_at: new Date().toISOString(),
      status: 'pending',
      items: items ? items.map(item => ({
        nomenclature_id: parseValue(item.nomenclature_id),
        quantity: parseValue(item.qty) ? Number(item.qty) : null
      })) : []
    };
  },

  /**
   * Конвертація запиту від складу у замовлення постачальникові
   */
  buildConvertRequestToOrderPayload: (requestId) => {
    return {
      request_id: parseValue(requestId),
      converted_at: new Date().toISOString()
    };
  },

  /**
   * Відправка сформованого документу на склад (Send Doc to Warehouse)
   */
  buildSendDocToWarehousePayload: (docId) => {
    return {
      document_id: parseValue(docId),
      sent_at: new Date().toISOString()
    };
  },

  /**
   * Побудова payload для створення виробничого завдання (наряду)
   */
  buildCreateTaskPayload: (orderId, machineName) => {
    return {
      order_id: parseValue(orderId),
      machine_name: parseValue(machineName),
      created_at: new Date().toISOString(),
      status: 'pending',
      step: 'Очікує підтвердження'
    };
  },

  /**
   * Побудова payload для створення робочої картки (Work Card) на конкретну операцію
   */
  buildCreateWorkCardPayload: (taskId, orderId, operation, machine, estimatedTime) => {
    return {
      task_id: parseValue(taskId),
      order_id: parseValue(orderId),
      operation: parseValue(operation),
      machine: parseValue(machine),
      estimated_time: parseValue(estimatedTime) ? Number(estimatedTime) : null,
      status: 'pending',
      created_at: new Date().toISOString()
    };
  },

  /**
   * Побудова payload для фінального закриття наряду майстром
   */
  buildCompleteTaskByMasterPayload: (taskId) => {
    return {
      task_id: parseValue(taskId),
      completed_at: new Date().toISOString(),
      status: 'completed'
    };
  },

  /**
   * Побудова payload для підтвердження інженером (технологом)
   */
  buildApproveEngineerPayload: (taskId) => {
    return {
      task_id: parseValue(taskId),
      approved_at: new Date().toISOString(),
      engineer_conf: true
    };
  },

  /**
   * Побудова payload для дій оператора
   */
  buildOperatorActionPayload: (action, taskId, cardId, operatorName, extra = {}) => {
    return {
      action: parseValue(action), // 'start', 'complete', 'scrap'
      task_id: parseValue(taskId),
      card_id: parseValue(cardId),
      operator_name: parseValue(operatorName),
      timestamp: new Date().toISOString(),
      ...extra
    };
  },

  /**
   * Побудова payload для керування обладнанням
   */
  buildMachinePayload: (machineData) => {
    return {
      name: parseValue(machineData.name),
      type: parseValue(machineData.type),
      status: parseValue(machineData.status) || 'active',
      sheet_capacity: parseValue(machineData.sheet_capacity) ? Number(machineData.sheet_capacity) : null
    };
  },

  /**
   * Побудова payload для відвантаження замовлення
   */
  buildShipOrderPayload: (orderId) => {
    return {
      order_id: parseValue(orderId),
      shipped_at: new Date().toISOString(),
      status: 'shipped'
    };
  },

  /**
   * Побудова payload для видалення сутності (номенклатурa, станок тощо)
   */
  buildDeletePayload: (id, entityType) => {
    return {
      id: parseValue(id),
      entity_type: parseValue(entityType),
      deleted_at: new Date().toISOString()
    };
  },

  /**
   * Побудова payload для ручного коригування залишків (прийом інвентарю)
   */
  buildReceiveInventoryPayload: (itemId, quantity) => {
    return {
      inventory_id: parseValue(itemId),
      quantity: parseValue(quantity) ? Number(quantity) : null,
      received_at: new Date().toISOString()
    };
  },

  /**
   * Побудова пакетного (Batch) JSON для бронювання всього наряду
   */
  buildReserveBatchPayload: (orderId, requests, taskId) => {
    return {
      order_id: parseValue(orderId),
      task_id: parseValue(taskId),
      items: requests.map(r => ({
        request_id: parseValue(r.id),
        inventory_id: parseValue(r.inventory_id),
        quantity: parseValue(r.quantity)
      })),
      action: 'RESERVE_RESOURCES',
      timestamp: new Date().toISOString()
    };
  },

  /**
   * Пакетна генерація робочих карток
   */
  buildWorkCardBatchPayload: (taskId, orderId, cards) => {
    return {
      task_id: parseValue(taskId),
      order_id: parseValue(orderId),
      cards: cards.map(c => ({
        operation: parseValue(c.operation),
        machine: parseValue(c.machine),
        estimated_time: parseValue(c.estimatedTime),
        card_info: parseValue(c.cardInfo)
      })),
      action: 'CREATE_WORK_CARDS_BATCH',
      timestamp: new Date().toISOString()
    };
  }
};
