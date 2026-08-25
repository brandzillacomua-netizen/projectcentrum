import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
})

function getAssignees(task) {
  if (Array.isArray(task?.assignees) && task.assignees.length > 0) return task.assignees
  if (task?.assigned_to) return [task.assigned_to]
  return []
}

function getChecklistAssignees(item) {
  if (Array.isArray(item?.assignees) && item.assignees.length > 0) return item.assignees
  if (item?.assigned_to) return [item.assigned_to]
  return []
}

function isTaskRelevantToUser(task, user) {
  if (!user || !task) return false
  const login = user.login
  if (task.created_by === login) return true
  if (getAssignees(task).includes(login)) return true
  if (Array.isArray(task.checklist) && task.checklist.some(item => getChecklistAssignees(item).includes(login))) return true
  if (task.is_collective) {
    if (task.department === 'all' || task.department === user.department) return true
  }
  return false
}

async function run() {
  const { data: users } = await supabase.from('system_users').select('*').eq('login', 'manager88')
  const user = users[0]
  console.log('USER:', user.login, user.first_name, user.last_name, user.access_rights, 'dept:', user.department)

  const { data: allTasks } = await supabase.from('management_tasks').select('*')
  
  const activeRelevant = allTasks.filter(t => t.status !== 'done' && isTaskRelevantToUser(t, user))
  const doneRelevant = allTasks.filter(t => t.status === 'done' && isTaskRelevantToUser(t, user))
  
  console.log(`Relevant Active Tasks (${activeRelevant.length}):`)
  activeRelevant.forEach(t => console.log(`- [${t.status}] "${t.title}"`))
  
  console.log(`Relevant Done Tasks (${doneRelevant.length}):`)
  doneRelevant.forEach(t => console.log(`- [${t.status}] "${t.title}"`))
}

run()
