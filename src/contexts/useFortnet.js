import { supabase } from '../supabase'

/**
 * Fortnet access-control sync logic
 */
export function createFortnetActions({ fortnetUrl, accessLogs, setAccessLogs, updateFortnetUrl }) {

  const syncFortnetEvents = async () => {
    if (!fortnetUrl) return
    try {
      const response = await fetch('/fortnet-api/online/')
      if (!response.ok) throw new Error('Fortnet offline')
      const data = await response.json()
      const events = Array.isArray(data) ? data : (data?.Event ? [data.Event] : [])

      for (const ev of events) {
        const dtParts = ev.DateTime?.split(' ')
        let eventDate = new Date()
        if (dtParts && dtParts.length === 2) {
          const [d, m, y] = dtParts[0].split('.')
          const [h, min, s] = dtParts[1].split(':')
          eventDate = new Date(y, m - 1, d, h, min, s)
        }

        const isDuplicate = accessLogs.some(l =>
          new Date(l.event_time).getTime() === eventDate.getTime() &&
          l.person_name === ev.person?.FullName
        )

        if (!isDuplicate) {
          const newEntry = {
            event_time: eventDate.toISOString(),
            card_code: ev.card ? String(ev.card) : 'UNKNOWN',
            person_name: ev.person?.FullName || 'Unknown',
            hardware_name: ev.hardware?.Name || 'Door',
            event_kind: ev.message?.Name || 'Scan'
          }
          const { error } = await supabase.from('access_logs').insert([newEntry])
          if (!error) {
            setAccessLogs(prev => [newEntry, ...prev].slice(0, 500))
          }
        }
      }
    } catch (err) {
      console.warn('Sync Fortnet failed:', err.message)
    }
  }

  return { syncFortnetEvents }
}
