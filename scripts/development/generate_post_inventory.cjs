const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const IGNORE_DIRS = new Set(['.git', 'node_modules', 'dist', '.temp']);

function getFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

const allFiles = getFiles('.').map(f => f.replace(/\\/g, '/').replace(/^\.\//, ''));
console.log('Total files found post-reorganization:', allFiles.length);

const inventory = allFiles.map(relPath => {
  const isSecret = relPath.startsWith('.env');
  const stat = fs.statSync(relPath);
  let sha256 = 'REDACTED_SECRET';
  if (!isSecret) {
    const content = fs.readFileSync(relPath);
    sha256 = crypto.createHash('sha256').update(content).digest('hex');
  }
  return {
    path: relPath,
    type: path.extname(relPath) || 'none',
    size: stat.size,
    sha256
  };
});

fs.writeFileSync('post_reorganization_inventory.json', JSON.stringify(inventory, null, 2));
console.log('Post-reorganization inventory written to post_reorganization_inventory.json');

