const fs = require('fs');
const { glob } = require('glob');
const path = require('path');

const filePattern = 'src/pages/**/*.tsx';

async function run() {
  const files = await glob(filePattern);
  files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');

    if (!content.includes('<Table>')) return;
    
    // Check if it's already wrapped (from earlier manual edit)
    if (content.includes('overflow-x-auto') && content.includes('min-w-[800px]')) return;
    
    // Replace <Table> with <div className="overflow-x-auto w-full"><Table className="min-w-[800px]">
    content = content.replace(/<Table>/g, '<div className="overflow-x-auto w-full">\n<Table className="min-w-[800px]">');
    
    // Replace </Table> with </Table></div>
    content = content.replace(/<\/Table>/g, '</Table>\n</div>');

    fs.writeFileSync(file, content);
    console.log(`Updated tables in ${file}`);
  });
}
run();
