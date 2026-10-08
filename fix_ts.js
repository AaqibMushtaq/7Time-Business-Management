import fs from 'fs';

const filePath = 'src/pages/naeem/index.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

content = content.replace(/\{formatMoney\(totalReceived\)\}/g, '{formatMoney(summary.totalReceived)}');
content = content.replace(/\{formatMoney\(outstanding\)\}/g, '{formatMoney(summary.outstanding)}');
content = content.replace(/\{collectionPercentage\}%/g, '{summary.collectionPercentage}%');
content = content.replace(/outstanding > 0/g, 'summary.outstanding > 0');
content = content.replace(/ outstanding \}/g, ' summary.outstanding }');

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Replaced all occurrences successfully');
