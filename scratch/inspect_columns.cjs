const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

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
    const { data: noms, error } = await supabase
      .from('nomenclatures')
      .select('*')
      .limit(1)
    
    if (noms && noms[0]) {
      console.log("Nomenclature columns:", Object.keys(noms[0]))
      console.log("Sample nomenclature:", JSON.stringify(noms[0], null, 2))
    } else {
      console.log("Error:", error)
    }
  } catch(e) {
    console.error(e)
  }
}

check()
