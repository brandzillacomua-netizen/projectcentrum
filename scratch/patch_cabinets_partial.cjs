const fs = require('fs');

// 1. Оновлюємо MasterModule_v3.jsx
const masterPath = 'a:/centrum/src/modules/MasterModule_v3.jsx';
if (fs.existsSync(masterPath)) {
  let content = fs.readFileSync(masterPath, 'utf8');
  
  const targetStr = `                      <div style={{
                        fontSize: '0.65rem',
                        padding: '5px 12px',
                        borderRadius: '8px',
                        background: isSkladConfirmed ? '#064e3b' : '#1a1a1a',
                        color: isSkladConfirmed ? '#10b981' : '#333',
                        fontWeight: 1000,
                        border: isSkladConfirmed ? '1px solid #10b981' : '1px solid #222'
                      }}>СКЛАД</div>`;

  const replacement = `                      <div style={{
                        fontSize: '0.65rem',
                        padding: '5px 12px',
                        borderRadius: '8px',
                        background: task.warehouse_conf === true 
                          ? '#064e3b' 
                          : (task.warehouse_conf === 'partial' ? '#78350f' : '#1a1a1a'),
                        color: task.warehouse_conf === true 
                          ? '#10b981' 
                          : (task.warehouse_conf === 'partial' ? '#f59e0b' : '#333'),
                        fontWeight: 1000,
                        border: task.warehouse_conf === true 
                          ? '1px solid #10b981' 
                          : (task.warehouse_conf === 'partial' ? '1px solid #d97706' : '1px solid #222')
                      }}>
                        {task.warehouse_conf === 'partial' ? 'ЧАСТК. СКЛАД' : 'СКЛАД'}
                      </div>`;
                      
  if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacement);
    fs.writeFileSync(masterPath, content, 'utf8');
    console.log('✅ MasterModule_v3.jsx warehouse badge updated successfully!');
  } else {
    // Fallback replace
    const fallbackTarget = "background: isSkladConfirmed ? '#064e3b' : '#1a1a1a'";
    if (content.includes(fallbackTarget)) {
      content = content.replace(targetStr, replacement);
      fs.writeFileSync(masterPath, content, 'utf8');
      console.log('✅ MasterModule_v3.jsx warehouse badge updated successfully via fallback!');
    } else {
      console.log('❌ Could not find warehouse badge pattern in MasterModule_v3.jsx');
    }
  }
}

// 2. Оновлюємо DirectorModule.jsx
const directorPath = 'a:/centrum/src/modules/DirectorModule.jsx';
if (fs.existsSync(directorPath)) {
  let content = fs.readFileSync(directorPath, 'utf8');
  
  // Оновлюємо pendingTasks фільтр (дозволяємо часткове погодження)
  content = content.replace(
    't.warehouse_conf === true && \n    t.engineer_conf === true && \n    !t.director_conf',
    '(t.warehouse_conf === true || t.warehouse_conf === \'partial\') && \n    t.engineer_conf === true && \n    !t.director_conf'
  );
  
  // Оновлюємо кнопку фінального підпису
  content = content.replace(
    'const isSkladOk = task.warehouse_conf === true',
    'const isSkladOk = task.warehouse_conf === true || task.warehouse_conf === \'partial\''
  );
  
  // Оновлюємо відображення статусу в checks-grid
  const checkTargetStr = `                      <div className={\`check-item \${isSkladOk ? \'ok\' : \'pending\'}\`}>
                        <Warehouse size={18} />
                        <span>СКЛАД</span>
                        {isSkladOk && <CheckCircle2 size={12} />}
                      </div>`;
                      
  const checkReplacement = `                      <div className={\`check-item \${task.warehouse_conf === true ? \'ok\' : (task.warehouse_conf === \'partial\' ? \'partial\' : \'pending\')}\`} style={task.warehouse_conf === 'partial' ? { background: 'rgba(234,179,8,0.1)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)' } : {}}>
                        <Warehouse size={18} />
                        <span>{task.warehouse_conf === 'partial' ? 'ЧАСТК. СКЛАД' : 'СКЛАД'}</span>
                        {(task.warehouse_conf === true || task.warehouse_conf === 'partial') && <CheckCircle2 size={12} />}
                      </div>`;
                      
  content = content.replace(checkTargetStr, checkReplacement);
  
  fs.writeFileSync(directorPath, content, 'utf8');
  console.log('✅ DirectorModule.jsx checks and filters updated successfully!');
}
