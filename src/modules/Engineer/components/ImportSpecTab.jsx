import React, { useState } from 'react'
import { FileUp, Clock, Loader2 } from 'lucide-react'
import { useMES } from '../../../MESContext'

export function ImportSpecTab() {
  const { nomenclatures, bomItems, supabase, refreshTable } = useMES()
  const [importLogs, setImportLogs] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)

  const parseSpecCSV = (text) => {
    const cleanedText = text.replace(/"([^"]*)"/g, (m, p1) => `"${p1.replace(/\r?\n/g, ' ')}"`)
    const lines = cleanedText.split(/\r?\n/).filter(line => line.trim() !== '')
    if (lines.length === 0) return null

    let specName = 'Нова специфікація'
    const firstLineMatch = lines[0].match(/Специфікація\s+(.*)/i)
    if (firstLineMatch) {
      let content = firstLineMatch[1].trim()
      content = content.replace(/,+$/, '').trim()
      while (content.startsWith('"') || content.endsWith('"')) {
        if (content.startsWith('"')) content = content.substring(1)
        if (content.endsWith('"')) content = content.slice(0, -1)
        content = content.trim()
      }
      content = content.replace(/""/g, '"')
      if (content) specName = content
    }

    const result = { productName: specName, components: [] }
    let currentCategory = 'structural'
    let currentGroupLabel = 'Деталі' 

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.trim().replace(/^"|"$/g, ''))
      const isHeader = !cols[0] || isNaN(parseInt(cols[0]))
      if (isHeader) {
        if (line.includes('Метизи'))      { currentCategory = 'fastener'; currentGroupLabel = 'Метизи';        continue }
        if (line.includes('Стійки'))      { currentCategory = 'hardware'; currentGroupLabel = 'Стійки';        continue }
        if (line.includes('Накладки') || line.includes('Наклад')) { currentCategory = 'hardware'; currentGroupLabel = 'Накладки'; continue }
        if (line.includes('Тримач'))      { currentCategory = 'hardware'; currentGroupLabel = 'Накладки';        continue }
        if (line.includes('Гума') || line.includes('Пластик') || line.includes('ПВХ')) { currentCategory = 'hardware'; currentGroupLabel = 'Гума/Пластик'; continue }
        if (line.includes('3D') || line.includes('3д') || line.includes('друк')) { currentCategory = 'hardware'; currentGroupLabel = '3D-друк'; continue }
        if (line.includes('Фурнітура') || line.includes('Фурніт'))       { currentCategory = 'hardware'; currentGroupLabel = 'Фурнітура';       continue }
        if (line.includes('Комплект'))    { currentCategory = 'hardware'; currentGroupLabel = 'Комплектуючі';   continue }
      }
      const indexNum = parseInt(cols[0])
      if (!isNaN(indexNum) && cols[1]) {
        const desc = cols[3] || ''
        let thickness = ''; let unitsPerSheet = 0
        const thickMatch = desc.match(/(\d+(?:\.\d+)?)\s*мм/i); if (thickMatch) thickness = thickMatch[1]
        const unitsMatch = desc.match(/(\d+)\s*шт/i); if (unitsMatch) unitsPerSheet = parseInt(unitsMatch[1])
        result.components.push({
          name: cols[1], characteristics: cols[2], description: desc,
          qtyPerOne: parseFloat(cols[4]) || 1, category: currentCategory,
          groupLabel: currentGroupLabel,
          thickness, unitsPerSheet
        })
      }
    }
    return result
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    setIsProcessing(true)
    setImportLogs(['⏳ Зчитування файлу...'])
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const text = event.target.result
        const parsed = parseSpecCSV(text)
        if (!parsed || !parsed.productName) throw new Error('Не вдалося розпізнати назву виробу')
        setImportLogs(prev => [...prev, `📦 Знайдено виріб: ${parsed.productName}`, `🧩 Складових частин: ${parsed.components.length}`])

        const normalizeHomoglyphs = (str) => {
          if (!str) return ''
          const mapper = { 'а': 'a', 'в': 'b', 'с': 'c', 'е': 'e', 'н': 'h', 'к': 'k', 'м': 'm', 'о': 'o', 'р': 'p', 'т': 't', 'х': 'x', 'у': 'y', 'і': 'i', 'ї': 'i' }
          return str.toLowerCase().trim().split('').map(c => mapper[c] || c).join('').replace(/[^a-z0-9]/g, '')
        }

        const localNoms = [...nomenclatures]
        const createdBOM = []

        for (const comp of parsed.components) {
          const nameLower = comp.name.toLowerCase()
          const charLower = (comp.characteristics || '').toLowerCase()
          const fullName = charLower.includes(nameLower)
            ? comp.characteristics
            : (comp.characteristics ? `${comp.name} ${comp.characteristics}` : comp.name)

          setImportLogs(prev => [...prev, `🔍 Обробка: ${fullName}...`])
          let materialType = comp.category === 'structural' && comp.thickness ? `Лист Т300 (${comp.thickness}мм)` : ''

          if (comp.category === 'structural' && comp.thickness) {
            const thickStr = `${comp.thickness}мм`
            const rawName = `Лист Т300 (${thickStr}) [Непідготовлений]`
            const prepName = `Лист Т300 (${thickStr}) [Підготовлений]`

            let rawNom = localNoms.find(n => n.name === rawName)
            if (!rawNom) {
              const { data: rawData, error: rawErr } = await supabase.from('nomenclatures').insert([{ name: rawName, material_type: thickStr, type: 'raw' }]).select().single()
              if (!rawErr && rawData) { rawNom = rawData; localNoms.push(rawData) }
            }
            let prepNom = localNoms.find(n => n.name === prepName)
            if (!prepNom) {
              const { data: prepData, error: prepErr } = await supabase.from('nomenclatures').insert([{ name: prepName, material_type: thickStr, type: 'raw' }]).select().single()
              if (!prepErr && prepData) { prepNom = prepData; localNoms.push(prepData) }
            }
            if (rawNom && prepNom) {
              await supabase.from('bom_items').delete().eq('parent_id', prepNom.id)
              await supabase.from('bom_items').insert([{ parent_id: prepNom.id, child_id: rawNom.id, quantity_per_parent: 1 }])
            }
          }

          const payload = {
            name: fullName,
            type: comp.category === 'structural' ? 'part' : 'hardware',
            material_type: materialType,
            units_per_sheet: comp.category === 'structural' ? (comp.unitsPerSheet || 0) : 0,
            characteristic: comp.characteristics || '',
            description: comp.description || comp.characteristics || '',
            qty_per_unit: Number(comp.qtyPerOne) || 0
          }

          const normalizedFullName = normalizeHomoglyphs(fullName)
          const existing = localNoms.find(n => normalizeHomoglyphs(n.name) === normalizedFullName)
          if (existing) payload.id = existing.id

          const { data: upserted, error } = await supabase.from('nomenclatures').upsert([payload]).select()
          if (error) throw error
          if (upserted && upserted[0]) {
            if (!existing) localNoms.push(upserted[0])
            createdBOM.push({ child_id: upserted[0].id, qty: comp.qtyPerOne, groupLabel: comp.groupLabel || 'Деталі' })
          }
        }

        const existingParent = localNoms.find(n => n.name === parsed.productName)
        const parentPayload = { name: parsed.productName, type: 'product', material_type: 'Збірка' }
        if (existingParent) parentPayload.id = existingParent.id

        const { data: pData, error: pErr } = await supabase.from('nomenclatures').upsert([parentPayload]).select()
        if (pErr) throw pErr

        if (pData && pData[0]) {
          const parentId = pData[0].id
          const aggregatedBOM = []
          createdBOM.forEach(item => {
            const ex = aggregatedBOM.find(it => it.child_id === item.child_id)
            if (ex) ex.qty += item.qty
            else aggregatedBOM.push({ ...item })
          })

          await supabase.from('bom_items').delete().eq('parent_id', parentId)
          const bomRows = aggregatedBOM.map(r => ({ parent_id: parentId, child_id: r.child_id, quantity_per_parent: r.qty, group_label: r.groupLabel || 'Деталі' }))
          if (bomRows.length > 0) await supabase.from('bom_items').insert(bomRows)
          setImportLogs(prev => [...prev, `✅ ІМПОРТ ЗАВЕРШЕНО УСПІШНО!`, `🎉 Виріб готовий до використання.`])
        }

        await refreshTable('nomenclatures')
        await refreshTable('bom_items')
      } catch (err) {
        setImportLogs(prev => [...prev, `❌ Помилка: ${err.message}`])
      } finally {
        setIsProcessing(false)
      }
    }
    reader.readAsText(file)
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ background: '#0d0d0d', border: '2px dashed #1e3a1e', borderRadius: '24px', padding: '40px', textAlign: 'center', marginBottom: '24px' }}>
        <FileUp size={48} color="#10b981" style={{ marginBottom: '16px', opacity: 0.6 }} />
        <h2 style={{ margin: '0 0 8px', fontSize: '1.4rem', fontWeight: 900, color: '#fff' }}>Імпорт специфікацій CSV</h2>
        <p style={{ color: '#555', marginBottom: '28px', fontSize: '0.9rem', lineHeight: 1.5 }}>
          Завантажте CSV-файл специфікації.<br/>
          Система автоматично створить виріб, всі компоненти та зв'язки BOM.
        </p>
        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: '10px',
          background: isProcessing ? '#111' : 'linear-gradient(135deg, #059669, #10b981)',
          color: isProcessing ? '#555' : '#fff',
          padding: '14px 32px', borderRadius: '14px',
          fontWeight: 900, cursor: isProcessing ? 'not-allowed' : 'pointer',
          fontSize: '0.9rem', letterSpacing: '0.5px',
          boxShadow: isProcessing ? 'none' : '0 8px 24px rgba(16,185,129,0.3)',
          transition: 'all 0.3s'
        }}>
          {isProcessing ? <Loader2 size={20} className="anim-spin" /> : <FileUp size={20} />}
          {isProcessing ? 'ОБРОБКА...' : 'ОБРАТИ ФАЙЛ СПЕЦИФІКАЦІЇ'}
          <input type="file" accept=".csv" hidden onChange={handleFileUpload} disabled={isProcessing} />
        </label>
      </div>

      {importLogs.length > 0 && (
        <div style={{ background: '#060606', border: '1px solid #111', borderRadius: '16px', padding: '20px', maxHeight: '420px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h4 style={{ margin: 0, color: '#444', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 900 }}>
              <Clock size={14} /> Лог імпорту
            </h4>
            {!isProcessing && (
              <button onClick={() => setImportLogs([])} style={{ background: 'transparent', border: 'none', color: '#333', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800 }}>ОЧИСТИТИ</button>
            )}
          </div>
          {importLogs.map((log, i) => (
            <div key={i} style={{
              fontSize: '0.8rem', padding: '7px 0',
              borderBottom: '1px solid #0d0d0d',
              color: log.includes('✅') || log.includes('🎉') ? '#10b981' : log.includes('❌') ? '#ef4444' : log.includes('📦') || log.includes('✨') ? '#f59e0b' : '#555',
              fontWeight: log.includes('✅') || log.includes('❌') || log.includes('📦') || log.includes('✨') ? 800 : 400,
              fontFamily: 'monospace'
            }}>
              {log}
            </div>
          ))}
        </div>
      )}
      <style dangerouslySetInnerHTML={{ __html: '.anim-spin { animation: spin 1s linear infinite; } @keyframes spin { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }' }} />
    </div>
  )
}
