import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
  console.log('Testing insert of various types into packaging_boxes...')
  
  // Let's test with UUIDs for both order_id and task_id
  const testRow = {
    order_id: '7ffe1c46-e4f7-411d-a081-2146f8b802c6', // UUID
    task_id: 'd80eeaa0-705e-43e7-bf93-ec7c7be63fd4', // UUID
    batch_index: '1',
    box_number: 'BOX-TEST',
    nomenclature_id: 1, // integer
    quantity: 5
  }

  const { data, error } = await supabase.from('packaging_boxes').insert([testRow]).select()
  console.log('Insert result:', { data, error })
}

test()
