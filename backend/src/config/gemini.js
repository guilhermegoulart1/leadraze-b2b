/**
 * Google Gemini AI Configuration
 *
 * Used as fallback for large context tasks when GPT-4o-mini hits token limits
 * Gemini 1.5 Pro supports up to 1 million tokens of context
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
  constructor() {
    this.client = null;
    this.model = null;
  }

  // Lazy getter - verifica a API key no momento do uso, não no constructor
  get apiKey() {
    return process.env.GEMINI_API_KEY;
  }

  isConfigured() {
    return !!this.apiKey;
  }

  getClient() {
    if (!this.client && this.apiKey) {
      this.client = new GoogleGenerativeAI(this.apiKey);
      this.model = this.client.getGenerativeModel({ model: 'gemini-1.5-pro' });
    }
    return this.model;
  }

  /**
   * Generate text with Gemini
   * @param {string} systemPrompt - System instructions
   * @param {string} userPrompt - User message/content
   * @param {Object} options - Additional options
   * @returns {string} Generated text
   */
  async generateText(systemPrompt, userPrompt, options = {}) {
    const model = this.getClient();
    if (!model) {
      throw new Error('Gemini API not configured');
    }

    const generationConfig = {
      temperature: options.temperature || 0.7,
      maxOutputTokens: options.maxTokens || 4000,
    };

    // Combine system and user prompts for Gemini
    const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig,
    });

    const response = result.response;
    return response.text();
  }

  /**
   * Chat completion similar to OpenAI format
   * @param {Array} messages - Array of {role, content} messages
   * @param {Object} options - Additional options
   * @returns {string} Generated response
   */
  async chatCompletion(messages, options = {}) {
    const model = this.getClient();
    if (!model) {
      throw new Error('Gemini API not configured');
    }

    const generationConfig = {
      temperature: options.temperature || 0.7,
      maxOutputTokens: options.maxTokens || 4000,
    };

    // Convert OpenAI message format to Gemini format
    const contents = messages.map(msg => {
      if (msg.role === 'system') {
        // Gemini doesn't have a system role, prepend to first user message
        return { role: 'user', parts: [{ text: `[System Instructions]\n${msg.content}\n\n` }] };
      }
      return {
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      };
    });

    // Merge consecutive same-role messages
    const mergedContents = [];
    for (const content of contents) {
      if (mergedContents.length > 0 &&
          mergedContents[mergedContents.length - 1].role === content.role) {
        // Merge with previous message
        const lastContent = mergedContents[mergedContents.length - 1];
        lastContent.parts[0].text += '\n\n' + content.parts[0].text;
      } else {
        mergedContents.push(content);
      }
    }

    const result = await model.generateContent({
      contents: mergedContents,
      generationConfig,
    });

    const response = result.response;
    return response.text();
  }
}

const geminiService = new GeminiService();

module.exports = {
  geminiService
};
