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

const check = async () => {
  try {
    const taskId = '0457a332-3c8a-4682-ab34-e18ca003137b'
    const { data: requests } = await supabase.from('material_requests').select('*').eq('task_id', taskId)
    requests.forEach(r => {
      console.log(`Req ID: ${r.id}, Nom: ${r.nomenclature_id}, Qty: ${r.quantity}, Details: ${r.details}`)
    })
  } catch (e) {
    console.error(e)
  }
}

check()
