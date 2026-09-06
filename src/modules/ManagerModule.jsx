import React, { useState, useEffect, useRef, useMemo } from 'react'
import { LayoutDashboard, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'
import { supabase } from '../supabase'

import { ProductSearchSelect } from './Manager/components/ProductSearchSelect'
import { CreateProductModal } from './Manager/components/CreateProductModal'
import { BatchScheduleModal } from './Manager/components/BatchScheduleModal'
import { OrderDetailsModal } from './Manager/components/OrderDetailsModal'
import { OrderForm } from './Manager/components/OrderForm'
import { OrdersTable } from './Manager/components/OrdersTable'
import './Manager/ManagerStyles.css'

const ManagerModule = () => {
  const {
    nomenclatures,
    addOrder,
    updateOrder,
    deleteOrder,
    superDeleteOrder,
    orders,
    fetchOrders,
    hasMoreOrders,
    searchCustomers,
    currentUser,
    loading,
    getOrderProductionProgress,
    refreshTable
  } = useMES()

  const [v2Nomenclatures, setV2Nomenclatures] = useState([])

  const fetchV2Nomenclatures = async () => {
    try {
      const { data, error } = await supabase.from('nomenclatures_v2').select('*').order('name')
      if (!error && data) {
        setV2Nomenclatures(data)
      }
    } catch (e) {
      console.warn('Failed to fetch nomenclatures_v2 in ManagerModule:', e)
    }
  }

  useEffect(() => {
    fetchV2Nomenclatures()
  }, [])

  const allNomenclaturesList = useMemo(() => {
    const map = new Map()

    ;(v2Nomenclatures || []).forEach(v => {
      const isProd = (v.group_id === 'grp_production_frames' || v.group_id === 'grp_test_samples' || v.group_id === 'cat_fg' || v.rule_type === 'full_frame' || v.rule_type === 'element_kit' || (v.name || '').toLowerCase().includes('рама') || (v.name || '').toLowerCase().includes('комплект'))
      map.set(String(v.id), {
        id: v.id,
        name: v.name,
        code: v.code || '',
        type: isProd ? 'product' : (v.rule_type === 'frame_part' ? 'part' : 'consumable'),
        group_id: v.group_id,
        rule_type: v.rule_type,
        unit: v.unit || 'шт'
      })
    })

    ;(nomenclatures || []).forEach(n => {
      if (!map.has(String(n.id))) {
        map.set(String(n.id), {
          ...n,
          id: n.id,
          name: n.name,
          code: n.code || '',
          type: n.type || 'product',
          unit: n.unit || 'шт'
        })
      }
    })

    return Array.from(map.values())
  }, [v2Nomenclatures, nomenclatures])

  const v2FinishedProductsOnly = useMemo(() => {
    return (v2Nomenclatures || []).filter(v => {
      if (!v) return false

      const groupId = String(v.group_id || '').toLowerCase()
      const ruleType = String(v.rule_type || '').toLowerCase()
      const typeLower = String(v.type || '').toLowerCase()

      // STRICT ALLOWLIST for Finished Products ("04. Готова продукція"):
      const isFinishedGroup = groupId === 'cat_fg' ||
                              groupId === 'grp_production_frames' ||
                              groupId === 'grp_test_samples' ||
                              groupId.startsWith('fg.') ||
                              groupId.startsWith('cat_fg')
                              
      const isFinishedRule = ruleType === 'full_frame' ||
                             ruleType === 'element_kit'
                             
      const isFinishedType = typeLower === 'product' ||
                             typeLower === 'fg' ||
                             typeLower === 'finished'

      // If explicitly finished group/rule/type
      if (isFinishedGroup || isFinishedRule || isFinishedType) {
        return true
      }

      // STRICT DENYLIST for raw materials, hardware, parts, chemicals, tools
      const isNonFinishedGroup = groupId.startsWith('cat_raw') ||
                                 groupId.startsWith('raw.') ||
                                 groupId.startsWith('cat_hw') ||
                                 groupId.startsWith('hw.') ||
                                 groupId.startsWith('cat_parts') ||
                                 groupId.startsWith('parts.') ||
                                 ['grp_carbon_sheets', 'grp_rubber', 'grp_paint', 'grp_mills', 'grp_screws_black', 'grp_screws_silver', 'grp_nuts', 'grp_press_nuts', 'grp_standoffs'].includes(groupId)

      if (isNonFinishedGroup) return false

      const isNonFinishedRule = ['carbon', 'rubber', 'paint', 'mill', 'screw', 'screw_black', 'screw_silver', 'nut', 'press_nut', 'standoff', 'frame_part'].includes(ruleType)

      if (isNonFinishedRule) return false

      // Keyword exclusion for solvents, hardeners, paints, screws, nuts, etc.
      const nameLower = (v.name || '').toLowerCase()
      const isChemicalOrTool = nameLower.includes('затверджувач') ||
                               nameLower.includes('розчинник') ||
                               nameLower.includes('фарба') ||
                               nameLower.includes('лак') ||
                               nameLower.includes('фреза') ||
                               nameLower.includes('гвинт') ||
                               nameLower.includes('гайка') ||
                               nameLower.includes('стійка') ||
                               nameLower.includes('пластина') ||
                               nameLower.includes('гума')

      if (isChemicalOrTool) return false

      // Fallback only for frames/kits
      return nameLower.includes('рама') || nameLower.includes('комплект')
    }).map(v => ({
      id: v.id,
      name: v.name,
      code: v.code || '',
      type: 'product',
      group_id: v.group_id,
      rule_type: v.rule_type,
      unit: v.unit || 'шт'
    }))
  }, [v2Nomenclatures])

  const [localCustomers, setLocalCustomers] = useState([])
  const searchTimeout = useRef(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Product Creation Modal State
  const [isCreateProductOpen, setIsCreateProductOpen] = useState(false)
  const [createProductQuery, setCreateProductQuery] = useState('')
  const [targetProductField, setTargetProductField] = useState('registration')

  // Batch Schedule Modal State
  const [isBatchScheduleOpen, setIsBatchScheduleOpen] = useState(false)
  const [batchScheduleList, setBatchScheduleList] = useState([])
  const [isSavingSchedule, setIsSavingSchedule] = useState(false)

  // Filtering & Pagination State
  const [dateFilter, setDateFilter] = useState('month')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(0)

  const [selectedOrder, setSelectedOrder] = useState(null)
  const [showCustomerHints, setShowCustomerHints] = useState(false)

  // Edit Mode state
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingOrderHeader, setEditingOrderHeader] = useState({
    customer: '',
    official_customer: '',
    invoice_num: '',
    nomenclature_id: '',
    quantity: 1,
    deadline: ''
  })

  const handleBatchScheduleInit = (order) => {
    let existing = []
    try {
      const parsed = typeof order.report === 'string' ? JSON.parse(order.report) : (order.report || {})
      existing = Array.isArray(parsed.batch_schedule) ? parsed.batch_schedule : []
    } catch (e) {}

    if (existing.length === 0) {
      existing = [
        { batch_num: 1, quantity: order.quantity || 0, deadline: order.deadline || '' }
      ]
    }
    setBatchScheduleList(existing)
    setIsBatchScheduleOpen(true)
  }

  const handleAddBatchItem = () => {
    setBatchScheduleList(prev => [
      ...prev,
      { batch_num: prev.length + 1, quantity: 0, deadline: selectedOrder?.deadline || '' }
    ])
  }

  const handleRemoveBatchItem = (index) => {
    setBatchScheduleList(prev => prev.filter((_, i) => i !== index).map((b, idx) => ({ ...b, batch_num: idx + 1 })))
  }

  const handleUpdateBatchItem = (index, field, value) => {
    setBatchScheduleList(prev => prev.map((b, i) => i === index ? { ...b, [field]: value } : b))
  }

  const handleSaveBatchSchedule = async () => {
    if (!selectedOrder) return
    setIsSavingSchedule(true)
    try {
      let currentReport = {}
      try {
        currentReport = typeof selectedOrder.report === 'string' ? JSON.parse(selectedOrder.report) : (selectedOrder.report || {})
      } catch (e) {}

      const updatedReport = {
        ...currentReport,
        batch_schedule: batchScheduleList.map((b, idx) => ({
          batch_num: idx + 1,
          quantity: Number(b.quantity) || 0,
          deadline: b.deadline || ''
        }))
      }

      const { error } = await supabase
        .from('orders')
        .update({ report: JSON.stringify(updatedReport) })
        .eq('id', selectedOrder.id)

      if (error) throw error

      alert('Календар партій успішно збережено!')
      setIsBatchScheduleOpen(false)
      fetchOrders(currentPage, false, { searchQuery, dateRange: dateFilter })
    } catch (err) {
      alert('Помилка збереження календаря партій: ' + err.message)
    } finally {
      setIsSavingSchedule(false)
    }
  }

  const generateNextOrderNum = () => {
    const today = new Date()
    const yy = String(today.getFullYear()).slice(-2)
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    const datePrefix = `${yy}${mm}${dd}`

    const yyyy = today.getFullYear()
    const legacyPrefixFull = `${dd}${mm}${yyyy}`
    const legacyPrefixShort = `${dd}${mm}${yy}`

    const todayOrders = (orders || []).filter(o => {
      const num = o.order_num || ''
      const cleanNum = num.replace(/^№/, '')
      return (
        cleanNum.startsWith(datePrefix) ||
        cleanNum.startsWith(legacyPrefixFull) ||
        cleanNum.startsWith(legacyPrefixShort)
      )
    })

    let maxSeq = 0
    todayOrders.forEach(o => {
      const num = o.order_num || ''
      const cleanNum = num.replace(/^№/, '')
      const parts = cleanNum.split('-')
      if (parts.length >= 2) {
        const seq = parseInt(parts[parts.length - 1], 10)
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq
        }
      }
    })

    const nextSeq = maxSeq + 1
    return `${datePrefix}-${nextSeq}`
  }

  const [orderHeader, setOrderHeader] = useState({
    orderDate: new Date().toISOString().split('T')[0],
    orderNum: '',
    invoiceNum: '',
    customer: '',
    official_customer: '',
    nomenclature_id: '',
    unit: 'шт',
    quantity: 1,
    deadline: '',
    source: 'Виробництво'
  })

  useEffect(() => {
    setOrderHeader(prev => {
      if (!prev.orderNum) {
        return { ...prev, orderNum: generateNextOrderNum() }
      }
      return prev
    })
  }, [orders])

  const clientOrders = (orders || []).filter(o => {
    const num = o.order_num || ''
    return !num.startsWith('ВБ') && !num.startsWith('VB') && num !== '14082026-01' && num !== '10082026-01' && num !== '260821-1'
  })

  const handleEditInit = (order) => {
    setSelectedOrder(order)
    setIsEditMode(true)
    setEditingOrderHeader({
      customer: order.customer || '',
      official_customer: order.official_customer || '',
      invoice_num: order.invoice_num || '',
      nomenclature_id: order.nomenclature_id || '',
      quantity: order.quantity || 1,
      deadline: order.deadline ? order.deadline.split('T')[0] : ''
    })
  }

  const handleUpdateSubmit = async (e) => {
    e.preventDefault()
    if (!editingOrderHeader.customer || !editingOrderHeader.nomenclature_id || !editingOrderHeader.deadline) {
      alert('Будь ласка, заповніть Замовника, оберіть Продукт та вкажіть Термін (Дедлайн)')
      return
    }

    setIsSubmitting(true)
    try {
      const selectedProduct = nomenclatures.find(p => String(p.id) === String(editingOrderHeader.nomenclature_id))
      const headerWithInfo = {
        customer: editingOrderHeader.customer,
        official_customer: editingOrderHeader.official_customer,
        invoice_num: editingOrderHeader.invoice_num,
        deadline: editingOrderHeader.deadline,
        quantity: editingOrderHeader.quantity,
        productName: selectedProduct?.name || ''
      }
      const items = [{ nomenclature_id: editingOrderHeader.nomenclature_id, quantity: editingOrderHeader.quantity }]

      await updateOrder(selectedOrder.id, headerWithInfo, items)
      alert('Замовлення успішно оновлено!')
      setIsEditMode(false)
      setSelectedOrder(null)
      fetchOrders(0, false, { searchQuery, dateRange: dateFilter })
    } catch (err) {
      alert('Помилка при оновленні замовлення: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteClick = async (orderId) => {
    if (!window.confirm('Ви впевнені, що хочете видалити це замовлення? Усі пов’язані наряди, матеріальні запити та робочі картки також будуть видалені!')) {
      return
    }
    setIsSubmitting(true)
    try {
      await deleteOrder(orderId)
      alert('Замовлення успішно видалено!')
      setSelectedOrder(null)
      fetchOrders(0, false, { searchQuery, dateRange: dateFilter })
    } catch (err) {
      alert('Помилка при видаленні замовлення: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSuperDeleteClick = async (orderId) => {
    if (!window.confirm('УВАГА! Це повне СУПЕР-ВИДАЛЕННЯ.\n\nВсі запити, резерви та робочі картки будуть видалені, а використані матеріали ПОВЕРНУТЬСЯ НА СКЛАДИ.\n\nВи впевнені, що хочете це зробити?')) {
      return
    }
    if (!window.confirm('ПІДТВЕРДІТЬ ЩЕ РАЗ: відновити склади та видалити замовлення повністю?')) {
      return
    }
    setIsSubmitting(true)
    try {
      await superDeleteOrder(orderId)
      alert('Замовлення та всі пов’язані дані повністю видалено з автоматичним поверненням матеріалів!')
      setSelectedOrder(null)
      fetchOrders(0, false, { searchQuery, dateRange: dateFilter })
    } catch (err) {
      alert('Помилка при супер-видаленні: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    setCurrentPage(0)
    fetchOrders(0, false, { searchQuery, dateRange: dateFilter })
  }, [dateFilter, searchQuery])

  const getStatusLabel = (s) => {
    const map = {
      'pending': 'ОЧІКУЄ',
      'in-progress': 'В РОБОТІ',
      'completed': 'ВІДВАНТАЖЕНО',
      'shipped': 'ВІДВАНТАЖЕНО',
      'packaged': 'ОЧІКУЄ ВІДВАНТАЖЕННЯ',
      'shop1': 'ЦЕХ №1',
      'shop2': 'ЦЕХ №2',
      'packaging': 'НА ПАКУВАННІ'
    }
    return map[s] || s?.toUpperCase()
  }

  const handleCustomerChange = async (val) => {
    setOrderHeader(prev => ({ ...prev, customer: val }))

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current)
    }

    if (val.length > 1) {
      setShowCustomerHints(true)
      searchTimeout.current = setTimeout(async () => {
        const results = await searchCustomers(val)
        setOrderHeader(currentHeader => {
          if (currentHeader.customer === val && results) {
            setLocalCustomers(results)
          }
          return currentHeader
        })
      }, 250)
    } else {
      setShowCustomerHints(false)
      setLocalCustomers([])
    }
  }

  const selectCustomer = (c) => {
    setOrderHeader({ ...orderHeader, customer: c.name, official_customer: c.official_name || '' })
    setShowCustomerHints(false)
  }

  const handleOrderSubmit = async (e) => {
    e.preventDefault()
    if (!orderHeader.customer || !orderHeader.orderNum || !orderHeader.nomenclature_id || !orderHeader.deadline) {
      alert('Будь ласка, заповніть Замовника, Номер замовлення, оберіть Продукт та вкажіть Термін (Дедлайн)')
      return
    }

    setIsSubmitting(true)
    try {
      const selectedProduct = nomenclatures.find(p => String(p.id) === String(orderHeader.nomenclature_id))
      const headerWithInfo = { ...orderHeader, productName: selectedProduct?.name || '' }

      const items = [{ nomenclature_id: orderHeader.nomenclature_id, quantity: orderHeader.quantity }]
      await apiService.submitOrder(headerWithInfo, items, addOrder, currentUser?.token)

      refreshTable('customers')

      setOrderHeader({
        ...orderHeader,
        orderNum: '',
        invoiceNum: '',
        customer: '',
        official_customer: '',
        nomenclature_id: '',
        quantity: 1,
        deadline: ''
      })
      alert('Замовлення успішно додано!')
      fetchOrders(0, false, { searchQuery, dateRange: dateFilter })
    } catch (err) {
      alert('Помилка при додаванні замовлення: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const loadMore = () => {
    const nextPage = currentPage + 1
    setCurrentPage(nextPage)
    fetchOrders(nextPage, true, { searchQuery, dateRange: dateFilter })
  }

  return (
    <div className="manager-module-modern" style={{ background: 'var(--bg, #050505)', minHeight: '100vh', color: 'var(--text, #fff)', display: 'flex', flexDirection: 'column', fontFamily: '"Outfit", sans-serif' }}>
      
      {/* Header Overlay */}
      <nav className="glass-nav" style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 25px 12px 75px', background: 'rgba(10,10,10,0.8)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)'
      }}>
        <Link to="/" className="back-btn-modern">
          <ArrowLeft size={18} /> <span>НАЗАД</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <LayoutDashboard className="text-orange" size={24} />
          <h1 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '1px', margin: 0 }}>MANAGER <span className="text-dim">CONSOLE</span></h1>
          <span className="pillar-badge-crm" style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase' }}>
            CRM & ERP Pillar
          </span>
        </div>
      </nav>

      <div className="content-scrollbox" style={{ padding: '30px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        
        {/* NEW ORDER SECTION */}
        <OrderForm
          orderHeader={orderHeader}
          setOrderHeader={setOrderHeader}
          handleOrderSubmit={handleOrderSubmit}
          handleCustomerChange={handleCustomerChange}
          showCustomerHints={showCustomerHints}
          setShowCustomerHints={setShowCustomerHints}
          localCustomers={localCustomers}
          selectCustomer={selectCustomer}
          nomenclatures={v2FinishedProductsOnly}
          setCreateProductQuery={setCreateProductQuery}
          setTargetProductField={setTargetProductField}
          setIsCreateProductOpen={setIsCreateProductOpen}
          isSubmitting={isSubmitting}
        />

        {/* REGISTRY SECTION */}
        <OrdersTable
          clientOrders={clientOrders}
          nomenclatures={allNomenclaturesList}
          getOrderProductionProgress={getOrderProductionProgress}
          getStatusLabel={getStatusLabel}
          setSelectedOrder={setSelectedOrder}
          handleEditInit={handleEditInit}
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          loading={loading}
          hasMoreOrders={hasMoreOrders}
          loadMore={loadMore}
        />
      </div>

      {/* DETAIL & EDIT MODAL */}
      <OrderDetailsModal
        selectedOrder={selectedOrder}
        onClose={() => { setSelectedOrder(null); setIsEditMode(false); }}
        isEditMode={isEditMode}
        setIsEditMode={setIsEditMode}
        editingOrderHeader={editingOrderHeader}
        setEditingOrderHeader={setEditingOrderHeader}
        handleUpdateSubmit={handleUpdateSubmit}
        handleDeleteClick={handleDeleteClick}
        handleSuperDeleteClick={handleSuperDeleteClick}
        handleBatchScheduleInit={handleBatchScheduleInit}
        handleEditInit={handleEditInit}
        nomenclatures={v2FinishedProductsOnly}
        currentUser={currentUser}
        isSubmitting={isSubmitting}
        getStatusLabel={getStatusLabel}
        onCreateNewProduct={(q) => {
          setCreateProductQuery(q)
          setTargetProductField('edit')
          setIsCreateProductOpen(true)
        }}
      />

      {/* BATCH SCHEDULE MODAL */}
      <BatchScheduleModal
        isOpen={isBatchScheduleOpen}
        selectedOrder={selectedOrder}
        batchScheduleList={batchScheduleList}
        onClose={() => setIsBatchScheduleOpen(false)}
        onUpdateBatchItem={handleUpdateBatchItem}
        onRemoveBatchItem={handleRemoveBatchItem}
        onAddBatchItem={handleAddBatchItem}
        onSaveBatchSchedule={handleSaveBatchSchedule}
        isSavingSchedule={isSavingSchedule}
      />

      {/* PRODUCT CREATION MODAL */}
      <CreateProductModal
        isOpen={isCreateProductOpen}
        onClose={() => setIsCreateProductOpen(false)}
        initialQuery={createProductQuery}
        nomenclatures={allNomenclaturesList}
        onCreated={(newId) => {
          fetchV2Nomenclatures()
          if (!newId) return
          if (targetProductField === 'edit') {
            setEditingOrderHeader(prev => ({ ...prev, nomenclature_id: newId }))
          } else {
            setOrderHeader(prev => ({ ...prev, nomenclature_id: newId }))
          }
        }}
      />
    </div>
  )
}

export default ManagerModule
