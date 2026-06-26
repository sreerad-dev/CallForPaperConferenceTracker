#!/usr/bin/env node
/**
 * First-time setup: clone the deadline data repos.
 * Run once: npm run setup
 * Safe to re-run — skips repos that already exist.
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const _dir = path.dirname(fileURLToPath(import.meta.url))
const REPOS_DIR = path.resolve(_dir, '../server/data/repos')

const REPOS = [
  {
    name: 'ai-deadlines',
    url: 'https://github.com/paperswithcode/ai-deadlines.git',
    description: 'AI/ML conference deadlines (paperswithcode)',
  },
  {
    name: 'ccf-deadlines',
    url: 'https://github.com/ccfddl/ccf-deadlines.git',
    description: 'Systems, DB, security, networking deadlines (ccfddl)',
  },
]

fs.mkdirSync(REPOS_DIR, { recursive: true })

for (const repo of REPOS) {
  const dest = path.join(REPOS_DIR, repo.name)
  if (fs.existsSync(dest)) {
    console.log(`✓ ${repo.name} already exists — pulling latest`)
    try {
      execSync('git pull --ff-only', { cwd: dest, stdio: 'inherit' })
    } catch {
      console.warn(`  warning: git pull failed for ${repo.name}, using existing copy`)
    }
  } else {
    console.log(`⬇  Cloning ${repo.name} (${repo.description})...`)
    execSync(`git clone --depth=1 ${repo.url} ${dest}`, { stdio: 'inherit' })
    console.log(`✓ ${repo.name} cloned`)
  }
}

console.log('\nSetup complete. Run `npm run scrape` to generate cfp-tracker.md')
