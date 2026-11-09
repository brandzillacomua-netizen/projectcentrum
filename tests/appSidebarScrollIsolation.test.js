import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('AppSidebar Scroll Isolation & Overscroll Prevention', () => {
  it('has overscroll-behavior: contain configured in index.css for sidebar and nav container', () => {
    const cssPath = path.resolve(__dirname, '../src/index.css')
    const cssContent = fs.readFileSync(cssPath, 'utf-8')

    // Verify .app-sidebar contains overscroll-behavior
    expect(cssContent).toMatch(/\.app-sidebar\s*\{[^}]*overscroll-behavior:\s*contain;/s)
    
    // Verify .sidebar-nav-container contains overscroll-behavior
    expect(cssContent).toMatch(/\.sidebar-nav-container\s*\{[^}]*overscroll-behavior:\s*contain;/s)
  })

  it('contains wheel isolation logic in AppSidebar.jsx to block scroll chaining to main window', () => {
    const sidebarJsxPath = path.resolve(__dirname, '../src/components/app/AppSidebar.jsx')
    const jsxContent = fs.readFileSync(sidebarJsxPath, 'utf-8')

    expect(jsxContent).toContain('sidebarRef')
    expect(jsxContent).toContain("sidebarEl.addEventListener('wheel'")
    expect(jsxContent).toContain('e.preventDefault()')
    expect(jsxContent).toContain('isAtBottom')
    expect(jsxContent).toContain('isAtTop')
  })

  it('correctly calculates boundary and boundary containment conditions', () => {
    // Simulation of the boundary algorithm
    const simulateWheel = ({ scrollTop, scrollHeight, clientHeight, deltaY, isOverNav = true, isCollapsed = false }) => {
      let defaultPrevented = false
      let navScrollTop = scrollTop
      const e = {
        deltaY,
        preventDefault: () => { defaultPrevented = true }
      }

      const isScrollable = scrollHeight > clientHeight

      if (!isScrollable) {
        if (!isCollapsed) {
          e.preventDefault()
        }
        return { defaultPrevented, navScrollTop }
      }

      if (!isOverNav) {
        navScrollTop += deltaY
        e.preventDefault()
        return { defaultPrevented, navScrollTop }
      }

      const isScrollingUp = deltaY < 0
      const isScrollingDown = deltaY > 0
      const isAtTop = scrollTop <= 0
      const isAtBottom = Math.ceil(scrollTop + clientHeight) >= scrollHeight - 1

      if ((isScrollingUp && isAtTop) || (isScrollingDown && isAtBottom)) {
        e.preventDefault()
      }

      return { defaultPrevented, navScrollTop }
    }

    // 1. Middle of menu scrolling down: does NOT prevent default, lets nav scroll naturally
    const midScroll = simulateWheel({ scrollTop: 100, scrollHeight: 800, clientHeight: 500, deltaY: 50 })
    expect(midScroll.defaultPrevented).toBe(false)

    // 2. Reached bottom and scrolling down: PREVENTS default (stops page from scrolling!)
    const atBottomScroll = simulateWheel({ scrollTop: 300, scrollHeight: 800, clientHeight: 500, deltaY: 50 })
    expect(atBottomScroll.defaultPrevented).toBe(true)

    // 3. Reached top and scrolling up: PREVENTS default (stops page from scrolling!)
    const atTopScroll = simulateWheel({ scrollTop: 0, scrollHeight: 800, clientHeight: 500, deltaY: -50 })
    expect(atTopScroll.defaultPrevented).toBe(true)

    // 4. Cursor on header/footer outside nav: forwards scroll to nav and prevents window scroll
    const headerScroll = simulateWheel({ scrollTop: 50, scrollHeight: 800, clientHeight: 500, deltaY: 40, isOverNav: false })
    expect(headerScroll.defaultPrevented).toBe(true)
    expect(headerScroll.navScrollTop).toBe(90)
  })
})

