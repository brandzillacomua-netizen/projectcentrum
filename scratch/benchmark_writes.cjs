const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const run = async () => {
    console.log("Starting DB benchmark...")
    
    // 1. Benchmark tasks select & update
    console.time("Tasks fetch")
    const { data: tasks, error: tErr } = await supabase.from('tasks').select('*').limit(1)
    console.timeEnd("Tasks fetch")
    if (tErr) console.error("Tasks fetch error:", tErr)
    
    if (tasks && tasks[0]) {
      console.time("Tasks update")
      const { error: tUpErr } = await supabase.from('tasks').update({
        good_qty: tasks[0].good_qty
      }).eq('id', tasks[0].id)
      console.timeEnd("Tasks update")
      if (tUpErr) console.error("Tasks update error:", tUpErr)
    }

    // 2. Benchmark inventory fetch & upsert
    console.time("Inventory fetch")
    const { data: inv, error: iErr } = await supabase.from('inventory').select('*').limit(1)
    console.timeEnd("Inventory fetch")
    if (iErr) console.error("Inventory fetch error:", iErr)
    
    if (inv && inv[0]) {
      console.time("Inventory upsert")
      const { error: iUpErr } = await supabase.from('inventory').upsert([inv[0]])
      console.timeEnd("Inventory upsert")
      if (iUpErr) console.error("Inventory upsert error:", iUpErr)
    }

    // 3. Benchmark reception_docs insert
    console.time("Reception docs insert")
    const { data: recDoc, error: rErr } = await supabase.from('reception_docs').insert([{
      items: [{ nomenclature_id: 'dummy', name: 'dummy', qty: 0 }],
      status: 'shipped',
      target_warehouse: 'operational',
      created_at: new Date().toISOString()
    }]).select()
    console.timeEnd("Reception docs insert")
    if (rErr) console.error("Reception docs insert error:", rErr)
    
    if (recDoc && recDoc[0]) {
      // Clean up reception doc
      await supabase.from('reception_docs').delete().eq('id', recDoc[0].id)
    }

    // 4. Benchmark material_requests update
    console.time("Material requests fetch")
    const { data: matReqs, error: mrErr } = await supabase.from('material_requests').select('*').limit(1)
    console.timeEnd("Material requests fetch")
    if (mrErr) console.error("Material requests fetch error:", mrErr)
    
    if (matReqs && matReqs[0]) {
      console.time("Material requests update")
      const { error: mrUpErr } = await supabase.from('material_requests').update({
        status: matReqs[0].status
      }).eq('id', matReqs[0].id)
      console.timeEnd("Material requests update")
      if (mrUpErr) console.error("Material requests update error:", mrUpErr)
    }
  }
  
  run()
} else {
  console.error("Supabase config not found")
}
