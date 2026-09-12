import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hurzutjytlcvtbvihnry.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function testQuery() {
  const url = `${SUPABASE_URL}/rest/v1/tasks?select=*&updated_at=gt.2026-09-12T18%3A38%3A10.152Z`
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  })
  
  console.log('Status:', res.status)
  const body = await res.text()
  console.log('Body:', body)
}

testQuery()
