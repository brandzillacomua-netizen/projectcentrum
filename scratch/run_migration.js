async function main() {
  // Step 1: cleanup test rows
  const sql1 = "DELETE FROM packaging_boxes WHERE box_number IN ('TEST', 'TEST2')"
  const sql2 = "ALTER TABLE packaging_boxes ALTER COLUMN nomenclature_id TYPE uuid USING nomenclature_id::text::uuid"
  
  for (const sql of [sql1, sql2]) {
    const response = await fetch('https://api.supabase.com/v1/projects/hurzutjytlcvtbvihnry/database/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (process.env.SUPABASE_ACCESS_TOKEN || 'YOUR_ACCESS_TOKEN')
      },
      body: JSON.stringify({ query: sql })
    })
    
    const text = await response.text()
    console.log('SQL:', sql.substring(0, 60))
    console.log('Status:', response.status)
    console.log('Response:', text)
    console.log('---')
  }
}
main().catch(console.error)
