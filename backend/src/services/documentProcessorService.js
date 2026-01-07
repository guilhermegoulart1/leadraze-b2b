// backend/src/services/documentProcessorService.js
// Service para processar documentos (PDF, DOCX, TXT) e extrair texto em chunks

const fs = require('fs');
const path = require('path');

// Lazy load heavy dependencies
let pdfParse = null;
let mammoth = null;

const getPdfParse = () => {
  if (!pdfParse) {
    pdfParse = require('pdf-parse');
  }
  return pdfParse;
};

const getMammoth = () => {
  if (!mammoth) {
    mammoth = require('mammoth');
  }
  return mammoth;
};

/**
 * Tipos de arquivo suportados
 */
const SUPPORTED_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'text/plain': 'txt',
  'text/markdown': 'md'
};

/**
 * Limites de tamanho
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_CHUNK_SIZE = 1000; // Caracteres por chunk (aproximadamente 250 tokens)
const CHUNK_OVERLAP = 200; // Sobreposicao entre chunks para contexto

/**
 * Verifica se o tipo de arquivo e suportado
 * @param {string} mimeType - Tipo MIME do arquivo
 * @returns {boolean}
 */
function isSupportedType(mimeType) {
  return !!SUPPORTED_TYPES[mimeType];
}

/**
 * Retorna a extensao baseada no tipo MIME
 * @param {string} mimeType - Tipo MIME
 * @returns {string}
 */
function getExtension(mimeType) {
  return SUPPORTED_TYPES[mimeType] || 'unknown';
}

/**
 * Extrai texto de um arquivo PDF
 * @param {Buffer} buffer - Buffer do arquivo
 * @returns {Promise<string>} - Texto extraido
 */
async function extractFromPdf(buffer) {
  const pdf = getPdfParse();
  const data = await pdf(buffer);
  return data.text || '';
}

/**
 * Extrai texto de um arquivo DOCX
 * @param {Buffer} buffer - Buffer do arquivo
 * @returns {Promise<string>} - Texto extraido
 */
async function extractFromDocx(buffer) {
  const mammothLib = getMammoth();
  const result = await mammothLib.extractRawText({ buffer });
  return result.value || '';
}

/**
 * Extrai texto de um arquivo TXT/MD
 * @param {Buffer} buffer - Buffer do arquivo
 * @returns {string} - Texto extraido
 */
function extractFromText(buffer) {
  return buffer.toString('utf-8');
}

/**
 * Extrai texto de um arquivo baseado no tipo
 * @param {Buffer} buffer - Buffer do arquivo
 * @param {string} mimeType - Tipo MIME do arquivo
 * @returns {Promise<string>} - Texto extraido
 */
async function extractText(buffer, mimeType) {
  const type = getExtension(mimeType);

  switch (type) {
    case 'pdf':
      return await extractFromPdf(buffer);
    case 'docx':
    case 'doc':
      return await extractFromDocx(buffer);
    case 'txt':
    case 'md':
      return extractFromText(buffer);
    default:
      throw new Error(`Tipo de arquivo nao suportado: ${mimeType}`);
  }
}

/**
 * Divide texto em chunks com sobreposicao
 * @param {string} text - Texto para dividir
 * @param {number} maxSize - Tamanho maximo de cada chunk
 * @param {number} overlap - Sobreposicao entre chunks
 * @returns {Array<{content: string, index: number}>} - Array de chunks
 */
function splitIntoChunks(text, maxSize = MAX_CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const chunks = [];

  // Limpar texto
  const cleanText = text
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!cleanText || cleanText.length === 0) {
    return chunks;
  }

  // Se o texto e menor que o tamanho maximo, retornar como um unico chunk
  if (cleanText.length <= maxSize) {
    return [{ content: cleanText, index: 0 }];
  }

  // Dividir por paragrafos primeiro
  const paragraphs = cleanText.split(/\n\n+/);

  let currentChunk = '';
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    // Se o paragrafo sozinho e maior que o tamanho maximo, dividir por sentencas
    if (paragraph.length > maxSize) {
      // Adicionar chunk atual se existir
      if (currentChunk.trim()) {
        chunks.push({ content: currentChunk.trim(), index: chunkIndex++ });
        currentChunk = '';
      }

      // Dividir paragrafo grande por sentencas
      const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
      let sentenceChunk = '';

      for (const sentence of sentences) {
        if ((sentenceChunk + sentence).length > maxSize) {
          if (sentenceChunk.trim()) {
            chunks.push({ content: sentenceChunk.trim(), index: chunkIndex++ });
            // Manter sobreposicao
            const words = sentenceChunk.split(' ');
            sentenceChunk = words.slice(-Math.floor(overlap / 10)).join(' ') + ' ';
          }
        }
        sentenceChunk += sentence + ' ';
      }

      if (sentenceChunk.trim()) {
        currentChunk = sentenceChunk;
      }
    } else {
      // Verificar se adicionar o paragrafo excede o limite
      if ((currentChunk + '\n\n' + paragraph).length > maxSize) {
        if (currentChunk.trim()) {
          chunks.push({ content: currentChunk.trim(), index: chunkIndex++ });
          // Manter sobreposicao - pegar ultimas palavras
          const words = currentChunk.split(' ');
          currentChunk = words.slice(-Math.floor(overlap / 10)).join(' ') + '\n\n' + paragraph;
        } else {
          currentChunk = paragraph;
        }
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }
  }

  // Adicionar ultimo chunk
  if (currentChunk.trim()) {
    chunks.push({ content: currentChunk.trim(), index: chunkIndex });
  }

  return chunks;
}

/**
 * Processa um documento completo
 * @param {Object} file - Arquivo do multer {buffer, mimetype, originalname, size}
 * @returns {Promise<Object>} - {success, chunks, metadata}
 */
async function processDocument(file) {
  try {
    // Validar arquivo
    if (!file || !file.buffer) {
      throw new Error('Arquivo invalido ou vazio');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`Arquivo muito grande. Maximo permitido: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    if (!isSupportedType(file.mimetype)) {
      throw new Error(`Tipo de arquivo nao suportado: ${file.mimetype}. Suportados: PDF, DOCX, TXT`);
    }

    console.log(`📄 Processando documento: ${file.originalname} (${file.mimetype})`);

    // Extrair texto
    const text = await extractText(file.buffer, file.mimetype);

    if (!text || text.trim().length === 0) {
      throw new Error('Nao foi possivel extrair texto do documento');
    }

    console.log(`📝 Texto extraido: ${text.length} caracteres`);

    // Dividir em chunks
    const chunks = splitIntoChunks(text);

    console.log(`✂️ Documento dividido em ${chunks.length} chunks`);

    return {
      success: true,
      chunks,
      metadata: {
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        textLength: text.length,
        chunkCount: chunks.length,
        processedAt: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error(`❌ Erro ao processar documento: ${error.message}`);
    return {
      success: false,
      error: error.message,
      chunks: [],
      metadata: {
        filename: file?.originalname || 'unknown',
        processedAt: new Date().toISOString()
      }
    };
  }
}

/**
 * Processa documento de um caminho de arquivo
 * @param {string} filePath - Caminho do arquivo
 * @returns {Promise<Object>} - Resultado do processamento
 */
async function processDocumentFromPath(filePath) {
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();

  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.txt': 'text/plain',
    '.md': 'text/markdown'
  };

  const file = {
    buffer,
    mimetype: mimeTypes[ext] || 'application/octet-stream',
    originalname: path.basename(filePath),
    size: buffer.length
  };

  return processDocument(file);
}

module.exports = {
  processDocument,
  processDocumentFromPath,
  extractText,
  splitIntoChunks,
  isSupportedType,
  getExtension,
  SUPPORTED_TYPES,
  MAX_FILE_SIZE,
  MAX_CHUNK_SIZE
};
