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
  Cpu 
} from 'lucide-react'
import ManagerModule from './modules/ManagerModule'
import WarehouseModule from './modules/WarehouseModule'
import MasterModule from './modules/MasterModule'

import NomenclatureModule from './modules/NomenclatureModule'
import EngineerModule from './modules/EngineerModule'
import OperatorTerminal from './modules/OperatorTerminal'
import ShippingModule from './modules/ShippingModule'
import SupplyModule from './modules/SupplyModule'
import ForemanWorkplace from './modules/ForemanWorkplace'
import MachinesModule from './modules/MachinesModule'
import { MESProvider } from './MESContext'


const Portal = () => {
  const modules = [
    { id: 'manager', title: 'Менеджер', icon: <LayoutDashboard />, path: '/manager', desc: 'Замовлення та планування' },
    { id: 'master', title: 'ЦЕХ №1', icon: <Users />, path: '/master', desc: 'Управління зміною' },
    { id: 'warehouse', title: 'Склад', icon: <Warehouse />, path: '/warehouse', desc: 'Бронювання сировини' },
    { id: 'engineer', title: 'Інженер', icon: <Settings />, path: '/engineer', desc: 'Підтвердження програм' },
    { id: 'foreman', title: 'Майстер', icon: <Users />, path: '/foreman', desc: 'Розподіл нарядів на картки' },
    { id: 'operator', title: 'Термінал', icon: <Tablet />, path: '/operator', desc: 'Місце оператора' },
    { id: 'shipping', title: 'Логістика', icon: <Truck />, path: '/shipping', desc: 'Відвантаження' },
    { id: 'nomenclature', title: 'Номенклатура', icon: <Settings />, path: '/nomenclature', desc: 'База виробів та BOM' },
    { id: 'supply', title: 'Постачання', icon: <Truck />, path: '/supply', desc: 'Закупівля ТМЦ' },
    { id: 'machines', title: 'Станки', icon: <Cpu />, path: '/machines', desc: 'Управління обладнанням' }
  ]

  const managerMod = modules.find(m => m.id === 'manager')
  const masterMod = modules.find(m => m.id === 'master')
  const warehouseMod = modules.find(m => m.id === 'warehouse')
  const engineerMod = modules.find(m => m.id === 'engineer')
  const foremanMod = modules.find(m => m.id === 'foreman')
  const operatorMod = modules.find(m => m.id === 'operator')
  const shippingMod = modules.find(m => m.id === 'shipping')
  const nomenclatureMod = modules.find(m => m.id === 'nomenclature')
  const supplyMod = modules.find(m => m.id === 'supply')
  const machinesMod = modules.find(m => m.id === 'machines')

  return (
    <div className="portal-container">
      <header className="portal-header">
        <div className="logo-wrap">
          <img src="/kulytsya.png" alt="Кулиця Лого" className="logo-img" />
          <h1>CRM <span>«КУЛИЦЯ»</span></h1>
        </div>
        <p>Industrial Control System</p>
      </header>
      
      <div className="module-grid">
        {/* Row 1 */}
        <Link to={managerMod.path} className="module-card main-card">
          <div className="m-icon">{managerMod.icon}</div>
          <div className="m-text"><h3>{managerMod.title}</h3><p>{managerMod.desc}</p></div>
          <div className="m-arrow">→</div>
        </Link>

        <Link to={masterMod.path} className="module-card main-card">
          <div className="m-icon">{masterMod.icon}</div>
          <div className="m-text"><h3>{masterMod.title}</h3><p>{masterMod.desc}</p></div>
          <div className="m-arrow">→</div>
        </Link>

        <div className="stacked-col">
          <Link to={warehouseMod.path} className="module-card mini-card">
            <div className="m-icon mini">{warehouseMod.icon}</div>
            <div className="m-text"><h3>{warehouseMod.title}</h3><p>{warehouseMod.desc}</p></div>
          </Link>
          <Link to={engineerMod.path} className="module-card mini-card engineer">
            <div className="m-icon mini">{engineerMod.icon}</div>
            <div className="m-text"><h3>{engineerMod.title}</h3><p>{engineerMod.desc}</p></div>
          </Link>
        </div>

        {/* Row 2 */}
        <Link to={foremanMod.path} className="module-card main-card" style={{ borderColor: '#f59e0b' }}>
          <div className="m-icon" style={{ color: '#f59e0b' }}>{foremanMod.icon}</div>
          <div className="m-text"><h3>{foremanMod.title}</h3><p>{foremanMod.desc}</p></div>
          <div className="m-arrow">→</div>
        </Link>
        
        <Link to={operatorMod.path} className="module-card main-card">
          <div className="m-icon">{operatorMod.icon}</div>
          <div className="m-text"><h3>{operatorMod.title}</h3><p>{operatorMod.desc}</p></div>
          <div className="m-arrow">→</div>
        </Link>

        <Link to={shippingMod.path} className="module-card main-card">
          <div className="m-icon">{shippingMod.icon}</div>
          <div className="m-text"><h3>{shippingMod.title}</h3><p>{shippingMod.desc}</p></div>
          <div className="m-arrow">→</div>
        </Link>
        
        <Link to={supplyMod.path} className="module-card main-card">
          <div className="m-icon">{supplyMod.icon}</div>
          <div className="m-text"><h3>{supplyMod.title}</h3><p>{supplyMod.desc}</p></div>
          <div className="m-arrow">→</div>
        </Link>

        <Link to={nomenclatureMod.path} className="module-card main-card">
          <div className="m-icon">{nomenclatureMod.icon}</div>
          <div className="m-text"><h3>{nomenclatureMod.title}</h3><p>{nomenclatureMod.desc}</p></div>
          <div className="m-arrow">→</div>
        </Link>

        <Link to={machinesMod.path} className="module-card main-card" style={{ borderColor: 'var(--primary)' }}>
          <div className="m-icon">{machinesMod.icon}</div>
          <div className="m-text"><h3>{machinesMod.title}</h3><p>{machinesMod.desc}</p></div>
          <div className="m-arrow">→</div>
        </Link>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .portal-header { text-align: center; margin-bottom: 60px; }
        .logo-wrap { display: flex; flex-direction: column; align-items: center; gap: 15px; }
        .logo-img { height: 100px; width: auto; filter: drop-shadow(0 0 20px rgba(255,144,0,0.3)); }
        .portal-header h1 { font-size: 3rem; font-weight: 900; color: #fff; margin: 0; letter-spacing: -1px; }
        .portal-header h1 span { color: var(--primary); }
        .portal-header p { color: #444; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4em; margin-top: 10px; }

        .module-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; max-width: 1200px; margin: 0 auto; }
        .module-card { 
          background: #121212; border: 1px solid #1a1a1a; border-radius: 24px; padding: 30px; 
          text-decoration: none; display: flex; flex-direction: column; gap: 20px;
          transition: 0.3s; position: relative; overflow: hidden;
        }
        .module-card:hover { transform: translateY(-8px); border-color: var(--primary); background: #161616; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
        
        .main-card { min-height: 220px; }
        .mini-card { min-height: 100px; padding: 15px 20px; flex-direction: row; align-items: center; gap: 20px; }
        .mini-card .m-text h3 { font-size: 1.1rem; margin-bottom: 2px; }
        .mini-card .m-text p { font-size: 0.75rem; }
        
        .engineer { border-color: #3b82f633; }
        .engineer:hover { border-color: #3b82f6; }
        .engineer .m-icon { color: #3b82f6; }
        
        .stacked-col { display: flex; flex-direction: column; gap: 20px; }

        .m-icon { width: 54px; height: 54px; background: #000; border-radius: 14px; display: flex; align-items: center; justify-content: center; color: var(--primary); transition: 0.3s; }
        .m-icon.mini { width: 40px; height: 40px; border-radius: 10px; }
        .module-card:hover .m-icon { background: var(--primary); color: #000; transform: scale(1.05); }
        .module-card.engineer:hover .m-icon { background: #3b82f6; }
        
        .m-text h3 { font-size: 1.3rem; color: #fff; margin-bottom: 6px; font-weight: 800; }
        .m-text p { color: #555; font-size: 0.85rem; line-height: 1.4; font-weight: 500; }
        
        .m-arrow { margin-top: auto; color: #222; font-size: 1.2rem; font-weight: 900; transition: 0.3s; }
        .module-card:hover .m-arrow { color: var(--primary); transform: translateX(8px); }

        @media (max-width: 1024px) { .module-grid { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 640px) { .module-grid { grid-template-columns: 1fr; } }
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
        <Route path="/foreman" element={<ForemanWorkplace />} />
        <Route path="/operator" element={<OperatorTerminal />} />
        <Route path="/engineer" element={<EngineerModule />} />
        <Route path="/shipping" element={<ShippingModule />} />
        <Route path="/supply" element={<SupplyModule />} />
        <Route path="/nomenclature" element={<NomenclatureModule />} />
        <Route path="/machines" element={<MachinesModule />} />
      </Routes>
    </MESProvider>
  )
}

export default App
