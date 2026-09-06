import React, { useState, useMemo, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Zap,
  Plus,
  Package,
  AlertTriangle,
  MessageCircle,
  Briefcase,
  Tablet,
  Warehouse,
  Cpu,
  Search,
  X,
  ChevronRight
} from 'lucide-react'
import { useMES } from '../../MESContext'
import { getAvailableModules } from '../../config/moduleRegistry'

export const PortalDashboard = ({ chatUnreadCount }) => {
  const { currentUser, orders = [], workCards = [], requests = [], machines = [], machineCalls = [], tasks = [], companyPositions = [] } = useMES()
  const location = useLocation()
  const navigate = useNavigate()
  const [selectedPillar, setSelectedPillar] = useState('all') // 'all', 'crm', 'erp', 'mes'
  const [portalSearch, setPortalSearch] = useState('')

  const isAdmin = currentUser?.position === 'Адмін' || currentUser?.role === 'admin'
  const modules = useMemo(() => {
    return getAvailableModules(currentUser, 0, chatUnreadCount)
  }, [currentUser, chatUnreadCount])

  const hasDashboardAccess = Boolean(
    currentUser?.access_rights?.dashboard === true ||
    currentUser?.access_rights?.dashboard === 'true' ||
    currentUser?.access_rights?.dashboard === 1
  );

  // REDIRECT TO START PAGE OR FIRST MODULE IF USER HAS NO DASHBOARD ACCESS
  useEffect(() => {
    if (!hasDashboardAccess && modules.length > 0 && location.pathname === '/') {
      const userPosition = (companyPositions || []).find(p => p.name === currentUser?.position);
      const targetPath = userPosition?.start_page;
      if (targetPath && modules.some(m => m.path === targetPath)) {
        navigate(targetPath, { replace: true });
      } else if (modules[0]?.path) {
        navigate(modules[0].path, { replace: true });
      }
    }
  }, [hasDashboardAccess, modules, location.pathname, companyPositions, currentUser?.position, navigate]);

  const filteredModules = modules.filter(m => {
    const matchesSearch = m.title.toLowerCase().includes(portalSearch.toLowerCase()) ||
                          m.desc.toLowerCase().includes(portalSearch.toLowerCase());
    const matchesPillar = selectedPillar === 'all' || m.pillar === selectedPillar;
    return matchesSearch && matchesPillar;
  });

  const crmCount = modules.filter(m => m.pillar === 'crm').length;
  const erpCount = modules.filter(m => m.pillar === 'erp').length;
  const mesCount = modules.filter(m => m.pillar === 'mes').length;

  // Real Enterprise Live Analytics Metrics
  const activeOrders = orders.filter(o => o.status !== 'completed' && o.status !== 'shipped' && o.status !== 'cancelled');
  const activeOrdersCount = activeOrders.length;
  
  const activeOrdersSum = activeOrders.reduce((acc, o) => {
    let val = Number(o.total_price || o.price || o.total_amount || 0);
    if (!val && Array.isArray(o.order_items) && o.order_items.length > 0) {
      val = o.order_items.reduce((iSum, item) => {
        const q = Number(item.quantity || item.qty || item.count || 0);
        const p = Number(item.price_per_unit || item.price || item.cost || 0);
        return iSum + (Number(item.total_price) || (q * p));
      }, 0);
    }
    return acc + val;
  }, 0);

  const pendingRequestsCount = requests.filter(r => r.status === 'pending' || r.status === 'new' || r.status === 'created' || r.status === 'in_progress').length;
  
  const activeWorkCardsCount = workCards.filter(w => w.status === 'in-progress' || w.status === 'at-buffer' || w.status === 'new' || w.status === 'in_progress' || w.status === 'active').length
    || tasks.filter(t => t.status !== 'completed' && t.status !== 'done' && t.status !== 'cancelled').length;

  const activeCallsCount = machineCalls.filter(c => c.status === 'pending' || c.status === 'active' || c.status === 'new').length;
  const workingMachinesCount = machines.filter(m => m.status === 'working' || m.status === 'active' || m.status === 'online').length;

  // User position & role detection
  const userPos = (currentUser?.position || '').toLowerCase();
  const userRole = (currentUser?.role || '').toLowerCase();

  const isManagerRole = userPos.includes('менеджер') || userPos.includes('продаж') || userRole.includes('manager');
  const isForemanRole = userPos.includes('майстер') || userPos.includes('нач') || userPos.includes('цех') || userPos.includes('бригад') || userRole.includes('foreman') || userRole.includes('master');
  const isWarehouseRole = userPos.includes('склад') || userPos.includes('комір') || userPos.includes('постач') || userRole.includes('warehouse');
  const isDirectorRole = userPos.includes('директор') || userPos.includes('керівник') || userRole.includes('director');
  const isEngineerRole = userPos.includes('інженер') || userPos.includes('чпк') || userPos.includes('вкя') || userRole.includes('engineer');

  const positionTitle = currentUser?.position || (isDirectorRole ? 'Директор' : isManagerRole ? 'Менеджер' : isForemanRole ? 'Начальник Цеху' : isWarehouseRole ? 'Завскладу' : isEngineerRole ? 'Інженер' : isAdmin ? 'Адмін' : 'Спеціаліст');

  const hasModule = (id) => modules.some(m => m.id === id);

  // Quick Action availability based on permissions
  const canCreateOrder = hasModule('crm') || hasModule('manager') || hasModule('director');
  const canCreateBatch = hasModule('master') || hasModule('foreman') || hasModule('director');
  const canRequestMaterial = hasModule('warehouse') || hasModule('supply') || hasModule('master') || hasModule('foreman') || hasModule('director');
  const canCallMaster = hasModule('operator') || hasModule('shop1') || hasModule('shop2_terminal') || hasModule('master');

  if (!hasDashboardAccess && modules.length === 0) {
    return (
      <div style={{ background: '#050505', minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px', padding: '20px', color: '#fff', textAlign: 'center' }}>
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
          <AlertTriangle size={40} />
        </div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 950, margin: 0 }}>Немає призначених модулів</h1>
        <p style={{ color: '#888', fontSize: '0.9rem', maxWidth: '400px', margin: '0 0 20px' }}>
          У вашому обліковому записі не обрано жодного доступного модуля. Зверніться до адміністратора в модулі «Система».
        </p>
      </div>
    );
  }

  return (
    <div className="portal-container-v2" style={{ background: 'var(--bg)', minHeight: 'calc(100vh - 64px)', color: 'var(--text)', padding: '24px 28px 40px' }}>
      <div style={{ maxWidth: '1380px', margin: '0 auto' }}>
        
        {/* Executive Command Header & Pulse Status */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(255, 144, 0, 0.08) 100%)',
          border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
          borderRadius: '24px',
          padding: '24px 28px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.85rem', fontWeight: 950, margin: 0, letterSpacing: '-0.5px', color: 'var(--text)' }}>
                Вітаємо, {currentUser?.first_name || currentUser?.login || 'Користувач'}! 👋
              </h1>
              <span style={{
                background: 'linear-gradient(135deg, #ff9000, #ea580c)',
                color: '#fff',
                padding: '4px 14px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 900,
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
                boxShadow: '0 4px 12px rgba(255,144,0,0.3)'
              }}>
                {positionTitle}
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '8px', marginBottom: 0, fontWeight: 600 }}>
              Операційний центр підприємства • Моніторинг CRM, ERP та виробничого виконання (MES) у реальному часі
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--card-bg, rgba(22, 24, 34, 0.75))',
              border: '1px solid var(--glass-border)',
              padding: '8px 16px',
              borderRadius: '16px',
              fontSize: '0.8rem',
              fontWeight: 800,
              color: '#10b981'
            }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }} />
              Пульс системи: Всі цехи в нормі
            </div>
          </div>
        </div>

        {/* ⚡ Enterprise Quick Actions Bar */}
        <div style={{
          background: 'var(--card-bg, rgba(22, 24, 34, 0.75))',
          border: '1px solid var(--glass-border)',
          borderRadius: '20px',
          padding: '16px 20px',
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: 'rgba(255, 144, 0, 0.15)', color: '#ff9000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--text)' }}>Швидкі Дії Підприємства</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Оперативне створення запитів, замовлень та зв'язок</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {canCreateOrder && (
              <Link to="/manager" style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#fff', textDecoration: 'none', padding: '9px 18px', borderRadius: '14px', fontSize: '0.82rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)', transition: '0.2s' }}>
                <Plus size={16} /> Створити Замовлення
              </Link>
            )}

            {canCreateBatch && (
              <Link to="/master" style={{ background: 'linear-gradient(135deg, #ff9000, #ea580c)', color: '#fff', textDecoration: 'none', padding: '9px 18px', borderRadius: '14px', fontSize: '0.82rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(255, 144, 0, 0.3)', transition: '0.2s' }}>
                <Plus size={16} /> Створити Наряд
              </Link>
            )}

            {canRequestMaterial && (
              <Link to="/warehouse" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', textDecoration: 'none', padding: '9px 18px', borderRadius: '14px', fontSize: '0.82rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px', transition: '0.2s' }}>
                <Package size={16} /> Запит Матеріалів
              </Link>
            )}

            {canCallMaster && (
              <Link to="/machines" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', textDecoration: 'none', padding: '9px 18px', borderRadius: '14px', fontSize: '0.82rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px', transition: '0.2s' }}>
                <AlertTriangle size={16} /> Викликати Майстра
              </Link>
            )}

            <Link to="/chat" style={{ background: 'var(--secondary, rgba(255,255,255,0.06))', color: 'var(--text)', border: '1px solid var(--glass-border)', textDecoration: 'none', padding: '9px 18px', borderRadius: '14px', fontSize: '0.82rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', transition: '0.2s' }}>
              <MessageCircle size={16} color="#6366f1" /> Чат
            </Link>
          </div>
        </div>

        {/* 4 Core Vital Executive Metric Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '20px',
          marginBottom: '32px'
        }}>
          {/* Tile 1: CRM & Orders */}
          <div className="glass-panel" style={{
            background: 'var(--card-bg, rgba(22, 24, 34, 0.75))',
            border: '1px solid var(--glass-border)',
            padding: '22px 24px',
            borderRadius: '22px',
            display: 'flex',
            alignItems: 'center',
            gap: '18px',
            transition: 'all 0.3s ease'
          }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '16px',
              background: 'rgba(99, 102, 241, 0.14)',
              color: '#6366f1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              flexShrink: 0
            }}>
              <Briefcase size={26} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Активні Замовлення & Оборот
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 950, color: 'var(--text)', marginTop: '2px' }}>
                {activeOrdersCount} <span style={{ fontSize: '0.85rem', color: '#6366f1', fontWeight: 800 }}>замовлень</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700, marginTop: '2px' }}>
                ₴ {activeOrdersSum > 0 ? activeOrdersSum.toLocaleString('uk-UA') : '0'} у роботі
              </div>
            </div>
          </div>

          {/* Tile 2: MES Manufacturing Stream */}
          <div className="glass-panel" style={{
            background: 'var(--card-bg, rgba(22, 24, 34, 0.75))',
            border: '1px solid var(--glass-border)',
            padding: '22px 24px',
            borderRadius: '22px',
            display: 'flex',
            alignItems: 'center',
            gap: '18px',
            transition: 'all 0.3s ease'
          }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '16px',
              background: 'rgba(255, 144, 0, 0.14)',
              color: '#ff9000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255, 144, 0, 0.3)',
              flexShrink: 0
            }}>
              <Tablet size={26} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Цеховий Потік & Наряди
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 950, color: 'var(--text)', marginTop: '2px' }}>
                {activeWorkCardsCount} <span style={{ fontSize: '0.85rem', color: '#ff9000', fontWeight: 800 }}>карт у процесі</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, marginTop: '2px' }}>
                Цех №1 & Цех №2 активні
              </div>
            </div>
          </div>

          {/* Tile 3: ERP Warehouse & Supplies */}
          <div className="glass-panel" style={{
            background: 'var(--card-bg, rgba(22, 24, 34, 0.75))',
            border: '1px solid var(--glass-border)',
            padding: '22px 24px',
            borderRadius: '22px',
            display: 'flex',
            alignItems: 'center',
            gap: '18px',
            transition: 'all 0.3s ease'
          }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '16px',
              background: 'rgba(16, 185, 129, 0.14)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              flexShrink: 0
            }}>
              <Warehouse size={26} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Склад WMS & Запити
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 950, color: 'var(--text)', marginTop: '2px' }}>
                {pendingRequestsCount} <span style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 800 }}>активних запитів</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, marginTop: '2px' }}>
                Склад готовності & ТМЦ
              </div>
            </div>
          </div>

          {/* Tile 4: Equipment & Quality */}
          <div className="glass-panel" style={{
            background: 'var(--card-bg, rgba(22, 24, 34, 0.75))',
            border: '1px solid var(--glass-border)',
            padding: '22px 24px',
            borderRadius: '22px',
            display: 'flex',
            alignItems: 'center',
            gap: '18px',
            transition: 'all 0.3s ease'
          }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '16px',
              background: activeCallsCount > 0 ? 'rgba(239, 68, 68, 0.14)' : 'rgba(14, 165, 233, 0.14)',
              color: activeCallsCount > 0 ? '#ef4444' : '#0ea5e9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: activeCallsCount > 0 ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(14, 165, 233, 0.3)',
              flexShrink: 0
            }}>
              <Cpu size={26} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Верстати & Контроль Якості
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 950, color: 'var(--text)', marginTop: '2px' }}>
                {workingMachinesCount > 0 ? workingMachinesCount : (machines.length || 'Всі')} <span style={{ fontSize: '0.85rem', color: '#0ea5e9', fontWeight: 800 }}>обладнання</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: activeCallsCount > 0 ? '#ef4444' : '#10b981', fontWeight: 800, marginTop: '2px' }}>
                {activeCallsCount > 0 ? `🚨 ${activeCallsCount} термінових викликів!` : '✓ Аварійні виклики відсутні'}
              </div>
            </div>
          </div>
        </div>

        {/* 3-in-1 Pillars Fast Access Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '20px',
          marginBottom: '32px'
        }}>
          {/* CRM Pillar Bar */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(99, 102, 241, 0.03) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: '20px',
            padding: '22px 24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  🟣 CRM ПРОДАЖІ & ВОРОНКА
                </span>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.15rem', fontWeight: 900, color: 'var(--text)' }}>
                  Клієнтські Угоди та Замовлення
                </h3>
              </div>
              <span style={{ background: '#6366f1', color: '#fff', fontSize: '0.75rem', fontWeight: 900, padding: '4px 10px', borderRadius: '12px' }}>
                {crmCount} Модулів
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {hasModule('crm') && (
                <Link to="/crm" style={{ background: '#6366f1', color: '#fff', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, transition: '0.2s' }}>
                  Воронка Угод →
                </Link>
              )}
              {(hasModule('crm') || hasModule('crm_clients')) && (
                <Link to="/crm/clients" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.3)', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, transition: '0.2s' }}>
                  База Клієнтів
                </Link>
              )}
              {hasModule('manager') && (
                <Link to="/manager" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.3)', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, transition: '0.2s' }}>
                  Менеджер Замовлень
                </Link>
              )}
              {hasModule('kanban') && (
                <Link to="/tasks" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.3)', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, transition: '0.2s' }}>
                  Задачі Канбан
                </Link>
              )}
            </div>
          </div>

          {/* ERP Pillar Bar */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(16, 185, 129, 0.03) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '20px',
            padding: '22px 24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  🟢 ERP РЕСУРСИ & ЛОГІСТИКА
                </span>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.15rem', fontWeight: 900, color: 'var(--text)' }}>
                  Склади WMS, Постачання та Економіка
                </h3>
              </div>
              <span style={{ background: '#10b981', color: '#fff', fontSize: '0.75rem', fontWeight: 900, padding: '4px 10px', borderRadius: '12px' }}>
                {erpCount} Модулів
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {hasModule('warehouse') && (
                <Link to="/warehouse" style={{ background: '#10b981', color: '#fff', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, transition: '0.2s' }}>
                  Склад Оперативний →
                </Link>
              )}
              {(hasModule('prep_terminal') || hasModule('preparation_dashboard') || hasModule('supply')) && (
                <Link to="/preparation-dashboard" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, transition: '0.2s' }}>
                  Склад Виробництва
                </Link>
              )}
              {hasModule('warehouse_fgp') && (
                <Link to="/warehouse-fgp" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, transition: '0.2s' }}>
                  Склад СГП
                </Link>
              )}
              {hasModule('warehouse_boxes') && (
                <Link to="/warehouse-boxes" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, transition: '0.2s' }}>
                  Бокси фрез
                </Link>
              )}
              {hasModule('supply') && (
                <Link to="/supply" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, transition: '0.2s' }}>
                  Постачання (Procurement)
                </Link>
              )}
              {hasModule('economy') && (
                <Link to="/economy" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, transition: '0.2s' }}>
                  Економіка & Ціни
                </Link>
              )}
            </div>
          </div>

          {/* MES Pillar Bar */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(255, 144, 0, 0.12) 0%, rgba(255, 144, 0, 0.03) 100%)',
            border: '1px solid rgba(255, 144, 0, 0.25)',
            borderRadius: '20px',
            padding: '22px 24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#ff9000', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  🟠 MES ВИРОБНИЧІ ЦЕХИ
                </span>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.15rem', fontWeight: 900, color: 'var(--text)' }}>
                  Наряди, Термінали та Кабінет Директора
                </h3>
              </div>
              <span style={{ background: '#ff9000', color: '#fff', fontSize: '0.75rem', fontWeight: 900, padding: '4px 10px', borderRadius: '12px' }}>
                {mesCount} Модулів
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {hasModule('director') && (
                <Link to="/director" style={{ background: '#ff9000', color: '#000', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 900, transition: '0.2s' }}>
                  Кабінет Директора →
                </Link>
              )}
              {hasModule('master') && (
                <Link to="/master" style={{ background: 'rgba(255, 144, 0, 0.15)', color: '#ff9000', border: '1px solid rgba(255, 144, 0, 0.3)', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, transition: '0.2s' }}>
                  Кабінет Майстра
                </Link>
              )}
              {hasModule('foreman') && (
                <Link to="/foreman" style={{ background: 'rgba(255, 144, 0, 0.15)', color: '#ff9000', border: '1px solid rgba(255, 144, 0, 0.3)', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, transition: '0.2s' }}>
                  Начальник Цеху
                </Link>
              )}
              {hasModule('shop1_foreman') && (
                <Link to="/shop1-foreman" style={{ background: 'rgba(255, 144, 0, 0.15)', color: '#ff9000', border: '1px solid rgba(255, 144, 0, 0.3)', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, transition: '0.2s' }}>
                  Диспетчер Цех №1
                </Link>
              )}
              {(hasModule('operator') || hasModule('shop1')) && (
                <Link to="/operator" style={{ background: 'rgba(255, 144, 0, 0.15)', color: '#ff9000', border: '1px solid rgba(255, 144, 0, 0.3)', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, transition: '0.2s' }}>
                  Робочий Термінал
                </Link>
              )}
              {hasModule('machines') && (
                <Link to="/machines" style={{ background: 'rgba(255, 144, 0, 0.15)', color: '#ff9000', border: '1px solid rgba(255, 144, 0, 0.3)', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, transition: '0.2s' }}>
                  Верстати & ЧПК
                </Link>
              )}
              {hasModule('brak') && (
                <Link to="/brak" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, transition: '0.2s' }}>
                  Контроль Браку (QC)
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Filter Toolbar & Module Catalog Grid */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '24px',
          flexWrap: 'wrap'
        }}>
          {/* Pillar Selector Buttons */}
          <div style={{
            background: 'var(--card-bg, rgba(22, 24, 34, 0.75))',
            border: '1px solid var(--glass-border)',
            padding: '6px',
            borderRadius: '18px',
            display: 'flex',
            gap: '6px',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => setSelectedPillar('all')}
              style={{
                padding: '9px 18px',
                borderRadius: '14px',
                border: selectedPillar === 'all' ? '1px solid #ff9000' : '1px solid transparent',
                background: selectedPillar === 'all' ? 'rgba(255, 144, 0, 0.15)' : 'transparent',
                color: selectedPillar === 'all' ? '#ff9000' : 'var(--text-muted)',
                fontWeight: 900,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Усі Модулі Системи ({modules.length})
            </button>

            <button
              onClick={() => setSelectedPillar('crm')}
              style={{
                padding: '9px 18px',
                borderRadius: '14px',
                border: selectedPillar === 'crm' ? '1px solid #6366f1' : '1px solid transparent',
                background: selectedPillar === 'crm' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                color: selectedPillar === 'crm' ? '#6366f1' : 'var(--text-muted)',
                fontWeight: 900,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1' }} />
              CRM Продажі ({crmCount})
            </button>

            <button
              onClick={() => setSelectedPillar('erp')}
              style={{
                padding: '9px 18px',
                borderRadius: '14px',
                border: selectedPillar === 'erp' ? '1px solid #10b981' : '1px solid transparent',
                background: selectedPillar === 'erp' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                color: selectedPillar === 'erp' ? '#10b981' : 'var(--text-muted)',
                fontWeight: 900,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
              ERP Ресурси ({erpCount})
            </button>

            <button
              onClick={() => setSelectedPillar('mes')}
              style={{
                padding: '9px 18px',
                borderRadius: '14px',
                border: selectedPillar === 'mes' ? '1px solid #ff9000' : '1px solid transparent',
                background: selectedPillar === 'mes' ? 'rgba(255, 144, 0, 0.15)' : 'transparent',
                color: selectedPillar === 'mes' ? '#ff9000' : 'var(--text-muted)',
                fontWeight: 900,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff9000' }} />
              MES Цехи ({mesCount})
            </button>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Пошук модуля..."
              value={portalSearch}
              onChange={(e) => setPortalSearch(e.target.value)}
              style={{
                padding: '11px 16px 11px 40px',
                borderRadius: '16px',
                border: '1px solid var(--glass-border)',
                background: 'var(--card-bg, rgba(22, 24, 34, 0.75))',
                color: 'var(--text)',
                fontSize: '0.88rem',
                width: '280px',
                outline: 'none',
                fontWeight: 600
              }}
            />
            {portalSearch && (
              <button
                onClick={() => setPortalSearch('')}
                style={{ position: 'absolute', right: '12px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Modules Grid */}
        <div className="portal-grid-v2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '20px' }}>
          {filteredModules.map(mod => (
            <Link
              key={mod.id}
              to={mod.path}
              className="portal-card-v2 glass-panel"
              style={{
                textDecoration: 'none',
                background: 'var(--card-bg, rgba(22, 24, 34, 0.75))',
                border: '1px solid var(--glass-border)',
                borderRadius: '22px',
                padding: '22px',
                display: 'flex',
                alignItems: 'center',
                gap: '18px',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div className="card-icon-v2" style={{
                background: `rgba(${mod.color === '#6366f1' ? '99, 102, 241' : mod.color === '#10b981' ? '16, 185, 129' : '255, 144, 0'}, 0.12)`,
                width: '54px',
                height: '54px',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: mod.color,
                position: 'relative',
                border: `1px solid ${mod.color}33`,
                flexShrink: 0
              }}>
                {mod.icon}
                {mod.badge > 0 && <span className="badge-count anim-pulse" style={{ position: 'absolute', top: -5, right: -5 }}>{mod.badge}</span>}
              </div>

              <div className="card-info-v2" style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.02rem', color: 'var(--text)', fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {mod.title}
                  </h3>
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {mod.desc}
                </p>
              </div>

              <ChevronRight className="arrow-v2" size={18} style={{ color: 'var(--text-muted)', transition: '0.2s', flexShrink: 0 }} />
              <div className="hover-line" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: mod.color, opacity: 0, transition: '0.2s' }} />
            </Link>
          ))}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .portal-card-v2:hover { transform: translateY(-4px); background: var(--card-hover-bg, rgba(30, 30, 42, 0.95)); border-color: rgba(255, 144, 0, 0.4) !important; box-shadow: 0 12px 30px rgba(0,0,0,0.15); }
        .portal-card-v2:hover .arrow-v2 { color: #ff9000; transform: translateX(4px); }
        .portal-card-v2:hover .hover-line { opacity: 1; }
        @media (max-width: 768px) { .portal-grid-v2 { grid-template-columns: 1fr; } }
      `}} />
    </div>
  )
}
