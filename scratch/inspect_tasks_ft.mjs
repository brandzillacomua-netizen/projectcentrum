import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function inspectTasksAndWorkCards() {
  const { data: tasks, error: tErr } = await supabase.from('tasks').select('*').limit(200)
  console.log('Tasks count in DB:', tasks?.length, 'Error:', tErr)

  const ftTasks = tasks?.filter(t => {
    const str = JSON.stringify(t).toUpperCase()
    return str.includes('FT') || str.includes('ФТ') || str.includes('260827')
  })
  console.log('FT tasks count:', ftTasks?.length)
  console.log('Sample FT task:', ftTasks?.[0])

  const { data: workCards, error: wcErr } = await supabase.from('work_cards').select('*').limit(200)
  console.log('WorkCards count in DB:', workCards?.length, 'Error:', wcErr)
  const ftWorkCards = workCards?.filter(wc => {
    const str = JSON.stringify(wc).toUpperCase()
    return str.includes('FT') || str.includes('ФТ') || str.includes('260827')
  })
  console.log('FT work_cards count:', ftWorkCards?.length)
}

inspectTasksAndWorkCards().catch(console.error)
