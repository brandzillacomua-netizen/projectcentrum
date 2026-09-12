import { describe, expect, it } from 'vitest'
import {
  sanitizeTelemetry,
  sanitizeTelemetryString,
  telemetrySafeUrl
} from '../src/utils/telemetrySanitizer.js'

describe('telemetry sanitizer', () => {
  it('redacts credentials and PII recursively without mutating the source', () => {
    const source = {
      password: 'super-secret',
      nested: {
        accessToken: 'private-token',
        email: 'operator@example.com',
        safe: 'card-42'
      }
    }

    const clean = sanitizeTelemetry(source)

    expect(clean).toEqual({
      password: '[REDACTED]',
      nested: {
        accessToken: '[REDACTED]',
        email: '[REDACTED]',
        safe: 'card-42'
      }
    })
    expect(source.password).toBe('super-secret')
  })

  it('redacts bearer tokens, JWTs, query secrets, emails and URL credentials', () => {
    const dirty = 'Bearer abc.def.ghi eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature ' +
      'https://user:pass@example.com/a?access_token=value operator@example.com'
    const clean = sanitizeTelemetryString(dirty)

    expect(clean).not.toContain('abc.def.ghi')
    expect(clean).not.toContain('signature')
    expect(clean).not.toContain('user:pass')
    expect(clean).not.toContain('operator@example.com')
    expect(clean).toContain('[REDACTED]')
  })

  it('removes query strings and fragments from recorded locations', () => {
    expect(telemetrySafeUrl('https://centrum.example/foreman?task=secret#details'))
      .toBe('https://centrum.example/foreman')
  })

  it('handles circular objects without throwing', () => {
    const circular = { safe: true }
    circular.self = circular
    expect(sanitizeTelemetry(circular)).toEqual({ safe: true, self: '[CIRCULAR]' })
  })
})
