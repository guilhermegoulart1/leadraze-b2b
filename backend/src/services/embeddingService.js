// backend/src/services/embeddingService.js
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Gera embedding vetorial para um texto usando OpenAI ada-002
 * @param {string} text - Texto para gerar embedding
 * @returns {Promise<number[]>} - Vetor de 1536 dimensões
 */
async function generateEmbedding(text) {
  try {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('Text must be a non-empty string');
    }

    console.log(`🔢 Gerando embedding para texto (${text.length} chars)...`);

    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text.trim()
    });

    if (!response.data || !response.data[0] || !response.data[0].embedding) {
      throw new Error('Invalid response from OpenAI embeddings API');
    }

    const embedding = response.data[0].embedding;

    console.log(`✅ Embedding gerado: ${embedding.length} dimensões`);

    return embedding;

  } catch (error) {
    console.error('❌ Erro ao gerar embedding:', error.message);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}

/**
 * Gera embeddings em lote para múltiplos textos
 * @param {string[]} texts - Array de textos
 * @returns {Promise<number[][]>} - Array de vetores
 */
async function generateEmbeddingsBatch(texts) {
  try {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new Error('Texts must be a non-empty array');
    }

    // Validar todos os textos
    const validTexts = texts.filter(text =>
      text && typeof text === 'string' && text.trim().length > 0
    );

    if (validTexts.length === 0) {
      throw new Error('No valid texts provided');
    }

    console.log(`🔢 Gerando ${validTexts.length} embeddings em lote...`);

    // OpenAI suporta até 2048 textos por request
    // Vamos processar em chunks de 100 para segurança
    const chunkSize = 100;
    const embeddings = [];

    for (let i = 0; i < validTexts.length; i += chunkSize) {
      const chunk = validTexts.slice(i, i + chunkSize);

      console.log(`   Processando chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(validTexts.length / chunkSize)}...`);

      const response = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: chunk.map(t => t.trim())
      });

      if (!response.data) {
        throw new Error('Invalid response from OpenAI embeddings API');
      }

      const chunkEmbeddings = response.data.map(item => item.embedding);
      embeddings.push(...chunkEmbeddings);
    }

    console.log(`✅ ${embeddings.length} embeddings gerados`);

    return embeddings;

  } catch (error) {
    console.error('❌ Erro ao gerar embeddings em lote:', error.message);
    throw new Error(`Failed to generate embeddings batch: ${error.message}`);
  }
}

/**
 * Prepara texto para embedding (limpeza e normalização)
 * @param {string} text - Texto bruto
 * @returns {string} - Texto limpo
 */
function prepareTextForEmbedding(text) {
  if (!text) return '';

  return text
    .trim()
    .replace(/\s+/g, ' ') // Normalizar espaços
    .replace(/\n+/g, '\n') // Normalizar quebras de linha
    .slice(0, 8000); // Limitar a 8000 chars (OpenAI aceita até ~8k tokens)
}

/**
 * Cria texto combinado para FAQ (pergunta + resposta)
 * @param {string} question - Pergunta
 * @param {string} answer - Resposta
 * @returns {string} - Texto combinado otimizado para busca
 */
function createFAQTextForEmbedding(question, answer) {
  // Formato otimizado para busca semântica
  const text = `Pergunta: ${question}\nResposta: ${answer}`;
  return prepareTextForEmbedding(text);
}

/**
 * Cria texto combinado para objeção
 * @param {string} objection - Objeção
 * @param {string} response - Resposta
 * @returns {string} - Texto combinado
 */
function createObjectionTextForEmbedding(objection, response) {
  const text = `Objeção: ${objection}\nComo responder: ${response}`;
  return prepareTextForEmbedding(text);
}

module.exports = {
  generateEmbedding,
  generateEmbeddingsBatch,
  prepareTextForEmbedding,
  createFAQTextForEmbedding,
  createObjectionTextForEmbedding
};
