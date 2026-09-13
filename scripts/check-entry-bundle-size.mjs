import { readFileSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { resolve } from 'node:path'

const MAX_ENTRY_BYTES = 500 * 1024
const MAX_ENTRY_GZIP_BYTES = 140 * 1024
const distDir = resolve(process.cwd(), 'dist')
const html = readFileSync(resolve(distDir, 'index.html'), 'utf8')
const entryMatch = html.match(/<script[^>]+src="\/?(assets\/index-[^"]+\.js)"/)

if (!entryMatch) {
  throw new Error('Entry bundle was not found in dist/index.html. Run the production build first.')
}

const entryPath = resolve(distDir, entryMatch[1])
const rawBytes = statSync(entryPath).size
const gzipBytes = gzipSync(readFileSync(entryPath)).length
const formatKb = bytes => `${(bytes / 1024).toFixed(1)} KB`

if (rawBytes > MAX_ENTRY_BYTES || gzipBytes > MAX_ENTRY_GZIP_BYTES) {
  console.error(
    `Entry bundle exceeds its budget: ${formatKb(rawBytes)} raw / ${formatKb(gzipBytes)} gzip ` +
    `(limits: ${formatKb(MAX_ENTRY_BYTES)} raw / ${formatKb(MAX_ENTRY_GZIP_BYTES)} gzip).`
  )
  process.exit(1)
}

console.log(
  `Entry bundle budget passed: ${formatKb(rawBytes)} raw / ${formatKb(gzipBytes)} gzip ` +
  `(limits: ${formatKb(MAX_ENTRY_BYTES)} raw / ${formatKb(MAX_ENTRY_GZIP_BYTES)} gzip).`
)
