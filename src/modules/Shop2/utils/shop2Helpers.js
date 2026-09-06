export const cyrillicToLatinMap = {
  'й':'q', 'ц':'w', 'у':'e', 'к':'r', 'е':'t', 'н':'y', 'г':'u', 'ш':'i', 'щ':'o', 'з':'p', 'х':'[', 'ї':']',
  'ф':'a', 'ы':'s', 'і':'s', 'в':'d', 'а':'f', 'п':'g', 'р':'h', 'о':'j', 'л':'k', 'д':'l', 'ж':';', 'є':'\'',
  'я':'z', 'ч':'x', 'с':'c', 'м':'v', 'и':'b', 'т':'n', 'ь':'m', 'б':',', 'ю':'.', '.':'/',
  'Й':'Q', 'Ц':'W', 'У':'E', 'К':'R', 'Е':'T', 'Н':'Y', 'Г':'U', 'Ш':'I', 'Щ':'O', 'З':'P', 'Х':'{', 'Ї':'}',
  'Ф':'A', 'Ы':'S', 'І':'S', 'В':'D', 'А':'F', 'П':'G', 'Р':'H', 'О':'J', 'Л':'K', 'Д':'L', 'Ж':':', 'Є':'"',
  'Я':'Z', 'Ч':'X', 'С':'C', 'М':'V', 'И':'B', 'Т':'N', 'Ь':'M', 'Б':'<', 'Ю':'>', ',':'?',
  '?':'/', 'ё':'`', 'Ё':'~', '№':'#'
}

export const translateCyrillic = (str) => {
  return String(str || '').split('').map(char => cyrillicToLatinMap[char] || char).join('')
}

export const formatElapsedTime = (startIso, currentTime = new Date()) => {
  if (!startIso) return '00:00:00'
  const start = new Date(startIso)
  const diff = Math.floor((currentTime - start) / 1000)
  if (isNaN(diff) || diff < 0) return '00:00:00'
  const h = Math.floor(diff / 3600).toString().padStart(2, '0')
  const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0')
  const s = (diff % 60).toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

export const formatPlanned = (mins) => {
  if (!mins || mins <= 0) return '—'
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  if (h > 0) return `${h}год ${m}хв`
  return `${m}хв`
}

export const getPlannedTime = (card, getNomFromCard) => {
  if (!card) return 0
  if (card.estimated_time) return Number(card.estimated_time)
  if (card.estimated_seconds) return Number(card.estimated_seconds) / 60
  const nom = getNomFromCard ? getNomFromCard(card) : null
  if (nom?.time_per_unit) return (Number(nom.time_per_unit) * Number(card.quantity))
  return 0
}

export const formatMachine = (name) => {
  if (!name) return '—'
  const match = name.match(/№\s*(\S+)/)
  return match ? `№${match[1]}` : name
}

export const matchesStage = (cardOp, stageName) => {
  const op = (cardOp || '').toLowerCase()
  const sk = (stageName || '').toLowerCase()
  return op === sk || op.includes(sk) || sk.includes(op)
}
