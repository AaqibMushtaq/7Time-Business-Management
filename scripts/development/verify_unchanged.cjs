const fs = require('fs');
const crypto = require('crypto');

const preInv = JSON.parse(fs.readFileSync('pre_reorganization_inventory.json', 'utf8'));
const moves = JSON.parse(fs.readFileSync('verified_moves.json', 'utf8'));
const movedSrcSet = new Set(moves.map(m => m.src.replace(/\\/g, '/')));

let checked = 0;
let matched = 0;
let missing = 0;
let altered = 0;

for (const item of preInv) {
  const normPath = item.path.replace(/\\/g, '/');
  // Skip moved sources and secret files
  if (movedSrcSet.has(normPath)) continue;
  if (normPath.startsWith('.env')) continue;

  checked++;
  if (!fs.existsSync(normPath)) {
    missing++;
    console.error('Missing unchanged file:', normPath);
    continue;
  }

  const content = fs.readFileSync(normPath);
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  if (hash === item.sha256) {
    matched++;
  } else {
    altered++;
    console.error('Altered unchanged file:', normPath);
  }
}

console.log('--- UNCHANGED FILES VERIFICATION ---');
console.log('Total non-moved files checked: ' + checked);
console.log('Exact SHA-256 matches: ' + matched);
console.log('Missing: ' + missing);
console.log('Altered: ' + altered);
