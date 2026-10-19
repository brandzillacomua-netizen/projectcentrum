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
