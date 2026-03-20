import React from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import { 
  Menu, 
  LayoutDashboard, 
  Warehouse, 
  Users, 
  Tablet, 
  Truck,
  Settings 
} from 'lucide-react'
import ManagerModule from './modules/ManagerModule'
import WarehouseModule from './modules/WarehouseModule'
import MasterModule from './modules/MasterModule'
import OperatorTerminal from './modules/OperatorTerminal'
import ShippingModule from './modules/ShippingModule'
import SettingsModule from './modules/SettingsModule'
import { MESProvider } from './MESContext'

const Portal = () => {
  const modules = [
    { id: 'manager', title: 'Менеджер', icon: <LayoutDashboard />, color: 'var(--primary)', path: '/manager', desc: 'Прийом замовлень та планування' },
    { id: 'warehouse', title: 'Склад', icon: <Warehouse />, color: 'var(--secondary)', path: '/warehouse', desc: 'Облік сировини та залишків' },
    { id: 'master', title: 'Майстер', icon: <Users />, color: 'var(--success)', path: '/master', desc: 'Управління нарядами та зміною' },
    { id: 'operator', title: 'Термінал', icon: <Tablet />, color: 'var(--accent)', path: '/operator', desc: 'Робоче місце оператора' },
    { id: 'shipping', title: 'Логістика', icon: <Truck />, color: 'var(--danger)', path: '/shipping', desc: 'Відвантаження готової продукції' },
    { id: 'settings', title: 'Налаштування', icon: <Settings />, color: '#636e72', path: '/settings', desc: 'База номенклатури та нормативи' }
  ]

  return (
    <div className="portal-container">
      <header className="portal-header">
        <div className="logo-group">
          <div className="logo-icon">C</div>
          <h1>CENTRUM <span>MES</span></h1>
        </div>
        <p>Інтелектуальна система управління виробництвом</p>
      </header>
      
      <div className="module-grid">
        {modules.map(mod => (
          <Link to={mod.path} key={mod.id} className="module-card" style={{ '--card-color': mod.color }}>
            <div className="card-icon">{mod.icon}</div>
            <div className="card-content">
              <h3>{mod.title}</h3>
              <p>{mod.desc}</p>
            </div>
            <div className="card-arrow">→</div>
          </Link>
        ))}
      </div>
    </div>
  )
}

function App() {
  return (
    <MESProvider>
      <Routes>
        <Route path="/" element={<Portal />} />
        <Route path="/manager" element={<ManagerModule />} />
        <Route path="/warehouse" element={<WarehouseModule />} />
        <Route path="/master" element={<MasterModule />} />
        <Route path="/operator" element={<OperatorTerminal />} />
        <Route path="/shipping" element={<ShippingModule />} />
        <Route path="/settings" element={<SettingsModule />} />
      </Routes>
    </MESProvider>
  )
}

export default App
