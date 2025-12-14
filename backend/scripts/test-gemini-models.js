/**
 * Test which Gemini models are available
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.log('❌ GEMINI_API_KEY not found in .env');
  process.exit(1);
}

console.log('=== TESTING GEMINI MODELS ===\n');
console.log('API Key:', apiKey.substring(0, 10) + '...\n');

const modelsToTest = [
  'gemini-pro',
  'gemini-1.0-pro',
  'gemini-1.5-pro',
  'gemini-1.5-pro-latest',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-2.0-flash-exp',
  'gemini-2.0-flash',
];

async function testModel(modelName) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    const result = await model.generateContent('Say "Hello" in one word');
    const response = result.response.text();

    console.log(`✅ ${modelName}: OK - "${response.trim().substring(0, 30)}"`);
    return true;
  } catch (error) {
    console.log(`❌ ${modelName}: ${error.message.substring(0, 80)}`);
    return false;
  }
}

async function run() {
  for (const model of modelsToTest) {
    await testModel(model);
  }
  console.log('\n=== TEST COMPLETE ===');
}

run();
