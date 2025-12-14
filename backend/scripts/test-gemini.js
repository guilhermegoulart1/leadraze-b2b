/**
 * Test Gemini configuration
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { geminiService } = require('../src/config/gemini');

console.log('=== GEMINI CONFIGURATION TEST ===');
console.log('API Key exists:', !!process.env.GEMINI_API_KEY);
console.log('API Key length:', process.env.GEMINI_API_KEY?.length || 0);
console.log('Gemini configured:', geminiService.isConfigured());
console.log('');

if (geminiService.isConfigured()) {
  console.log('✅ Gemini está configurado corretamente!');
  console.log('O scraping de websites deve funcionar.');
} else {
  console.log('❌ Gemini NÃO está configurado!');
  console.log('Verifique se GEMINI_API_KEY está no arquivo .env');
}
