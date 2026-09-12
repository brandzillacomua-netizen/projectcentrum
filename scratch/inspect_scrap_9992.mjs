const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const headers = {
  'apikey': supabaseAnonKey,
  'Authorization': `Bearer ${supabaseAnonKey}`,
  'x-mes-secret': 'REVOKED_MES_SECRET_DO_NOT_USE',
  'Content-Type': 'application/json'
}

async function run() {
  console.log("=== INSPECTING INVENTORY FOR KR-385-П-10-28 ===")
  const res = await fetch(`${supabaseUrl}/rest/v1/inventory?nomenclature_id=eq.2f2969aa-c07e-46cf-95b4-ff532e8022cc`, { headers })
  console.log("Status:", res.status, res.statusText)
  const rows = await res.json()
  console.log("Inventory rows for KR-385-П-10-28:", JSON.stringify(rows, null, 2))

  const allScrapRes = await fetch(`${supabaseUrl}/rest/v1/inventory?type=in.(scrap_cat_1,scrap_cat_2,scrap_cat_3)`, { headers })
  const allScrap = await allScrapRes.json()
  console.log(`Total scrap_cat_1/2/3 rows: ${allScrap.length}`)
  console.log("Scrap rows:", JSON.stringify(allScrap, null, 2))
}

run().catch(err => console.error(err))
