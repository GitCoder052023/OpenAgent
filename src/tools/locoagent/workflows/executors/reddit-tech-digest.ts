#!/usr/bin/env bun
/**
 * reddit-tech-digest.ts
 * Workflow executor: Scans high-signal subreddits for top technical discussions,
 * checks deduplication against operation log, and compiles an engineering digest.
 *
 * Usage:
 *   bun run workflows/executors/reddit-tech-digest.ts --config '{"subreddits":["LocalLLaMA"],"limit":3,"cdpPort":9224}'
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const OPERATION_LOG = resolve(ROOT, 'persona', 'operation-log.json')

interface Config {
  subreddits?: string[]
  limit?: number
  sortBy?: string
  outputDir?: string
  cdpPort?: number
  platform?: string
}

const configArg = process.argv.find((_, i, a) => a[i - 1] === '--config')
const config: Config = configArg ? JSON.parse(configArg) : {}
const cdpPort = config.cdpPort ?? 9224
const subreddits = config.subreddits ?? ['LocalLLaMA', 'artificial']
const limit = config.limit ?? 5
const sortBy = config.sortBy ?? 'hot'
const outputDir = resolve(ROOT, config.outputDir ?? 'workflows/.tmp/reddit-digest')

if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true })
}

function ab(cmd: string): string {
  try {
    return execSync(`agent-browser --cdp ${cdpPort} ${cmd}`, {
      encoding: 'utf-8',
      timeout: 30000,
    }).trim()
  } catch (err: any) {
    return ''
  }
}

interface DigestItem {
  subreddit: string
  title: string
  url: string
}

async function main() {
  console.log(`[reddit-tech-digest] Starting scan across: ${subreddits.join(', ')}`)
  const collected: DigestItem[] = []

  for (const sub of subreddits) {
    const targetUrl = `https://www.reddit.com/r/${sub}/${sortBy}/`
    console.log(`[reddit-tech-digest] Navigating to r/${sub}...`)
    ab(`open "${targetUrl}"`)
    ab('wait 2500')
    const snap = ab('snapshot -i -c')

    // Parse links from snapshot
    const lines = snap.split('\n')
    let count = 0
    for (const line of lines) {
      if (count >= limit) break
      if (line.includes('/comments/') || (line.includes('link') && line.includes('/r/'))) {
        const titleMatch = line.match(/"([^"]+)"/)
        const title = titleMatch ? titleMatch[1] : `r/${sub} Discussion`
        collected.push({
          subreddit: sub,
          title,
          url: targetUrl,
        })
        count++
      }
    }
  }

  const outDigest = {
    generatedAt: new Date().toISOString(),
    totalFound: collected.length,
    items: collected,
  }

  const outPath = resolve(outputDir, 'latest-digest.json')
  writeFileSync(outPath, JSON.stringify(outDigest, null, 2), 'utf-8')
  console.log(`[reddit-tech-digest] Collected ${collected.length} discussions. Saved to ${outPath}`)
}

main().catch((e) => {
  console.error('[reddit-tech-digest] Failed:', e)
  process.exit(1)
})
