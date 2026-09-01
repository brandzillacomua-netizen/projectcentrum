import fs from 'fs'

const sourcePath = 'b:/kylutsya/src/modules/EngineerModule.jsx'
const targetPath = 'b:/kylutsya/src/modules/EngineerV2Module.jsx'

let code = fs.readFileSync(sourcePath, 'utf8')

// 1. Rename export and main component
code = code.replace(/export const EngineerModule/g, 'export const EngineerV2Module')
code = code.replace(/export default EngineerModule/g, 'export default EngineerV2Module')
code = code.replace(/const EngineerModule =/g, 'const EngineerV2Module =')

// 2. Add helper hook to fetch V2 items and wrap components
code = code.replace(
  /const MachineOperationsTab = \(\) => \{/g,
  `const useV2NomenclaturesData = (supabase) => {
    const [v2Noms, setV2Noms] = useState([])
    const fetchV2 = async () => {
      try {
        const { data } = await supabase.from('nomenclatures_v2').select('*').order('name')
        if (data) {
          const mapped = data.map(v => ({
            ...v,
            id: v.id,
            name: v.name,
            code: v.code || '',
            type: (v.group_id === 'grp_production_frames' || v.group_id === 'grp_test_samples' || v.group_id === 'cat_fg' || v.rule_type === 'full_frame' || (v.name || '').toLowerCase().includes('рама'))
              ? 'product'
              : (v.rule_type === 'frame_part' ? 'part' : 'consumable'),
            unit: v.unit || 'шт',
            category: v.category || 'Загальна'
          }))
          setV2Noms(mapped)
        }
      } catch (e) {
        console.error('Error loading V2 items:', e)
      }
    }
    useEffect(() => {
      fetchV2()
    }, [])
    return v2Noms
  }

const MachineOperationsTab = () => {`
)

// Destructure replacement: replace `nomenclatures,` in useMES with `nomenclatures: rawNoms,`
code = code.replace(/const \{ nomenclatures,/g, 'const { nomenclatures: rawNoms,')
code = code.replace(/nomenclatures, supabase,/g, 'nomenclatures: rawNoms, supabase,')
code = code.replace(/tasks, orders, nomenclatures,/g, 'tasks, orders, nomenclatures: rawNoms,')

// Insert `const nomenclatures = useV2NomenclaturesData(supabase)` after `useMES()` destructuring
code = code.replace(
  /const \{ nomenclatures: rawNoms,(.*?) = useMES\(\)/g,
  'const { nomenclatures: rawNoms,$1 = useMES()\n  const nomenclatures = useV2NomenclaturesData(supabase)'
)

// Replace table target for creates/edits to `nomenclatures_v2`
code = code.replace(/\.from\('nomenclatures'\)/g, ".from('nomenclatures_v2')")

// Color accents: replace orange theme accents with emerald v2 accents in main title
code = code.replace(/ІНЖЕНЕР ЧПК & BOM/g, 'ІНЖЕНЕР ЧПК & BOM 2.0 (v2.0)')
code = code.replace(/#ff9000/g, '#10b981')

fs.writeFileSync(targetPath, code, 'utf8')
console.log('Successfully created EngineerV2Module.jsx full clone working on nomenclatures_v2!')

