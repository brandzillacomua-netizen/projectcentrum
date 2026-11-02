/**
 * Helper to identify and parse machine QR codes.
 * Ensures strict separation between Machine QRs and Work Card QRs/barcodes.
 */
import { translateCyrillic } from '../modules/Shop1/utils/shop1Helpers'

export function parseMachineQRId(rawText) {
  if (!rawText || typeof rawText !== 'string') return null
  const clean = translateCyrillic(rawText.trim())

  // A machine QR must explicitly contain /machines/<id>, machines/<id>, or CENTRUM_MACHINE_<id>
  // Bare UUIDs are ALWAYS work cards or standard records, never machine QRs!
  const match = clean.match(/(?:(?:\/|\b)machines\/|(?:\/|\b)machine\/|^CENTRUM_MACHINE_)([a-zA-Z0-9-]{1,64})(?:[\/?#]|$)/i)
  return match ? match[1] : null
}

/**
 * Resolves a machine from scanned text or manual input in the Machines module.
 * Supports:
 * - Full or relative URLs (/machines/:id, /machines/:id/call)
 * - Custom prefixes (CENTRUM_MACHINE_:id)
 * - Direct machine UUID / ID
 * - Machine inventory number (inventory_no)
 * - Machine sequence number (sequence_number, e.g. "3", "№3", "#3")
 * - Exact machine name
 */
export function resolveMachineFromScannedText(rawText, machines = []) {
  if (!rawText || typeof rawText !== 'string' || !Array.isArray(machines) || machines.length === 0) {
    return null
  }

  const rawTrimmed = rawText.trim()
  if (!rawTrimmed) return null

  const clean = translateCyrillic(rawTrimmed)

  // 1. Explicit Machine QR pattern (URL with /machines/:id, CENTRUM_MACHINE_:id)
  const parsedIdFromRaw = parseMachineQRId(rawTrimmed)
  const parsedIdFromClean = clean !== rawTrimmed ? parseMachineQRId(clean) : null
  const candidateId = parsedIdFromRaw || parsedIdFromClean

  if (candidateId) {
    const match = machines.find(m => String(m.id).toLowerCase() === candidateId.toLowerCase())
    if (match) return match
  }

  // 2. Direct match by machine UUID / ID
  const matchById = machines.find(m =>
    String(m.id).trim().toLowerCase() === rawTrimmed.toLowerCase() ||
    String(m.id).trim().toLowerCase() === clean.toLowerCase()
  )
  if (matchById) return matchById

  // 3. Match by inventory number (inventory_no)
  const matchByInv = machines.find(m =>
    m.inventory_no && (
      String(m.inventory_no).trim().toLowerCase() === rawTrimmed.toLowerCase() ||
      String(m.inventory_no).trim().toLowerCase() === clean.toLowerCase()
    )
  )
  if (matchByInv) return matchByInv

  // 4. Match by sequence number (sequence_number, e.g. "№12", "#12", "12")
  const cleanSeq = rawTrimmed.replace(/^[№#Nn]\s*/, '').trim()
  if (cleanSeq) {
    const matchBySeq = machines.find(m =>
      m.sequence_number !== null &&
      m.sequence_number !== undefined &&
      String(m.sequence_number).trim() === cleanSeq
    )
    if (matchBySeq) return matchBySeq
  }

  // 5. Match by exact machine name (case-insensitive)
  const matchByName = machines.find(m =>
    m.name && (
      String(m.name).trim().toLowerCase() === rawTrimmed.toLowerCase() ||
      String(m.name).trim().toLowerCase() === clean.toLowerCase()
    )
  )
  if (matchByName) return matchByName

  return null
}
