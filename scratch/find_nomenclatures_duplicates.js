import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const normalize = (s) => {
    if (!s) return ''
    const homoglyphs = {
      'a': 'а', 'b': 'в', 'c': 'с', 'e': 'е', 'h': 'н', 'k': 'к', 'm': 'м', 'o': 'о', 'p': 'р', 't': 'т', 'x': 'х', 'y': 'у'
    }
    return s.toLowerCase().split('').map(c => homoglyphs[c] || c).join('').replace(/[^а-я0-9іїєґ]/g, '')
  }

  const check = async () => {
    const { data, error } = await supabase.from('nomenclatures').select('*')
    if (error) {
      console.error(error)
      return
    }

    const groups = {}
    data.forEach(n => {
      const norm = normalize(n.name)
      if (!groups[norm]) groups[norm] = []
      groups[norm].push(n)
    })

    console.log("=== Duplicate Nomenclatures ===")
    Object.entries(groups).forEach(([norm, list]) => {
      if (list.length > 1) {
        console.log(`\nNormalized: "${norm}"`)
        list.forEach(n => {
          console.log(`  - [${n.type}] ID: ${n.id}, Original Name: "${n.name}"`)
        })
      }
    })
  }
  
  check()
}
