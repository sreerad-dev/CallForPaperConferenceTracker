import fs from 'fs'

function getField(text, key) {
  const m = text.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, 'm'))
  return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : ''
}

const yaml = fs.readFileSync('server/data/repos/ccf-deadlines/conference/DS/fast.yml', 'utf-8')
const blocks = yaml.split(/^- title:/m).slice(1)
const block = '- title:' + blocks[0]

const title = getField(block, 'title')
const coreRank = block.match(/\s+core:\s*(\S+)/)?.[1] ?? ''
console.log('title:', title, '| core:', coreRank)

const confBlocks = block.split(/^\s{4}- year:/m).slice(1)
console.log('conf count:', confBlocks.length)

// Check 2026 entry (index 5)
const cb = confBlocks[5]
const firstLine = cb.split('\n')[0]
const year = parseInt(getField('  year:' + firstLine, 'year'), 10)
const link = getField(cb, 'link')

// Timeline split
const tlBlocks = cb.split(/^\s{8}- deadline:/m).slice(1)
console.log('year:', year, '| link:', link, '| timeline entries:', tlBlocks.length)
if (tlBlocks.length > 0) {
  console.log('first tl entry:', JSON.stringify(tlBlocks[0].slice(0, 100)))
}

// Check why index is 0 — test the categories read
const REPO_PATH = 'server/data/repos/ccf-deadlines/conference'
const categories = fs.readdirSync(REPO_PATH).filter(d =>
  fs.statSync(`${REPO_PATH}/${d}`).isDirectory()
)
console.log('\nCategories found:', categories)

let totalFiles = 0
for (const cat of categories) {
  const files = fs.readdirSync(`${REPO_PATH}/${cat}`).filter(f => f.endsWith('.yml'))
  totalFiles += files.length
}
console.log('Total YAML files:', totalFiles)
