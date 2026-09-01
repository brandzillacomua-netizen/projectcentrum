const testWarehouses = [
  'Відділення №1: вул. Каракая, 32a',
  'Відділення №2 (до 30 кг): бульв. Незалежності, 6',
  'Відділення №3 (до 30 кг): вул. Дзвонарська, 5',
  'Відділення №4 (до 30 кг): вул. Б. Хмельницького, 30',
  'Відділення №5 (до 30 кг): вул. Євшана, 9',
  'Поштомат №5001: вул. Дзвонарська, 5'
]

const filterWarehouses = (list, query) => {
  if (!query || !query.trim()) return list
  const q = query.trim().toLowerCase()

  return list.filter(w => {
    const wLower = w.toLowerCase()
    // Match exact branch/postomat number like №5 or № 5
    if (/^\d+$/.test(q)) {
      const isBranchNum = wLower.includes(`№${q}:`) || 
                          wLower.includes(`№ ${q}:`) || 
                          wLower.includes(`№${q} `) || 
                          wLower.includes(`№ ${q} `) ||
                          wLower.includes(`№${q}(`) ||
                          wLower.includes(`№ ${q}(`)
      if (isBranchNum) return true
    }
    return wLower.includes(q)
  })
}

console.log('Search "5":', filterWarehouses(testWarehouses, '5'))
console.log('Search "2":', filterWarehouses(testWarehouses, '2'))
console.log('Search "Дзвонарська":', filterWarehouses(testWarehouses, 'Дзвонарська'))
