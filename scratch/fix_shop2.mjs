import fs from 'fs'

const filePath = 'b:/kylutsya/src/modules/Shop2Terminal.jsx'
let content = fs.readFileSync(filePath, 'utf8')
const lines = content.split('\r\n').length > 1 ? content.split('\r\n') : content.split('\n')

const head = lines.slice(0, 989)
const tail = lines.slice(1019)

const replacement = [
  '        {/* Summary KPI Bar — EXACTLY 2 CARDS */}',
  '        <div style={{',
  '          display: \'grid\',',
  '          gridTemplateColumns: \'repeat(auto-fit, minmax(260px, 1fr))\',',
  '          gap: \'14px\',',
  '          padding: \'14px 25px\',',
  '          background: \'var(--bg-secondary, #f8fafc)\',',
  '          borderBottom: \'1px solid var(--border-color, #e2e8f0)\'',
  '        }}>',
  '          {/* Card 1: Нарядів у буфері */}',
  '          <div style={{ background: \'var(--card-bg, #ffffff)\', border: \'1px solid var(--border-color, #e2e8f0)\', borderRadius: \'12px\', padding: \'14px 20px\', display: \'flex\', alignItems: \'center\', gap: \'16px\', boxShadow: \'0 2px 8px rgba(0,0,0,0.03)\' }}>',
  '            <ClipboardList size={22} color="#8b5cf6" />',
  '            <div>',
  '              <div style={{ color: \'var(--text-muted, #64748b)\', fontSize: \'0.62rem\', fontWeight: 900, textTransform: \'uppercase\', letterSpacing: \'0.5px\' }}>НАРЯДІВ У БУФЕРІ</div>',
  '              <div style={{ color: \'var(--text-primary, #0f172a)\', fontSize: \'1.25rem\', fontWeight: 950, marginTop: \'2px\' }}>{rawGroupList.filter(g => g.taskId !== \'unassigned\').length} нарядів</div>',
  '            </div>',
  '          </div>',
  '',
  '          {/* Card 2: Вільних деталей у буфері */}',
  '          <div style={{ background: \'var(--card-bg, #ffffff)\', border: \'1px solid rgba(139, 92, 246, 0.4)\', borderRadius: \'12px\', padding: \'14px 20px\', display: \'flex\', alignItems: \'center\', gap: \'16px\', boxShadow: \'0 2px 8px rgba(0,0,0,0.03)\' }}>',
  '            <Play size={22} color="#8b5cf6" />',
  '            <div>',
  '              <div style={{ color: \'#8b5cf6\', fontSize: \'0.62rem\', fontWeight: 900, textTransform: \'uppercase\', letterSpacing: \'0.5px\' }}>ВІЛЬНИХ ДЕТАЛЕЙ У БУФЕРІ</div>',
  '              <div style={{ color: \'#8b5cf6\', fontSize: \'1.25rem\', fontWeight: 950, marginTop: \'2px\' }}>{totalBufferPartsCount.toLocaleString(\'uk-UA\')} шт</div>',
  '            </div>',
  '          </div>',
  '        </div>'
]

const newContent = [...head, ...replacement, ...tail].join('\n')
fs.writeFileSync(filePath, newContent, 'utf8')
console.log('Successfully updated Shop2Terminal.jsx cleanly!')
