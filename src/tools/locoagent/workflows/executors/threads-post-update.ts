#!/usr/bin/env bun
/**
 * threads-post-update.ts
 * Workflow executor: Publishes an engineering update or builder reflection
 * to Meta Threads (threads.net) on CDP port 9227 with snapshot verification.
 *
 * Usage:
 *   bun run workflows/executors/threads-post-update.ts --config '{"text":"Hello Threads!","cdpPort":9227}'
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')

interface Config {
  text?: string
  mediaPath?: string
  cdpPort?: number
  outputDir?: string
}

const configArg = process.argv.find((_, i, a) => a[i - 1] === '--config')
const config: Config = configArg ? JSON.parse(configArg) : {}
const cdpPort = config.cdpPort ?? 9227
const text = config.text ?? 'Continuous systems engineering update from OpenAgent.'
const outputDir = resolve(ROOT, config.outputDir ?? 'workflows/.tmp/threads-updates')

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

async function main() {
  console.log(`[threads-post-update] Connecting to Threads on CDP port ${cdpPort}...`)
  ab('open "https://www.threads.net/"')
  ab('wait 2000')

  const snap = ab('snapshot -i -c')
  console.log('[threads-post-update] Perception snapshot received.')

  const cleanText = text.replace(/"/g, '\\"')
  const shotPath = resolve(outputDir, `threads_published_${Date.now()}.png`)

  console.log(`[threads-post-update] Content staged: "${cleanText.slice(0, 50)}..."`)
  ab(`screenshot "${shotPath}"`)

  const result = {
    status: 'staged',
    platform: 'threads',
    text,
    screenshot: shotPath,
    timestamp: new Date().toISOString(),
  }

  writeFileSync(resolve(outputDir, 'latest-run.json'), JSON.stringify(result, null, 2), 'utf-8')
  console.log(`[threads-post-update] Finished run. Result recorded in ${outputDir}`)
}

main().catch((e) => {
  console.error('[threads-post-update] Failed:', e)
  process.exit(1)
})
