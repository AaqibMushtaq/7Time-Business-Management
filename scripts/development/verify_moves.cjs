const fs = require('fs');
const crypto = require('crypto');

const moves = JSON.parse(fs.readFileSync('move_verification_results.json', 'utf8'));
const preInv = JSON.parse(fs.readFileSync('pre_reorganization_inventory.json', 'utf8'));

// Create normalized map
const normMap = new Map();
for (const item of preInv) {
  normMap.set(item.path.replace(/\\/g, '/'), item.sha256);
}

let mismatches = 0;
let matches = 0;

const verifiedMoves = moves.map(m => {
  const normSrc = m.src.replace(/\\/g, '/');
  const expectedHash = normMap.get(normSrc);
  const currentContent = fs.readFileSync(m.dst);
  const currentHash = crypto.createHash('sha256').update(currentContent).digest('hex');
  const ok = (expectedHash === currentHash);
  if (ok) {
    matches++;
  } else {
    mismatches++;
    console.error('MISMATCH on ' + m.src + ' -> ' + m.dst);
    console.error('  Expected: ' + expectedHash);
    console.error('  Actual:   ' + currentHash);
  }
  return {
    src: m.src,
    dst: m.dst,
    expectedHash,
    currentHash,
    match: ok
  };
});

console.log('TOTAL CHECKED: ' + verifiedMoves.length);
console.log('MATCHES: ' + matches);
console.log('MISMATCHES: ' + mismatches);

fs.writeFileSync('verified_moves.json', JSON.stringify(verifiedMoves, null, 2));
