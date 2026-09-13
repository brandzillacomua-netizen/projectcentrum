import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const chatModule = readFileSync(resolve('src/modules/ChatModule.jsx'), 'utf8')
const composer = readFileSync(resolve('src/modules/chat/components/ChatComposerBar.jsx'), 'utf8')
const styles = readFileSync(resolve('src/modules/chat/ChatStyles.css'), 'utf8')

describe('chat responsive shell contract', () => {
  it('marks whether the mobile shell shows the thread list or an open thread', () => {
    expect(chatModule).toContain("chat.activeThreadId ? 'thread-open' : 'thread-list-open'")
    expect(styles).toContain('.chat-shell.thread-list-open .chat-main')
    expect(styles).toContain('.chat-shell.thread-open .chat-sidebar')
    expect(styles).toContain('.chat-shell.thread-open .chat-main')
  })

  it('keeps the composer connected to its layout styles', () => {
    expect(composer).toContain('<footer className="composer">')
    expect(styles).toContain('.composer {')
    expect(styles).toContain('.composer textarea')
  })

  it('renders a visible explanation for read-only channels', () => {
    expect(composer).toContain('<ReadOnlyChannelNotice visible />')
  })
})
