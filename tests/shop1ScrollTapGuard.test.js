import { describe, it, expect } from 'vitest'
import { shouldIgnoreScrollTap } from '../src/modules/Shop1/utils/shop1Helpers'

describe('Shop 1 mobile scroll-tap guard', () => {
  it('ignores tap right after container scroll', () => {
    expect(shouldIgnoreScrollTap({
      lastScrollAt: 1000,
      now: 1120
    })).toBe(true)
  })

  it('ignores tap when finger moved beyond threshold', () => {
    expect(shouldIgnoreScrollTap({
      lastScrollAt: 0,
      now: 2000,
      touchStart: { x: 100, y: 200 },
      touchEnd: { x: 103, y: 215 }
    })).toBe(true)
  })

  it('ignores tap when touchMoved flag is set', () => {
    expect(shouldIgnoreScrollTap({
      touchMoved: true
    })).toBe(true)
  })

  it('allows deliberate tap on stationary list', () => {
    expect(shouldIgnoreScrollTap({
      lastScrollAt: 1000,
      now: 1500,
      touchStart: { x: 100, y: 200 },
      touchEnd: { x: 102, y: 202 },
      touchMoved: false
    })).toBe(false)
  })
})
