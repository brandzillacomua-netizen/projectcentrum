import fs from 'fs'

const files = [
  'b:/kylutsya/src/modules/EngineerModule.jsx',
  'b:/kylutsya/src/modules/EngineerV2Module.jsx'
]

files.forEach(targetPath => {
  if (!fs.existsSync(targetPath)) return
  let code = fs.readFileSync(targetPath, 'utf8')

  // 1. Add catalogFolder state
  if (!code.includes('const [catalogFolder, setCatalogFolder] = useState')) {
    code = code.replace(
      /const \[catalogSearch, setCatalogSearch\] = useState\(''\)/,
      `const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogFolder, setCatalogFolder] = useState('all') // 'all' | 'grp_production_frames' | 'grp_test_samples' | 'grp_assemblies'
  const [collapsedFolders, setCollapsedFolders] = useState({})`
    )
  }

  // 2. Helper to determine item folder key
  if (!code.includes('const getItemFolderKey =')) {
    const helperCode = `
  const getItemFolderKey = (nom) => {
    if (!nom) return 'grp_production_frames'
    const gId = nom.group_id
    const name = (nom.name || '').toLowerCase()
    const cat = (nom.category || '').toLowerCase()
    if (gId === 'grp_test_samples' || cat.includes('тестов') || name.includes('тестовий') || name.includes('тест')) {
      return 'grp_test_samples'
    }
    if (nom.type === 'assembly' || gId === 'grp_assemblies' || cat.includes('вузол')) {
      return 'grp_assemblies'
    }
    return 'grp_production_frames'
  }

  const folderCounts = useMemo(() => {
    const counts = { all: catalogParents.length, grp_production_frames: 0, grp_test_samples: 0, grp_assemblies: 0 }
    catalogParents.forEach(({ nom }) => {
      const key = getItemFolderKey(nom)
      counts[key] = (counts[key] || 0) + 1
    })
    return counts
  }, [catalogParents])

  const filteredCatalogParents = useMemo(() => {
    if (catalogFolder === 'all') return catalogParents
    return catalogParents.filter(({ nom }) => getItemFolderKey(nom) === catalogFolder)
  }, [catalogParents, catalogFolder])
`
    code = code.replace(
      /const catalogParents = useMemo\(\(\) => \{/,
      `${helperCode}\n  const catalogParents = useMemo(() => {`
    )
  }

  // 3. Update CATALOG VIEW render block
  const oldCatalogViewMarker = `/* ── CATALOG VIEW ── */`
  const newCatalogViewBlock = `/* ── CATALOG VIEW (FOLDERS STRUCTURE) ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Folder Navigation Pills Bar */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', background: 'var(--card-bg, #ffffff)', padding: '12px 16px', borderRadius: '16px', border: '1px solid var(--border-color, #cbd5e1)', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', marginRight: '6px' }}>Папки v2.0:</span>
            
            <button
              onClick={() => setCatalogFolder('all')}
              style={{
                padding: '7px 14px',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '0.8rem',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: catalogFolder === 'all' ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--button-bg, #f8fafc)',
                color: catalogFolder === 'all' ? '#ffffff' : 'var(--text-main, #0f172a)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s'
              }}
            >
              📁 Усі позиції ({folderCounts.all})
            </button>

            <button
              onClick={() => setCatalogFolder('grp_production_frames')}
              style={{
                padding: '7px 14px',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '0.8rem',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: catalogFolder === 'grp_production_frames' ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--button-bg, #f8fafc)',
                color: catalogFolder === 'grp_production_frames' ? '#ffffff' : 'var(--text-main, #0f172a)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s'
              }}
            >
              🚀 Продакшн ({folderCounts.grp_production_frames})
            </button>

            <button
              onClick={() => setCatalogFolder('grp_test_samples')}
              style={{
                padding: '7px 14px',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '0.8rem',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: catalogFolder === 'grp_test_samples' ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--button-bg, #f8fafc)',
                color: catalogFolder === 'grp_test_samples' ? '#ffffff' : 'var(--text-main, #0f172a)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s'
              }}
            >
              🧪 Тестові зразки ({folderCounts.grp_test_samples})
            </button>

            <button
              onClick={() => setCatalogFolder('grp_assemblies')}
              style={{
                padding: '7px 14px',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '0.8rem',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: catalogFolder === 'grp_assemblies' ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--button-bg, #f8fafc)',
                color: catalogFolder === 'grp_assemblies' ? '#ffffff' : 'var(--text-main, #0f172a)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s'
              }}
            >
              📦 Вузли збірки ({folderCounts.grp_assemblies})
            </button>
          </div>

          {/* Search bar */}
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} size={16}/>
            <input
              value={catalogSearch}
              onChange={e => setCatalogSearch(e.target.value)}
              placeholder="Пошук специфікації за назвою виробу..."
              style={{ width: '100%', padding: '12px 15px 12px 42px', background: 'var(--input-bg, #ffffff)', border: '1px solid var(--border-color, #cbd5e1)', color: 'var(--text-main, #0f172a)', borderRadius: '12px', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>

          {/* Render Items by Folders */}
          {filteredCatalogParents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted, #64748b)' }}>
              <BookOpen size={56} style={{ marginBottom: '15px', opacity: 0.15 }}/>
              <p style={{ fontSize: '1rem', fontWeight: 700 }}>У цій папці специфікацій не знайдено</p>
            </div>
          ) : (() => {
            // Group catalogParents into folder buckets
            const FOLDER_DEFINITIONS = [
              { key: 'grp_production_frames', label: '🚀 Продакшн (Серійні рами)', color: '#d97706', bg: 'rgba(217,119,6,0.06)', border: 'rgba(217,119,6,0.25)' },
              { key: 'grp_test_samples', label: '🧪 Тестові зразки (Прототипи та RND)', color: '#7c3aed', bg: 'rgba(124,58,237,0.06)', border: 'rgba(124,58,237,0.25)' },
              { key: 'grp_assemblies', label: '📦 Вузли збірки (Підвузли)', color: '#2563eb', bg: 'rgba(37,99,235,0.06)', border: 'rgba(37,99,235,0.25)' }
            ]

            const folderMap = {}
            filteredCatalogParents.forEach(item => {
              const fKey = getItemFolderKey(item.nom)
              if (!folderMap[fKey]) folderMap[fKey] = []
              folderMap[fKey].push(item)
            })

            const activeFolders = FOLDER_DEFINITIONS.filter(fd => (folderMap[fd.key] || []).length > 0)

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {activeFolders.map(folder => {
                  const folderItems = folderMap[folder.key] || []
                  const isCollapsed = !!collapsedFolders[folder.key]

                  return (
                    <div 
                      key={folder.key}
                      style={{ 
                        background: 'var(--card-bg, #ffffff)', 
                        border: \`1px solid \${folder.border}\`, 
                        borderRadius: '18px', 
                        overflow: 'hidden',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.03)'
                      }}
                    >
                      {/* Folder Card Header */}
                      <div 
                        onClick={() => setCollapsedFolders(prev => ({ ...prev, [folder.key]: !prev[folder.key] }))}
                        style={{ 
                          padding: '14px 20px', 
                          background: folder.bg, 
                          borderBottom: isCollapsed ? 'none' : \`1px solid \${folder.border}\`,
                          display: 'flex', 
                          justify: 'space-between', 
                          alignItems: 'center', 
                          cursor: 'pointer',
                          userSelect: 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '1.05rem', fontWeight: 950, color: folder.color }}>{folder.label}</span>
                          <span style={{ fontSize: '0.7rem', fontWeight: 900, background: folder.color, color: '#ffffff', padding: '2px 9px', borderRadius: '12px' }}>
                            {folderItems.length} позицій
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: folder.color, fontWeight: 800, fontSize: '0.8rem' }}>
                          <span>{isCollapsed ? 'Показати' : 'Згорнути'}</span>
                          {isCollapsed ? <ChevronDown size={18} /> : <ChevronRight size={18} style={{ transform: 'rotate(90deg)' }} />}
                        </div>
                      </div>

                      {/* Folder Items List */}
                      {!isCollapsed && (
                        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {folderItems.map(({ nom, children }) => {
                            const isExpanded = expandedParents[nom.id]
                            const isEmpty = children.length === 0

                            return (
                              <div
                                key={nom.id}
                                style={{
                                  background: 'var(--card-bg, #ffffff)',
                                  border: isEmpty ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--border-color, #e2e8f0)',
                                  boxShadow: isEmpty ? '0 4px 16px rgba(239, 68, 68, 0.08)' : '0 2px 10px rgba(0,0,0,0.03)',
                                  borderRadius: '14px',
                                  overflow: 'hidden',
                                  transition: 'all 0.2s'
                                }}
                              >
                                <div
                                  onClick={() => {
                                    if (isEmpty) {
                                      setParentId(nom.id)
                                      setViewMode('editor')
                                    } else {
                                      setDossierParentId(nom.id)
                                      setViewMode('dossier')
                                    }
                                  }}
                                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', cursor: 'pointer', transition: 'background 0.2s' }}
                                  onMouseEnter={e => e.currentTarget.style.background = isEmpty ? 'rgba(239, 68, 68, 0.06)' : 'var(--button-bg, #f8fafc)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                    <Package size={16} color={isEmpty ? '#ef4444' : '#6366f1'} />
                                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main, #0f172a)' }}>{nom.name}</span>
                                    <span style={{ fontSize: '0.65rem', color: TYPE_COLORS[nom.type] || '#888', fontWeight: 900, background: (TYPE_COLORS[nom.type] || '#555') + '22', padding: '2px 8px', borderRadius: '20px' }}>
                                      {TYPE_LABELS[nom.type] || nom.type}
                                    </span>
                                    {isEmpty && (
                                      <span style={{
                                        fontSize: '0.65rem',
                                        color: '#dc2626',
                                        fontWeight: 900,
                                        background: '#fee2e2', 
                                        border: '1px solid #fca5a5',
                                        padding: '3px 10px',
                                        borderRadius: '20px',
                                        letterSpacing: '0.5px',
                                        textTransform: 'uppercase',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px'
                                      }}>
                                        <AlertCircle size={11} /> ПОРОЖНЯ
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ fontSize: '0.75rem', color: isEmpty ? '#dc2626' : 'var(--text-muted, #64748b)', fontWeight: isEmpty ? 900 : 700 }}>
                                      {isEmpty ? '0 позицій (ПОРОЖНЯ)' : \`\${children.length} позицій\`}
                                    </span>

                                    {!isEmpty && (
                                      <button
                                        onClick={e => { e.stopPropagation(); setDossierParentId(nom.id); setViewMode('dossier') }}
                                        style={{ padding: '5px 12px', background: 'rgba(99,102,241,0.1)', border: '1px solid #6366f133', color: '#818cf8', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}
                                      >
                                        <Layers size={11}/> Досьє виробу
                                      </button>
                                    )}

                                    <button
                                      onClick={e => { e.stopPropagation(); setParentId(nom.id); setViewMode('editor') }}
                                      style={{
                                        padding: '6px 14px',
                                        background: isEmpty ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--button-bg, #f1f5f9)',
                                        border: isEmpty ? 'none' : '1px solid var(--border-color, #cbd5e1)',
                                        color: isEmpty ? '#ffffff' : 'var(--text-main, #0f172a)',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '0.7rem',
                                        fontWeight: 900,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px'
                                      }}
                                    >
                                      <Edit2 size={11}/> {isEmpty ? '+ Наповнити специфікацію' : 'Конструктор'}
                                    </button>

                                    <button
                                      onClick={async e => {
                                        e.stopPropagation()
                                        if (!confirm(\`Видалити позицію та специфікацію «\${nom.name}»?\`)) return
                                        try {
                                          await supabase.from('bom_items').delete().eq('parent_id', nom.id)
                                          await supabase.from('nomenclature_catalog_profiles').delete().eq('nomenclature_id', nom.id)
                                          await supabase.from('nomenclatures_v2').delete().eq('id', nom.id)

                                          await refreshTable('bom_items')
                                          await refreshTable('nomenclatures')
                                        } catch (err) {
                                          alert('Помилка видалення: ' + err.message)
                                        }
                                      }}
                                      title="Видалити позицію з системи"
                                      style={{ padding: '5px 8px', background: 'rgba(239,68,68,0.06)', border: '1px solid #ef444420', color: '#ef4444', borderRadius: '6px', cursor: 'pointer' }}
                                    >
                                      <Trash2 size={12}/>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>`

  const catalogStartIdx = code.indexOf(oldCatalogViewMarker)
  const catalogEndIdx = code.indexOf(') : null', catalogStartIdx) !== -1 ? code.indexOf(') : null', catalogStartIdx) : code.lastIndexOf('</div>\n  )\n}')

  if (catalogStartIdx !== -1) {
    // Replace catalog section
    const parts = code.split(oldCatalogViewMarker)
    if (parts.length >= 2) {
      // Find end of CATALOG VIEW (closing bracket for viewMode === 'catalog')
      const sub = parts[1]
      const endMarker = `/* ── NOM QUICK-CREATE MODAL`
      const catalogContentEnd = sub.indexOf(endMarker) !== -1 ? sub.indexOf(endMarker) : sub.lastIndexOf('</div>\n      )')
      
      if (catalogContentEnd !== -1) {
        code = parts[0] + newCatalogViewBlock + '\n\n' + sub.substring(catalogContentEnd)
        fs.writeFileSync(targetPath, code, 'utf8')
        console.log(`Successfully added Catalog Folders Structure to ${targetPath}!`)
      }
    }
  }
})
