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
    { id: 'manager', title: 'Менеджер', icon: <LayoutDashboard />, path: '/manager', desc: 'Прийом замовлень та планування' },
    { id: 'warehouse', title: 'Склад', icon: <Warehouse />, path: '/warehouse', desc: 'Облік сировини та залишків' },
    { id: 'master', title: 'Майстер', icon: <Users />, path: '/master', desc: 'Управління нарядами та зміною' },
    { id: 'operator', title: 'Термінал', icon: <Tablet />, path: '/operator', desc: 'Робоче місце оператора' },
    { id: 'shipping', title: 'Логістика', icon: <Truck />, path: '/shipping', desc: 'Відвантаження готової продукції' },
    { id: 'settings', title: 'Налаштування', icon: <Settings />, path: '/settings', desc: 'База номенклатури та нормативи' }
  ]

  return (
    <div className="portal-container">
      <header className="portal-header">
        <div className="logo-wrap">
          <div className="logo-orb">M</div>
          <h1>CENTRUM <span>MES</span></h1>
        </div>
        <p>Premium Industrial Control System</p>
      </header>
      
      <div className="module-grid">
        {modules.map(mod => (
          <Link to={mod.path} key={mod.id} className="module-card">
            <div className="m-icon">{mod.icon}</div>
            <div className="m-text">
              <h3>{mod.title}</h3>
              <p>{mod.desc}</p>
            </div>
            <div className="m-arrow">→</div>
          </Link>
        ))}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .portal-header { text-align: center; margin-bottom: 80px; }
        .logo-wrap { display: flex; flex-direction: column; align-items: center; gap: 15px; }
        .logo-orb { width: 80px; height: 80px; background: var(--primary); color: black; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; font-weight: 900; box-shadow: 0 0 40px rgba(255,144,0,0.4); }
        .portal-header h1 { font-size: 4rem; font-weight: 900; color: #fff; margin: 0; letter-spacing: -2px; }
        .portal-header h1 span { color: var(--primary); }
        .portal-header p { color: #555; font-size: 1.1rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3em; margin-top: 10px; }

        .module-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px; }
        .module-card { 
          background: #1b1b1b; border: 1px solid #333; border-radius: 24px; padding: 40px; 
          text-decoration: none; display: flex; flex-direction: column; gap: 20px;
          transition: 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); position: relative; overflow: hidden;
        }
        .module-card:hover { transform: translateY(-15px); border-color: var(--primary); box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
        .module-card::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 0; background: var(--primary); transition: 0.3s; }
        .module-card:hover::after { height: 6px; }

        .m-icon { width: 60px; height: 60px; background: #000; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: var(--primary); transition: 0.3s; }
        .module-card:hover .m-icon { background: var(--primary); color: #000; transform: scale(1.1) rotate(5deg); }
        
        .m-text h3 { font-size: 1.5rem; color: #fff; margin-bottom: 8px; font-weight: 800; }
        .m-text p { color: #666; font-size: 0.9rem; line-height: 1.5; font-weight: 500; }
        
        .m-arrow { margin-top: auto; color: #333; font-size: 1.5rem; font-weight: 900; transition: 0.3s; }
        .module-card:hover .m-arrow { color: var(--primary); transform: translateX(10px); }

        @media (max-width: 1024px) { .module-grid { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 640px) { .module-grid { grid-template-columns: 1fr; } .portal-header h1 { font-size: 2.5rem; } }
      `}} />
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
