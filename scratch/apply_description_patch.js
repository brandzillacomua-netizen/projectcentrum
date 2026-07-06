const fs = require('fs');
const path = 'a:/centrum/src/modules/PackagingModule.jsx';

let content = fs.readFileSync(path, 'utf8');

const target = `                                          <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                              {item.nom.name}
                                              {item.nom.material_type && <span style={{ fontSize: '0.7rem', color: '#666', marginLeft: '5px', fontWeight: 500 }}>{item.nom.material_type}</span>}
                                            </div>
                                            <div style={{ fontSize: '0.6rem', color: isExcluded ? '#555' : (isPicked ? '#10b981' : (isPending ? '#eab308' : (item.isCustom ? '#06b6d4' : '#444'))), fontWeight: 900, textTransform: 'uppercase', marginTop: '2px' }}>`;

const replacement = `                                          <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                              {item.nom.name}
                                              {item.nom.material_type && <span style={{ fontSize: '0.7rem', color: '#666', marginLeft: '5px', fontWeight: 500 }}>{item.nom.material_type}</span>}
                                            </div>
                                            {item.nom.description && (
                                              <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '2px', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.nom.description}>
                                                {item.nom.description}
                                              </div>
                                            )}
                                            <div style={{ fontSize: '0.6rem', color: isExcluded ? '#555' : (isPicked ? '#10b981' : (isPending ? '#eab308' : (item.isCustom ? '#06b6d4' : '#444'))), fontWeight: 900, textTransform: 'uppercase', marginTop: '2px' }}>`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(path, content, 'utf8');
  console.log('SUCCESS: Patch applied successfully!');
} else {
  console.error('ERROR: Target sequence not found in the file!');
  // Let's print out what is around lines 900-915 in the file to see whitespace
  const lines = content.split('\n');
  for (let i = 900; i < 915; i++) {
    console.log(`${i}: ${JSON.stringify(lines[i])}`);
  }
}
