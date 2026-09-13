import { describe, expect, it } from 'vitest'
import { redactConnectionStrings } from '../scripts/check-production-db-connectivity.mjs'

describe('production database connectivity guard', () => {
  it('redacts credentials from PostgreSQL URIs', () => {
    expect(redactConnectionStrings(
      'postgresql://postgres.project:super-secret@pooler.example.com:5432/postgres'
    )).toBe('postgresql://***@pooler.example.com:5432/postgres')
  })
})
