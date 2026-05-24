import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
  console.log("Updating existing prep tasks...")
  const { data, error } = await supabase
    .from('tasks')
    .update({ engineer_conf: true, director_conf: true })
    .eq('step', 'Підготовка')
    .select()

  if (error) {
    console.error("Error updating prep tasks:", error)
  } else {
    console.log(`Successfully updated ${data?.length || 0} prep tasks.`)
  }
}

run()
