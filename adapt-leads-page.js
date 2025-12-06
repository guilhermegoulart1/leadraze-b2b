const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'pages', 'LeadsPage.jsx');

console.log('Reading LeadsPage.jsx...');
let content = fs.readFileSync(filePath, 'utf8');

console.log('Applying dark mode patterns...');

// Backgrounds
content = content.replace(/bg-white(['\s"])/g, 'bg-white dark:bg-gray-800$1');
content = content.replace(/bg-gray-50(['\s"])/g, 'bg-gray-50 dark:bg-gray-900$1');
content = content.replace(/bg-gray-100(['\s"])/g, 'bg-gray-100 dark:bg-gray-800$1');

// Text colors
content = content.replace(/text-gray-900(['\s"])/g, 'text-gray-900 dark:text-gray-100$1');
content = content.replace(/text-gray-800(['\s"])/g, 'text-gray-800 dark:text-gray-100$1');
content = content.replace(/text-gray-700(['\s"])/g, 'text-gray-700 dark:text-gray-300$1');
content = content.replace(/text-gray-600(['\s"])/g, 'text-gray-600 dark:text-gray-400$1');
content = content.replace(/text-gray-500(['\s"])/g, 'text-gray-500 dark:text-gray-400$1');

// Borders
content = content.replace(/border-gray-200(['\s"])/g, 'border-gray-200 dark:border-gray-700$1');
content = content.replace(/border-gray-300(['\s"])/g, 'border-gray-300 dark:border-gray-600$1');

// Purple colors
content = content.replace(/bg-purple-50(['\s"])/g, 'bg-purple-50 dark:bg-purple-900/20$1');
content = content.replace(/bg-purple-100(['\s"])/g, 'bg-purple-100 dark:bg-purple-900/30$1');
content = content.replace(/text-purple-600(['\s"])/g, 'text-purple-600 dark:text-purple-400$1');

// Green colors
content = content.replace(/text-green-600(['\s"])/g, 'text-green-600 dark:text-green-400$1');
content = content.replace(/bg-green-50(['\s"])/g, 'bg-green-50 dark:bg-green-900/20$1');
content = content.replace(/bg-green-100(['\s"])/g, 'bg-green-100 dark:bg-green-900/30$1');

// Blue colors
content = content.replace(/text-blue-600(['\s"])/g, 'text-blue-600 dark:text-blue-400$1');
content = content.replace(/bg-blue-50(['\s"])/g, 'bg-blue-50 dark:bg-blue-900/20$1');
content = content.replace(/bg-blue-100(['\s"])/g, 'bg-blue-100 dark:bg-blue-900/30$1');

// Amber colors
content = content.replace(/text-amber-600(['\s"])/g, 'text-amber-600 dark:text-amber-400$1');
content = content.replace(/bg-amber-50(['\s"])/g, 'bg-amber-50 dark:bg-amber-900/20$1');
content = content.replace(/bg-amber-100(['\s"])/g, 'bg-amber-100 dark:bg-amber-900/30$1');

// Red colors
content = content.replace(/text-red-600(['\s"])/g, 'text-red-600 dark:text-red-400$1');
content = content.replace(/bg-red-50(['\s"])/g, 'bg-red-50 dark:bg-red-900/20$1');
content = content.replace(/bg-red-100(['\s"])/g, 'bg-red-100 dark:bg-red-900/30$1');

// Hover states
content = content.replace(/hover:bg-gray-50(['\s"])/g, 'hover:bg-gray-50 dark:hover:bg-gray-700$1');
content = content.replace(/hover:bg-gray-100(['\s"])/g, 'hover:bg-gray-100 dark:hover:bg-gray-700$1');
content = content.replace(/hover:text-gray-700(['\s"])/g, 'hover:text-gray-700 dark:hover:text-gray-300$1');

// Shadows
content = content.replace(/shadow-lg(['\s"])/g, 'shadow-lg dark:shadow-gray-900/50$1');
content = content.replace(/shadow-xl(['\s"])/g, 'shadow-xl dark:shadow-gray-900/50$1');

// Placeholders
content = content.replace(/placeholder-gray-400(['\s"])/g, 'placeholder-gray-400 dark:placeholder-gray-500$1');

// Divide colors
content = content.replace(/divide-gray-200(['\s"])/g, 'divide-gray-200 dark:divide-gray-700$1');

console.log('Writing updated file...');
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ LeadsPage.jsx adapted for dark mode!');
console.log('Total file size:', content.length, 'characters');
