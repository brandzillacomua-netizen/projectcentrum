const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    console.log("Fetching material requests for task 406c34ea-3db8-4d87-aca1-2e1d9f41ea0e:")
    const { data: reqs, error } = await supabase
      .from('material_requests')
      .select('id, details, status, created_at')
      .eq('task_id', '406c34ea-3db8-4d87-aca1-2e1d9f41ea0e')
      .order('created_at', { ascending: false })
      
    if (error) console.error(error)
    else console.log('Requests:', JSON.stringify(reqs, null, 2))
  }
  
  check()
} else {
  console.error('Could not find credentials')
}
