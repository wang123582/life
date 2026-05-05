import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')
const distDir = resolve(rootDir, 'dist')
const buildMetaPath = resolve(distDir, 'build-meta.json')

function safeGit(command, fallback = 'unknown') {
  try {
    return execSync(command, {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || fallback
  } catch {
    return fallback
  }
}

mkdirSync(distDir, { recursive: true })

const payload = {
  app: 'life',
  commit: safeGit('git rev-parse HEAD'),
  shortCommit: safeGit('git rev-parse --short HEAD'),
  branch: safeGit('git rev-parse --abbrev-ref HEAD'),
  generatedAt: new Date().toISOString(),
}

writeFileSync(buildMetaPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
console.log(`wrote ${buildMetaPath}`)