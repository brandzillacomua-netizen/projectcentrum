const fs = require('fs');
const path = 'a:/centrum/src/modules/PackagingModule.jsx';

let content = fs.readFileSync(path, 'utf8');

// 1. Destructure inventory from useMES()
const target1 = `  const {
    orders, tasks, nomenclatures, bomItems,
    submitPickingRequest, requests, supabase,
    fetchData, completePackaging, systemUsers
  } = useMES()`;

const replacement1 = `  const {
    orders, tasks, nomenclatures, bomItems,
    submitPickingRequest, requests, supabase,
    fetchData, completePackaging, systemUsers,
    inventory
  } = useMES()`;

// 2. Replace material display with free balance in search results list
const target2 = `                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#e2e8f0', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nom.name}</div>
                        <div style={{ fontSize: '0.65rem', color: '#3a5a6a', fontWeight: 600, marginTop: '2px' }}>
                          {nom.nomenclature_code && <span style={{ marginRight: '8px', color: '#4a8a9a' }}>Код: {nom.nomenclature_code}</span>}
                          {nom.material_type && <span style={{ color: '#ec4899', marginRight: '8px' }}>Матеріал: {nom.material_type}</span>}
                          {nom.description && <span style={{ color: '#06b6d4', marginRight: '8px' }}>{nom.description}</span>}
                          {nom.aliases && <span style={{ color: '#2a5a6a', marginLeft: '6px', fontStyle: 'italic' }}>{nom.aliases}</span>}
                        </div>
                      </div>`;

const replacement2 = `                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#e2e8f0', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nom.name}</div>
                        <div style={{ fontSize: '0.65rem', color: '#3a5a6a', fontWeight: 600, marginTop: '2px' }}>
                          {nom.nomenclature_code && <span style={{ marginRight: '8px', color: '#4a8a9a' }}>Код: {nom.nomenclature_code}</span>}
                          <span style={{ color: '#ec4899', marginRight: '8px' }}>
                            Вільний залишок: {(() => {
                              const items = (inventory || []).filter(i => String(i.nomenclature_id) === String(nom.id));
                              const total = items.reduce((acc, cur) => acc + (Number(cur.total_qty) || 0), 0);
                              const reserved = items.reduce((acc, cur) => acc + (Number(cur.reserved_qty) || 0), 0);
                              return total - reserved;
                            })()} шт.
                          </span>
                          {nom.description && <span style={{ color: '#06b6d4', marginRight: '8px' }}>{nom.description}</span>}
                          {nom.aliases && <span style={{ color: '#2a5a6a', marginLeft: '6px', fontStyle: 'italic' }}>{nom.aliases}</span>}
                        </div>
                      </div>`;

// 3. Replace material display with free balance in selected item card
const target3 = `                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{addItemSelectedNom.name}</div>
                    <div style={{ fontSize: '0.65rem', color: '#06b6d4', fontWeight: 700, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {addItemSelectedNom.nomenclature_code && <span>Код: {addItemSelectedNom.nomenclature_code}</span>}
                      {addItemSelectedNom.material_type && <span style={{ color: '#ec4899' }}>Матеріал: {addItemSelectedNom.material_type}</span>}
                      {addItemSelectedNom.description && <span style={{ color: '#a0aec0' }}>{addItemSelectedNom.description}</span>}
                    </div>
                  </div>`;

const replacement3 = `                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{addItemSelectedNom.name}</div>
                    <div style={{ fontSize: '0.65rem', color: '#06b6d4', fontWeight: 700, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {addItemSelectedNom.nomenclature_code && <span>Код: {addItemSelectedNom.nomenclature_code}</span>}
                      <span style={{ color: '#ec4899' }}>
                        Вільний залишок: {(() => {
                          const items = (inventory || []).filter(i => String(i.nomenclature_id) === String(addItemSelectedNom.id));
                          const total = items.reduce((acc, cur) => acc + (Number(cur.total_qty) || 0), 0);
                          const reserved = items.reduce((acc, cur) => acc + (Number(cur.reserved_qty) || 0), 0);
                          return total - reserved;
                        })()} шт.
                      </span>
                      {addItemSelectedNom.description && <span style={{ color: '#a0aec0' }}>{addItemSelectedNom.description}</span>}
                    </div>
                  </div>`;

let success = true;

if (content.includes(target1)) {
  content = content.replace(target1, replacement1);
  console.log('SUCCESS: Target 1 replaced');
} else {
  console.error('ERROR: Target 1 not found');
  success = false;
}

if (content.includes(target2)) {
  content = content.replace(target2, replacement2);
  console.log('SUCCESS: Target 2 replaced');
} else {
  console.error('ERROR: Target 2 not found');
  success = false;
}

if (content.includes(target3)) {
  content = content.replace(target3, replacement3);
  console.log('SUCCESS: Target 3 replaced');
} else {
  console.error('ERROR: Target 3 not found');
  success = false;
}

if (success) {
  fs.writeFileSync(path, content, 'utf8');
  console.log('SUCCESS: All patches written!');
}
