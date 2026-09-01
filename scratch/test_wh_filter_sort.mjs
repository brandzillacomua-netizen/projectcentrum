const testWarehouses = [
  'Відділення №1: вул. Каракая, 32a',
  'Відділення №2 (до 30 кг): бульв. Незалежності, 6',
  'Відділення №3 (до 30 кг): вул. Дзвонарська, 5',
  'Відділення №4 (до 30 кг): вул. Б. Хмельницького, 30',
  'Відділення №5 (до 30 кг): вул. Євшана, 9',
  'Відділення №50: вул. Франка, 12',
  'Поштомат №5001: вул. Дзвонарська, 5'
]

const filterAndSortWarehouses = (list, query) => {
  if (!query || !query.trim()) return list
  const q = query.trim().toLowerCase()

  const matches = list.filter(w => w.toLowerCase().includes(q))

  return matches.sort((a, b) => {
    const aLower = a.toLowerCase()
    const bLower = b.toLowerCase()

    if (/^\d+$/.test(q)) {
      const aIsExactNum = aLower.includes(`№${q}:`) || aLower.includes(`№ ${q}:`) || aLower.includes(`№${q} `) || aLower.includes(`№ ${q} `) || aLower.includes(`№${q}(`) || aLower.includes(`№ ${q}(`)
      const bIsExactNum = bLower.includes(`№${q}:`) || bLower.includes(`№ ${q}:`) || bLower.includes(`№${q} `) || bLower.includes(`№ ${q} `) || bLower.includes(`№${q}(`) || bLower.includes(`№ ${q}(`)
      
      if (aIsExactNum && !bIsExactNum) return -1
      if (!aIsExactNum && bIsExactNum) return 1
    }

    const aStarts = aLower.startsWith(q) || aLower.includes(`№${q}`)
    const bStarts = bLower.startsWith(q) || bLower.includes(`№${q}`)
    if (aStarts && !bStarts) return -1
    if (!aStarts && bStarts) return 1

    return 0
  })
}

console.log('Search "5":', filterAndSortWarehouses(testWarehouses, '5'))
