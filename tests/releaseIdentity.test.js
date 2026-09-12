import { afterEach, describe, expect, it } from 'vitest'
import handler from '../api/release.js'

const originalEnv = {
  VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
  VERCEL_ENV: process.env.VERCEL_ENV
}

const createResponse = () => {
  const headers = new Map()
  return {
    headers,
    statusCode: null,
    body: null,
    setHeader(name, value) {
      headers.set(name, value)
    },
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    }
  }
}

afterEach(() => {
  for (const [name, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
})

describe('release identity endpoint', () => {
  it('returns the immutable deployment commit without caching', () => {
    process.env.VERCEL_GIT_COMMIT_SHA = 'A0801DFAFE47765986F915B5BB6164656F2CE461'
    process.env.VERCEL_ENV = 'production'
    const res = createResponse()

    handler({ method: 'GET' }, res)

    expect(res.statusCode).toBe(200)
    expect(res.headers.get('Cache-Control')).toContain('no-store')
    expect(res.body).toEqual({
      service: 'centrum-mes',
      commit: 'a0801dfafe47765986f915b5bb6164656f2ce461',
      environment: 'production'
    })
  })

  it('does not disclose arbitrary environment values and rejects non-GET methods', () => {
    process.env.VERCEL_GIT_COMMIT_SHA = 'not-a-sha'
    const getResponse = createResponse()
    handler({ method: 'GET' }, getResponse)
    expect(getResponse.body.commit).toBeNull()

    const postResponse = createResponse()
    handler({ method: 'POST' }, postResponse)
    expect(postResponse.statusCode).toBe(405)
    expect(postResponse.body).toEqual({ error: 'method_not_allowed' })
    expect(postResponse.headers.get('Allow')).toBe('GET')
  })
})
