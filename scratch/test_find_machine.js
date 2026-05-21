import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const findMachine = (name, machines) => {
  if (!name || name === 'Не вказано') return null
  const baseName = name.split(' №')[0].trim()
  const found = machines.find(m => m.name === baseName) 
    || machines.find(m => m.name === name)
    || machines.find(m => m.type === baseName)
    || machines.find(m => m.type === name)
  if (found) return found

  const baseNameLower = baseName.toLowerCase()
  if (baseNameLower.includes('12x8') || baseNameLower.includes('1200x800') || baseNameLower.includes('малий')) {
    return { sheet_capacity: 4, name: 'CNC 1200x800 - 4 листи (Малий)' }
  }
  if (baseNameLower.includes('16x16') || baseNameLower.includes('3050(16)') || baseNameLower.includes('швидкісний')) {
    return { sheet_capacity: 12, name: 'CNC 3050(16)х16 - 3-12 листів (швидкісний)' }
  }
  if (baseNameLower.includes('30x16') || baseNameLower.includes('3060x1600') || baseNameLower.includes('3060х1600') || baseNameLower.includes('три головий') || baseNameLower.includes('триголовий')) {
    return { sheet_capacity: 36, name: 'CNC 3060х1600 - 3-36 листів (Три Головий)' }
  }
  if (baseNameLower.includes('60x20') || baseNameLower.includes('6000x2000') || baseNameLower.includes('дракон')) {
    return { sheet_capacity: 96, name: 'CNC 6000x2000 - 4 - 96 листів (Дракон)' }
  }
  if (baseNameLower.includes('ke xin') || baseNameLower.includes('фея')) {
    return { sheet_capacity: 16, name: 'CNC KE XIN - 4 - 16 листів (ФЕЯ)' }
  }
  return null
}

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    const { data: machines } = await supabase.from('machines').select('*')
    console.log("Machines array:", machines)
    const nameToFind = "CNC KE XIN - 4 - 16 листів (ФЕЯ)"
    const res = findMachine(nameToFind, machines)
    console.log("Result of findMachine for:", nameToFind)
    console.log(res)
  }
  
  check()
}
