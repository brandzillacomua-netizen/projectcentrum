import React from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import { 
  Menu,
  LayoutDashboard,
  Warehouse,
  Users,
  Tablet,
  Truck,
  Settings,
  Cpu,
  ChevronRight,
  Monitor,
  ShieldCheck,
} from 'lucide-react'
import ManagerModule from './modules/ManagerModule'
import WarehouseModule from './modules/WarehouseModule'
import MasterModule from './modules/MasterModule_v3'
import NomenclatureModule from './modules/NomenclatureModule'
import EngineerModule from './modules/EngineerModule'
import DirectorModule from './modules/DirectorModule'
import OperatorTerminal from './modules/OperatorTerminal'
import ShippingModule from './modules/ShippingModule'
import SupplyModule from './modules/SupplyModule'
import ForemanWorkplace from './modules/ForemanWorkplace'
import MachinesModule from './modules/MachinesModule'
import SettingsModule from './modules/SettingsModule'
import { MESProvider } from './MESContext'

const Portal = () => {
  const modules = [
    { id: 'manager', title: 'Менеджер', icon: <LayoutDashboard />, path: '/manager', desc: 'Замовлення та планування', color: '#ff9000' },
    { id: 'master', title: 'Цех №1', icon: <Monitor />, path: '/master', desc: 'Управління зміною', color: '#3b82f6' },
    { id: 'warehouse', title: 'Склад', icon: <Warehouse />, path: '/warehouse', desc: 'Матеріали та залишки', color: '#10b981' },
    { id: 'engineer', title: 'Інженер', icon: <FileCodeIcon />, path: '/engineer', desc: 'CNC та специфікації', color: '#8b5cf6' },
    { id: 'director', title: 'Директор Виробництва', icon: <ShieldCheck size={24} />, path: '/director', desc: 'Фінальне підтвердження', color: '#10b981' },
    { id: 'foreman', title: 'Майстер', icon: <Users />, path: '/foreman', desc: 'Розподіл нарядів', color: '#f59e0b' },
    { id: 'operator', title: 'Термінал', icon: <Tablet />, path: '/operator', desc: 'Робоче місце', color: '#ef4444' },
    { id: 'shipping', title: 'Логістика', icon: <Truck />, path: '/shipping', desc: 'Відвантаження', color: '#ec4899' },
    { id: 'supply', title: 'Постачання', icon: <Truck />, path: '/supply', desc: 'Закупівля ТМЦ', color: '#06b6d4' },
    { id: 'nomenclature', title: 'База', icon: <Settings />, path: '/nomenclature', desc: 'Номенклатура', color: '#6366f1' },
    { id: 'machines', title: 'Станки', icon: <Cpu />, path: '/machines', desc: 'Обладнання', color: '#f97316' },
    { id: 'settings', title: 'Система', icon: <Settings />, path: '/settings', desc: 'Конфігурація', color: '#444' }
  ]

  return (
    <div className="portal-container-v2" style={{ background: '#050505', minHeight: '100vh', color: '#fff', padding: '40px 20px' }}>
      <header className="portal-header-v2" style={{ maxWidth: '1200px', margin: '0 auto 50px', textAlign: 'center' }}>
        <div className="logo-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
           <img src="/kulytsya.png" alt="Logo" style={{ height: '70px', filter: 'drop-shadow(0 0 15px rgba(255,144,0,0.4))' }} />
           <h1 style={{ fontSize: '2.4rem', fontWeight: 950, margin: 0, letterSpacing: '-1px' }}>CRM <span style={{ color: '#ff9000' }}>КУЛИЦЯ</span></h1>
           <p style={{ color: '#333', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.4em' }}>Industrial Control v2.0</p>
        </div>
      </header>

      <div className="portal-grid-v2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        {modules.map(mod => (
          <Link key={mod.id} to={mod.path} className="portal-card-v2 glass-panel" style={{ textDecoration: 'none', background: '#111', border: '1px solid #1a1a1a', borderRadius: '24px', padding: '25px', display: 'flex', alignItems: 'center', gap: '20px', transition: '0.3s cubic-bezier(0.4, 0, 0.2, 1)', position: 'relative', overflow: 'hidden' }}>
             <div className="card-icon-v2" style={{ background: '#000', width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: mod.color }}>
                {mod.icon}
             </div>
             <div className="card-info-v2" style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', color: '#fff', fontWeight: 900 }}>{mod.title}</h3>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#555', fontWeight: 500 }}>{mod.desc}</p>
             </div>
             <ChevronRight className="arrow-v2" size={18} style={{ color: '#222', transition: '0.3s' }} />
             <div className="hover-line" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: mod.color, opacity: 0, transition: '0.3s' }}></div>
          </Link>
        ))}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .portal-card-v2:hover { transform: translateY(-5px) scale(1.02); background: #181818; border-color: #333; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
        .portal-card-v2:hover .arrow-v2 { color: #ff9000; transform: translateX(5px); }
        .portal-card-v2:hover .hover-line { opacity: 1; }
        
        @media (max-width: 768px) {
          .portal-grid-v2 { grid-template-columns: 1fr; }
          .portal-header-v2 h1 { font-size: 1.8rem; }
          .portal-card-v2 { padding: 20px; border-radius: 20px; }
          .card-icon-v2 { width: 48px; height: 48px; }
        }
      `}} />
    </div>
  )
}

const FileCodeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="m10 13-2 2 2 2"/><path d="m14 17 2-2-2-2"/></svg>
)

function App() {
  return (
    <MESProvider>
      <Routes>
        <Route path="/" element={<Portal />} />
        <Route path="/manager" element={<ManagerModule />} />
        <Route path="/warehouse" element={<WarehouseModule />} />
        <Route path="/master" element={<MasterModule />} />
        <Route path="/foreman" element={<ForemanWorkplace />} />
        <Route path="/operator" element={<OperatorTerminal />} />
        <Route path="/engineer" element={<EngineerModule />} />
        <Route path="/director" element={<DirectorModule />} />
        <Route path="/shipping" element={<ShippingModule />} />
        <Route path="/supply" element={<SupplyModule />} />
        <Route path="/nomenclature" element={<NomenclatureModule />} />
        <Route path="/machines" element={<MachinesModule />} />
        <Route path="/settings" element={<SettingsModule />} />
      </Routes>
    </MESProvider>
  )
}

export default App
