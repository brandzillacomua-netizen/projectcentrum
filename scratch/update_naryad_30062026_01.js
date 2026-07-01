import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
})

const runUpdate = async () => {
  try {
    const task1Id = '0457a332-3c8a-4682-ab34-e18ca003137b'
    const task2Id = '50e590b8-3c78-4504-9a88-43f657319f41'
    const partKey = 'dc154eb4-a568-4944-8608-9cb0dae1180e' // KH-10(210)-Х-4-109
    const materialKey = '34f79eca-3fd9-4281-ab69-e123a2005379' // Лист Т300 (4мм)
    const cardId = 'bb2baf58-5f59-4b09-9ab1-a7bb04d03194'
    const matReqId = '7ce92a27-f3dc-4529-b4d9-420a70fd8336'

    console.log("1. Backing up original task snapshots...")
    const { data: t1 } = await supabase.from('tasks').select('*').eq('id', task1Id).single()
    const { data: t2 } = await supabase.from('tasks').select('*').eq('id', task2Id).single()
    
    fs.writeFileSync('a:/centrum/scratch/task1_snapshot_backup.json', JSON.stringify(t1, null, 2))
    fs.writeFileSync('a:/centrum/scratch/task2_snapshot_backup.json', JSON.stringify(t2, null, 2))
    console.log("Backup saved to scratch directory.")

    // --- Modify Task 1 plan_snapshot ---
    console.log("2. Modifying plan_snapshot for Task 1...")
    const snap1 = { ...t1.plan_snapshot }
    if (snap1[partKey]) {
      snap1[partKey] = {
        ...snap1[partKey],
        stock: 1880,
        plan: 4120,
        sheets: 37,
        sheets_t300: 37
      }
    }
    if (snap1.materialSummary?.[materialKey]) {
      snap1.materialSummary[materialKey] = {
        ...snap1.materialSummary[materialKey],
        sheets: 37,
        totalUnits: 4120,
        components: ["KH-10(210)-Х-4-109: 4120шт"]
      }
    }
    const { error: errT1 } = await supabase.from('tasks').update({ plan_snapshot: snap1 }).eq('id', task1Id)
    if (errT1) console.error("Error updating Task 1:", errT1)
    else console.log("Task 1 snapshot updated successfully.")

    // --- Modify Task 2 plan_snapshot ---
    console.log("3. Modifying plan_snapshot for Task 2...")
    const snap2 = { ...t2.plan_snapshot }
    if (snap2[partKey]) {
      snap2[partKey] = {
        ...snap2[partKey],
        stock: 1880,
        plan: 4120,
        sheets: 37,
        sheets_t300: 37
      }
    }
    if (snap2.materialSummary?.[materialKey]) {
      snap2.materialSummary[materialKey] = {
        ...snap2.materialSummary[materialKey],
        sheets: 37,
        totalUnits: 4120,
        components: ["KH-10(210)-Х-4-109: 4120шт"]
      }
    }
    const { error: errT2 } = await supabase.from('tasks').update({ plan_snapshot: snap2 }).eq('id', task2Id)
    if (errT2) console.error("Error updating Task 2:", errT2)
    else console.log("Task 2 snapshot updated successfully.")

    // --- Modify Material Request ---
    console.log("4. Updating material request quantity to 37...")
    const newDetails = "СКЛАД ОПЕРАТИВНИЙ: Лист Т300 (4мм) [Підготовлений] — 37 л. (Разом: 4120 шт | Для: KH-10(210)-Х-4-109: 4120шт)"
    const { error: errMat } = await supabase.from('material_requests').update({
      quantity: 37,
      details: newDetails
    }).eq('id', matReqId)
    if (errMat) console.error("Error updating material request:", errMat)
    else console.log("Material request updated successfully.")

    // --- Modify Work Card ---
    console.log("5. Updating work card to 1880...")
    const { error: errCard } = await supabase.from('work_cards').update({
      quantity: 1880
    }).eq('id', cardId)
    if (errCard) console.error("Error updating work card:", errCard)
    else console.log("Work card updated successfully.")

    // --- Modify Work Card History ---
    console.log("6. Updating work card history to 1880...")
    const { error: errHist } = await supabase.from('work_card_history').update({
      qty_at_start: 1880,
      qty_completed: 1880
    }).eq('card_id', cardId)
    if (errHist) console.error("Error updating work card history:", errHist)
    else console.log("Work card history updated successfully.")

    console.log("\n--- Verification ---")
    const { data: updatedT1 } = await supabase.from('tasks').select('plan_snapshot').eq('id', task1Id).single()
    console.log("Updated Part Snapshot (Task 1):", updatedT1.plan_snapshot?.[partKey])
    console.log("Updated Material Summary (Task 1):", updatedT1.plan_snapshot?.materialSummary?.[materialKey])
    
    const { data: updatedCard } = await supabase.from('work_cards').select('*').eq('id', cardId).single()
    console.log(`Updated Card: Qty: ${updatedCard.quantity}, Status: ${updatedCard.status}, Info: ${updatedCard.card_info}`)

    const { data: updatedReq } = await supabase.from('material_requests').select('*').eq('id', matReqId).single()
    console.log(`Updated Request: Qty: ${updatedReq.quantity}, Details: ${updatedReq.details}`)

    const { data: updatedHist } = await supabase.from('work_card_history').select('*').eq('card_id', cardId)
    console.log(`Updated History record counts: ${updatedHist?.length}. Values:`, updatedHist.map(h => ({ start: h.qty_at_start, comp: h.qty_completed })))
    
  } catch (e) {
    console.error(e)
  }
}

runUpdate()
