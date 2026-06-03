import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function check() {
  const { data: subs, error: err1 } = await supabase.from('push_subscriptions').select('id, user_id, device_info, endpoint, created_at, updated_at')
  if (err1) {
    console.error('Error fetching subscriptions:', err1)
  } else {
    console.log('--- PUSH SUBSCRIPTIONS ---')
    subs.forEach(s => {
      console.log(`SubID: ${s.id}, UserID: ${s.user_id}, Device: ${s.device_info?.substring(0, 50)}, Updated: ${s.updated_at}`)
    })
  }
}

check()
