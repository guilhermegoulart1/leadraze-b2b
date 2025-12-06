const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'components', 'CampaignReviewModal.jsx');

console.log('Reading CampaignReviewModal.jsx...');
let content = fs.readFileSync(filePath, 'utf8');

console.log('Cleaning up duplicate dark mode classes...');

// Remove duplicate dark mode classes
content = content.replace(/(dark:[a-z-]+\/?\d*)(dark:[a-z-]+\/?\d*)/g, '$1');

// Fix missing spaces before common utility classes
content = content.replace(/dark:([a-z-]+)-([a-z]+)-(\d+)(mb-)/g, 'dark:$1-$2-$3 $4');
content = content.replace(/dark:([a-z-]+)-([a-z]+)-(\d+)(mt-)/g, 'dark:$1-$2-$3 $4');
content = content.replace(/dark:([a-z-]+)-([a-z]+)-(\d+)(ml-)/g, 'dark:$1-$2-$3 $4');
content = content.replace(/dark:([a-z-]+)-([a-z]+)-(\d+)(mr-)/g, 'dark:$1-$2-$3 $4');
content = content.replace(/dark:([a-z-]+)-([a-z]+)-(\d+)(p-)/g, 'dark:$1-$2-$3 $4');
content = content.replace(/dark:([a-z-]+)-([a-z]+)-(\d+)(px-)/g, 'dark:$1-$2-$3 $4');
content = content.replace(/dark:([a-z-]+)-([a-z]+)-(\d+)(py-)/g, 'dark:$1-$2-$3 $4');
content = content.replace(/dark:([a-z-]+)-([a-z]+)-(\d+)(rounded)/g, 'dark:$1-$2-$3 $4');
content = content.replace(/dark:([a-z-]+)-([a-z]+)-(\d+)(font-)/g, 'dark:$1-$2-$3 $4');
content = content.replace(/dark:([a-z-]+)-([a-z]+)-(\d+)(text-)/g, 'dark:$1-$2-$3 $4');
content = content.replace(/dark:([a-z-]+)-([a-z]+)-(\d+)(w-)/g, 'dark:$1-$2-$3 $4');
content = content.replace(/dark:([a-z-]+)-([a-z]+)-(\d+)(h-)/g, 'dark:$1-$2-$3 $4');
content = content.replace(/dark:([a-z-]+)-([a-z]+)-(\d+)(flex)/g, 'dark:$1-$2-$3 $4');
content = content.replace(/dark:([a-z-]+)-([a-z]+)-(\d+)(grid)/g, 'dark:$1-$2-$3 $4');

console.log('Writing cleaned file...');
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Cleanup complete!');
