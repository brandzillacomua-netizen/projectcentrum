import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const DEFAULT_ERP_GROUPS = [
  { id: 'cat_raw', code: 'RAW', name: '01. Сировина та матеріали', parent_id: null, sort_order: 10 },
  { id: 'grp_carbon_sheets', code: 'RAW.CARBON', name: 'Карбонові листи', parent_id: 'cat_raw', sort_order: 11 },
  { id: 'grp_carbon_t300', code: 'RAW.CARBON.T300', name: 'Карбонова пластина Т300', parent_id: 'grp_carbon_sheets', sort_order: 12, rule_type: 'carbon' },
  { id: 'grp_carbon_t700', code: 'RAW.CARBON.T700', name: 'Карбонова пластина Т700', parent_id: 'grp_carbon_sheets', sort_order: 13, rule_type: 'carbon' },
  { id: 'grp_carbon_t800', code: 'RAW.CARBON.T800', name: 'Карбонова пластина Т800', parent_id: 'grp_carbon_sheets', sort_order: 14, rule_type: 'carbon' },
  { id: 'grp_rubber', code: 'RAW.RUBBER', name: 'Гума еластична листова', parent_id: 'cat_raw', sort_order: 14, rule_type: 'rubber' },
  { id: 'grp_paint', code: 'RAW.PAINT', name: 'Лакофарбові матеріали', parent_id: 'cat_raw', sort_order: 15, rule_type: 'paint' },
  { id: 'grp_mills', code: 'RAW.MILL', name: 'Фрези', parent_id: 'cat_raw', sort_order: 16, rule_type: 'mill' },

  { id: 'cat_hw', code: 'HW', name: '02. Комплектуючі та Метизи', parent_id: null, sort_order: 20 },
  { id: 'grp_hardware_main', code: 'HW.FASTENERS', name: 'Метизи', parent_id: 'cat_hw', sort_order: 21 },
  { id: 'grp_screws_black', code: 'HW.SCREW.BLACK', name: 'Гвинт (чорний)', parent_id: 'grp_hardware_main', sort_order: 22, rule_type: 'screw_black' },
  { id: 'grp_screws_silver', code: 'HW.SCREW.SILVER', name: 'Гвинти (срібні)', parent_id: 'grp_hardware_main', sort_order: 23, rule_type: 'screw_silver' },
  { id: 'grp_nuts', code: 'HW.NUT', name: 'Гайки', parent_id: 'grp_hardware_main', sort_order: 24, rule_type: 'nut' },
  { id: 'grp_press_nuts', code: 'HW.PRESS_NUT', name: 'Гайки запресовочні', parent_id: 'grp_hardware_main', sort_order: 25, rule_type: 'press_nut' },
  { id: 'grp_components_main', code: 'HW.COMPONENTS', name: 'Комплектуючі', parent_id: 'cat_hw', sort_order: 26 },
  { id: 'grp_standoffs', code: 'HW.STANDOFF', name: 'Стійки міжплатні', parent_id: 'grp_components_main', sort_order: 27, rule_type: 'standoff' },

  { id: 'cat_parts', code: 'PARTS', name: '03. Деталі', parent_id: null, sort_order: 30, rule_type: 'frame_part' },

  { id: 'cat_fg', code: 'FG', name: '04. Готова продукція', parent_id: null, sort_order: 40, rule_type: 'full_frame' },
  { id: 'grp_production_frames', code: 'FG.PRODUCTION', name: 'Продакшн', parent_id: 'cat_fg', sort_order: 41, rule_type: 'full_frame' },
  { id: 'grp_test_samples', code: 'FG.TEST_SAMPLE', name: 'Тестові зразки', parent_id: 'cat_fg', sort_order: 42, rule_type: 'full_frame' }
]

async function syncGroups() {
  console.log('Cleaning old groups in nomenclature_catalog_groups...')
  // Delete all existing old groups
  const { error: delErr } = await supabase.from('nomenclature_catalog_groups').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (delErr) console.warn('Delete warn:', delErr)

  console.log('Inserting real V2 ERP groups...')
  const { data, error: insErr } = await supabase.from('nomenclature_catalog_groups').upsert(DEFAULT_ERP_GROUPS)
  if (insErr) {
    console.error('Insert error:', insErr)
  } else {
    console.log('Successfully synced 18 real ERP V2 catalog groups!')
  }
}

syncGroups()
