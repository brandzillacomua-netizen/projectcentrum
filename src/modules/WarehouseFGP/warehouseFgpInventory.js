// Keep inventory identity stable across Cyrillic/Latin homoglyphs and spacing variants.
export const normalizeKey = str => (str || '')
  .trim()
  .toLowerCase()
  .replace(/[\s_-]+/g, '-')
  .replace(/[аa]/g, 'a')
  .replace(/[вb]/g, 'b')
  .replace(/[еe]/g, 'e')
  .replace(/[кk]/g, 'k')
  .replace(/[мm]/g, 'm')
  .replace(/[нh]/g, 'h')
  .replace(/[оo]/g, 'o')
  .replace(/[рp]/g, 'p')
  .replace(/[сc]/g, 'c')
  .replace(/[тt]/g, 't')
  .replace(/[хx]/g, 'x')

export const isHardware = item => {
  const type = (item.type || '').toLowerCase()
  const nameLower = (item.name || '').toLowerCase()
  return (
    type === 'hardware' || type === 'fastener' || type === 'mount' ||
    nameLower.includes('гвинт') || nameLower.includes('гайка') || nameLower.includes('болт') ||
    nameLower.includes('шайба') || nameLower.includes('стійка') || nameLower.includes('накладка') ||
    nameLower.includes('тримач') || nameLower.includes('метиз') || nameLower.includes('кріплення') ||
    nameLower.includes('саморіз') || nameLower.includes('втулка') || nameLower.includes('фіксатор')
  )
}
