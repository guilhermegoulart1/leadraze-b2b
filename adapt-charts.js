const fs = require('fs');
const path = require('path');

const charts = [
  'components/dashboard/LeadsChart.jsx',
  'components/dashboard/RevenueChart.jsx',
  'components/dashboard/LeadsBySourceChart.jsx',
  'components/charts/BarChart.jsx',
  'components/charts/DonutChart.jsx',
  'components/charts/FunnelChart.jsx',
  'components/charts/PerformanceChart.jsx'
];

function adaptChart(filename) {
  const filePath = path.join(__dirname, 'frontend', 'src', filename);

  console.log(`\nProcessing ${filename}...`);

  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${filename}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // Add useTheme import if not present
  if (!content.includes('useTheme')) {
    content = content.replace(
      /import React.*?from 'react';/,
      `import React from 'react';\nimport { useTheme } from '../../contexts/ThemeContext';`
    );
  }

  // Apply standard dark mode patterns
  content = content.replace(/bg-white(['\s"])/g, 'bg-white dark:bg-gray-800$1');
  content = content.replace(/bg-gray-50(['\s"])/g, 'bg-gray-50 dark:bg-gray-900/50$1');
  content = content.replace(/bg-gray-100(['\s"])/g, 'bg-gray-100 dark:bg-gray-800$1');

  content = content.replace(/text-gray-900(['\s"])/g, 'text-gray-900 dark:text-gray-100$1');
  content = content.replace(/text-gray-800(['\s"])/g, 'text-gray-800 dark:text-gray-100$1');
  content = content.replace(/text-gray-700(['\s"])/g, 'text-gray-700 dark:text-gray-300$1');
  content = content.replace(/text-gray-600(['\s"])/g, 'text-gray-600 dark:text-gray-400$1');
  content = content.replace(/text-gray-500(['\s"])/g, 'text-gray-500 dark:text-gray-400$1');
  content = content.replace(/text-gray-400(['\s"])/g, 'text-gray-400 dark:text-gray-500$1');

  content = content.replace(/border-gray-200(['\s"])/g, 'border-gray-200 dark:border-gray-700$1');
  content = content.replace(/border-gray-300(['\s"])/g, 'border-gray-300 dark:border-gray-600$1');
  content = content.replace(/border-gray-100(['\s"])/g, 'border-gray-100 dark:border-gray-700$1');

  // Violet to Purple
  content = content.replace(/bg-violet-50(['\s"])/g, 'bg-violet-50 dark:bg-purple-900/20$1');
  content = content.replace(/text-violet-600(['\s"])/g, 'text-violet-600 dark:text-purple-400$1');

  // Shadows
  content = content.replace(/shadow-lg(['\s"])/g, 'shadow-lg dark:shadow-gray-900/50$1');

  // Cleanup duplicates
  content = content.replace(/(dark:[a-z-]+\/?\d*)(dark:[a-z-]+\/?\d*)/g, '$1');

  fs.writeFileSync(filePath, content, 'utf8');

  console.log(`✅ ${filename.split('/').pop()} adapted`);
}

console.log('🔄 Adapting chart components for dark mode...\n');
console.log('='.repeat(50));

charts.forEach(adaptChart);

console.log('\n' + '='.repeat(50));
console.log('✅ All charts adapted!');
console.log('\nNote: Charts may need manual adjustments for:');
console.log('- Dynamic axis colors based on isDark');
console.log('- CartesianGrid stroke colors');
console.log('- Tooltip backgrounds');
