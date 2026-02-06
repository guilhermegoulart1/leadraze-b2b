// backend/src/services/ragService.js
// Retrieval-Augmented Generation Service

const db = require('../config/database');
const embeddingService = require('./embeddingService');

/**
 * Busca conhecimento relevante usando busca vetorial semântica
 * @param {string} agentId - ID do agente
 * @param {string} query - Pergunta/query do usuário
 * @param {Object} options - Opções de busca
 * @returns {Promise<Array>} - Conhecimento relevante encontrado
 */
async function searchRelevantKnowledge(agentId, query, options = {}) {
  try {
    const {
      limit = 5,
      type = null, // Filtrar por tipo específico
      minSimilarity = 0.7, // Similaridade mínima (0-1)
      includeTypes = null // Array de tipos para incluir
    } = options;

    // Validar query - não pode ser vazia
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      console.log(`⚠️ Query vazia, pulando busca de conhecimento`);
      return [];
    }

    console.log(`🔍 Buscando conhecimento relevante para: "${query}"`);

    // 1. Gerar embedding da query
    const queryEmbedding = await embeddingService.generateEmbedding(query);

    // 2. Converter array para formato PostgreSQL vector
    const vectorString = `[${queryEmbedding.join(',')}]`;

    // 3. Buscar conhecimento similar usando a função do banco
    let searchQuery;
    let params;

    if (type) {
      searchQuery = 'SELECT * FROM search_knowledge($1, $2::vector, $3, $4)';
      params = [agentId, vectorString, limit, type];
    } else if (includeTypes && includeTypes.length > 0) {
      // Buscar múltiplos tipos
      searchQuery = `
        SELECT
          k.id,
          k.type,
          k.question,
          k.answer,
          k.content,
          k.category,
          1 - (k.embedding <=> $2::vector) AS similarity
        FROM ai_agent_knowledge k
        WHERE k.ai_agent_id = $1
          AND k.active = true
          AND k.type = ANY($3)
        ORDER BY k.embedding <=> $2::vector
        LIMIT $4
      `;
      params = [agentId, vectorString, includeTypes, limit];
    } else {
      searchQuery = 'SELECT * FROM search_knowledge($1, $2::vector, $3)';
      params = [agentId, vectorString, limit];
    }

    const result = await db.query(searchQuery, params);

    // 4. Filtrar por similaridade mínima
    const relevantResults = result.rows.filter(row =>
      row.similarity >= minSimilarity
    );

    console.log(`✅ Encontrados ${relevantResults.length} resultados relevantes (${result.rows.length} totais, filtrados por similarity >= ${minSimilarity})`);

    relevantResults.forEach((r, i) => {
      console.log(`   ${i + 1}. [${r.type}] ${r.question || r.content?.substring(0, 50) || 'N/A'} (similarity: ${r.similarity.toFixed(3)})`);
    });

    return relevantResults;

  } catch (error) {
    console.error('❌ Erro ao buscar conhecimento relevante:', error.message);
    throw error;
  }
}

/**
 * Adiciona novo conhecimento à base do agente
 * @param {Object} knowledge - Dados do conhecimento
 * @returns {Promise<Object>} - Conhecimento inserido
 */
async function addKnowledge(knowledge) {
  try {
    const {
      ai_agent_id,
      type, // 'faq', 'document', 'objection', 'product_info', 'case_study'
      question,
      answer,
      content,
      category,
      tags = [],
      metadata = {},
      always_include = false
    } = knowledge;

    console.log(`➕ Adicionando conhecimento [${type}] ao agente ${ai_agent_id}...`);

    // 1. Preparar texto para embedding
    let textForEmbedding;

    switch (type) {
      case 'faq':
        if (!question || !answer) {
          throw new Error('FAQ requires question and answer');
        }
        textForEmbedding = embeddingService.createFAQTextForEmbedding(question, answer);
        break;

      case 'objection':
        if (!question || !answer) {
          throw new Error('Objection requires question (objection) and answer (response)');
        }
        textForEmbedding = embeddingService.createObjectionTextForEmbedding(question, answer);
        break;

      case 'document':
      case 'product_info':
      case 'case_study':
        if (!content) {
          throw new Error(`${type} requires content`);
        }
        textForEmbedding = embeddingService.prepareTextForEmbedding(content);
        break;

      default:
        throw new Error(`Unknown knowledge type: ${type}`);
    }

    // 2. Gerar embedding
    const embedding = await embeddingService.generateEmbedding(textForEmbedding);

    // 3. Inserir no banco
    const vectorString = `[${embedding.join(',')}]`;

    const result = await db.query(
      `INSERT INTO ai_agent_knowledge
       (ai_agent_id, type, question, answer, content, category, tags, metadata, embedding, always_include)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector, $10)
       RETURNING *`,
      [
        ai_agent_id,
        type,
        question || null,
        answer || null,
        content || null,
        category || null,
        tags,
        JSON.stringify(metadata),
        vectorString,
        always_include
      ]
    );

    console.log(`✅ Conhecimento adicionado: ${result.rows[0].id}`);

    return result.rows[0];

  } catch (error) {
    console.error('❌ Erro ao adicionar conhecimento:', error.message);
    throw error;
  }
}

/**
 * Adiciona múltiplos conhecimentos em lote
 * @param {string} agentId - ID do agente
 * @param {Array} knowledgeItems - Array de conhecimentos
 * @returns {Promise<Array>} - Conhecimentos inseridos
 */
async function addKnowledgeBatch(agentId, knowledgeItems) {
  try {
    console.log(`➕ Adicionando ${knowledgeItems.length} conhecimentos em lote...`);

    const results = [];

    for (const item of knowledgeItems) {
      const knowledge = await addKnowledge({
        ...item,
        ai_agent_id: agentId
      });
      results.push(knowledge);
    }

    console.log(`✅ ${results.length} conhecimentos adicionados`);

    return results;

  } catch (error) {
    console.error('❌ Erro ao adicionar conhecimentos em lote:', error.message);
    throw error;
  }
}

/**
 * Atualiza conhecimento existente (regenera embedding se necessário)
 * @param {string} knowledgeId - ID do conhecimento
 * @param {Object} updates - Campos para atualizar
 * @returns {Promise<Object>} - Conhecimento atualizado
 */
async function updateKnowledge(knowledgeId, updates) {
  try {
    console.log(`📝 Atualizando conhecimento ${knowledgeId}...`);

    // Buscar conhecimento atual
    const current = await db.query(
      'SELECT * FROM ai_agent_knowledge WHERE id = $1',
      [knowledgeId]
    );

    if (current.rows.length === 0) {
      throw new Error('Knowledge not found');
    }

    const currentData = current.rows[0];

    // Verificar se precisa regenerar embedding
    const needsNewEmbedding = updates.question || updates.answer || updates.content;

    if (needsNewEmbedding) {
      // Preparar novo texto
      let textForEmbedding;

      const question = updates.question || currentData.question;
      const answer = updates.answer || currentData.answer;
      const content = updates.content || currentData.content;

      switch (currentData.type) {
        case 'faq':
          textForEmbedding = embeddingService.createFAQTextForEmbedding(question, answer);
          break;
        case 'objection':
          textForEmbedding = embeddingService.createObjectionTextForEmbedding(question, answer);
          break;
        default:
          textForEmbedding = embeddingService.prepareTextForEmbedding(content);
      }

      // Gerar novo embedding
      const embedding = await embeddingService.generateEmbedding(textForEmbedding);
      updates.embedding = `[${embedding.join(',')}]`;
    }

    // Construir query de update
    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map((key, i) => {
      if (key === 'embedding') {
        return `${key} = $${i + 1}::vector`;
      }
      return `${key} = $${i + 1}`;
    }).join(', ');

    const result = await db.query(
      `UPDATE ai_agent_knowledge SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`,
      [...values, knowledgeId]
    );

    console.log(`✅ Conhecimento atualizado`);

    return result.rows[0];

  } catch (error) {
    console.error('❌ Erro ao atualizar conhecimento:', error.message);
    throw error;
  }
}

/**
 * Remove conhecimento
 * @param {string} knowledgeId - ID do conhecimento
 * @returns {Promise<boolean>} - Sucesso
 */
async function deleteKnowledge(knowledgeId) {
  try {
    console.log(`🗑️ Removendo conhecimento ${knowledgeId}...`);

    await db.query(
      'DELETE FROM ai_agent_knowledge WHERE id = $1',
      [knowledgeId]
    );

    console.log(`✅ Conhecimento removido`);

    return true;

  } catch (error) {
    console.error('❌ Erro ao remover conhecimento:', error.message);
    throw error;
  }
}

/**
 * Lista todo conhecimento de um agente
 * @param {string} agentId - ID do agente
 * @param {Object} filters - Filtros opcionais
 * @returns {Promise<Array>} - Lista de conhecimentos
 */
async function listKnowledge(agentId, filters = {}) {
  try {
    const { type, category, active = true } = filters;

    let query = 'SELECT * FROM ai_agent_knowledge WHERE ai_agent_id = $1';
    const params = [agentId];
    let paramIndex = 2;

    if (active !== null) {
      query += ` AND active = $${paramIndex}`;
      params.push(active);
      paramIndex++;
    }

    if (type) {
      query += ` AND type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    query += ' ORDER BY always_include DESC, created_at DESC';

    const result = await db.query(query, params);

    return result.rows;

  } catch (error) {
    console.error('❌ Erro ao listar conhecimento:', error.message);
    throw error;
  }
}

/**
 * Busca conhecimento essencial (always_include = true) de um agente
 * Esses itens são SEMPRE incluídos no contexto, independente de busca vetorial
 * @param {string} agentId - ID do agente
 * @returns {Promise<Array>} - Conhecimentos essenciais
 */
async function getEssentialKnowledge(agentId) {
  try {
    const result = await db.query(
      `SELECT id, type, question, answer, content, category
       FROM ai_agent_knowledge
       WHERE ai_agent_id = $1
         AND active = true
         AND always_include = true
       ORDER BY type, created_at`,
      [agentId]
    );

    return result.rows;

  } catch (error) {
    console.error('❌ Erro ao buscar conhecimento essencial:', error.message);
    throw error;
  }
}

/**
 * Formata conhecimento relevante para injetar no prompt
 * @param {Array} knowledgeResults - Resultados da busca
 * @returns {string} - Conhecimento formatado para o prompt
 */
function formatKnowledgeForPrompt(knowledgeResults) {
  if (!knowledgeResults || knowledgeResults.length === 0) {
    return '';
  }

  const sections = {
    faq: [],
    objection: [],
    product_info: [],
    case_study: [],
    document: []
  };

  // Agrupar por tipo
  knowledgeResults.forEach(item => {
    if (sections[item.type]) {
      sections[item.type].push(item);
    }
  });

  let formatted = '\n## CONTEXTO RELEVANTE DA BASE DE CONHECIMENTO:\n\n';

  // FAQs
  if (sections.faq.length > 0) {
    formatted += '### Perguntas Frequentes:\n';
    sections.faq.forEach((faq, i) => {
      formatted += `${i + 1}. **P:** ${faq.question}\n   **R:** ${faq.answer}\n\n`;
    });
  }

  // Objeções
  if (sections.objection.length > 0) {
    formatted += '### Objeções Comuns:\n';
    sections.objection.forEach((obj, i) => {
      formatted += `${i + 1}. **Objeção:** ${obj.question}\n   **Como responder:** ${obj.answer}\n\n`;
    });
  }

  // Informações de Produto
  if (sections.product_info.length > 0) {
    formatted += '### Informações de Produtos/Serviços:\n';
    sections.product_info.forEach((info, i) => {
      formatted += `${i + 1}. ${info.content}\n\n`;
    });
  }

  // Casos de Sucesso
  if (sections.case_study.length > 0) {
    formatted += '### Casos de Sucesso:\n';
    sections.case_study.forEach((cs, i) => {
      formatted += `${i + 1}. ${cs.content}\n\n`;
    });
  }

  // Documentos
  if (sections.document.length > 0) {
    formatted += '### Documentação:\n';
    sections.document.forEach((doc, i) => {
      formatted += `${i + 1}. ${doc.content}\n\n`;
    });
  }

  return formatted;
}

/**
 * Cria chave única normalizada para comparação de conteúdo de knowledge items
 */
function createKnowledgeContentKey(question, answer) {
  const normalizedQ = (question || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const normalizedA = (answer || '').trim().replace(/\s+/g, ' ').toLowerCase();
  return `${normalizedQ}|||${normalizedA}`;
}

/**
 * Compara knowledge items existentes com incoming e retorna diff
 * @param {Array} existing - Items atuais do banco
 * @param {Array} incoming - Items vindos do config
 * @param {string} type - 'faq' ou 'objection'
 * @returns {{ toAdd: Array, toDelete: number[], unchanged: number }}
 */
function diffKnowledge(existing, incoming, type) {
  const existingMap = new Map();
  (existing || []).forEach(item => {
    const key = createKnowledgeContentKey(item.question, item.answer);
    existingMap.set(key, item);
  });

  const incomingMap = new Map();
  const toAdd = [];

  (incoming || []).forEach(item => {
    const question = type === 'objection' ? (item.objection || item.question) : item.question;
    const answer = type === 'objection' ? (item.response || item.answer) : item.answer;

    if (!question || !answer || !question.trim() || !answer.trim()) return;

    const key = createKnowledgeContentKey(question, answer);
    incomingMap.set(key, { question, answer });

    if (!existingMap.has(key)) {
      toAdd.push({ question, answer });
    }
  });

  const toDelete = [];
  let unchanged = 0;

  existingMap.forEach((item, key) => {
    if (incomingMap.has(key)) {
      unchanged++;
    } else {
      toDelete.push(item.id);
    }
  });

  return { toAdd, toDelete, unchanged };
}

/**
 * Sincroniza FAQ e objeções do config JSON para a tabela ai_agent_knowledge
 * Usa smart diff para evitar re-gerar embeddings de itens que não mudaram
 * @param {string} agentId - ID do agente
 * @param {Object} config - Objeto config do agente (pode ser JSON string ou objeto)
 * @returns {Promise<Object>} - Estatísticas de sincronização
 */
async function syncKnowledgeFromConfig(agentId, config) {
  try {
    const configObj = typeof config === 'string' ? JSON.parse(config) : (config || {});

    console.log(`🔄 [syncKnowledgeFromConfig] Sincronizando conhecimento para agente ${agentId}...`);

    // 1. Buscar FAQs e objeções existentes no banco
    const existingKnowledge = await db.query(
      `SELECT id, type, question, answer
       FROM ai_agent_knowledge
       WHERE ai_agent_id = $1 AND type IN ('faq', 'objection')
       ORDER BY type, created_at`,
      [agentId]
    );

    const existingFAQs = existingKnowledge.rows.filter(k => k.type === 'faq');
    const existingObjections = existingKnowledge.rows.filter(k => k.type === 'objection');

    const incomingFAQs = configObj.faq || [];
    const incomingObjections = configObj.objections || [];

    // 2. Diff
    const faqDiff = diffKnowledge(existingFAQs, incomingFAQs, 'faq');
    const objDiff = diffKnowledge(existingObjections, incomingObjections, 'objection');

    const totalChanges = faqDiff.toAdd.length + faqDiff.toDelete.length +
                         objDiff.toAdd.length + objDiff.toDelete.length;

    console.log(`📊 [syncKnowledgeFromConfig] Diff: FAQs(+${faqDiff.toAdd.length} -${faqDiff.toDelete.length} =${faqDiff.unchanged}) Objeções(+${objDiff.toAdd.length} -${objDiff.toDelete.length} =${objDiff.unchanged})`);

    // 3. Se nada mudou, pular completamente
    if (totalChanges === 0) {
      console.log(`⚡ [syncKnowledgeFromConfig] Nenhuma mudança detectada, pulando sincronização (0 API calls)`);
      return {
        success: true,
        faqCount: faqDiff.unchanged,
        objectionCount: objDiff.unchanged,
        deletedCount: 0,
        addedCount: 0,
        skipped: true
      };
    }

    // 4. Deletar apenas os itens removidos
    let deletedCount = 0;
    const idsToDelete = [...faqDiff.toDelete, ...objDiff.toDelete];
    if (idsToDelete.length > 0) {
      const deleteResult = await db.query(
        `DELETE FROM ai_agent_knowledge WHERE id = ANY($1) RETURNING id`,
        [idsToDelete]
      );
      deletedCount = deleteResult.rowCount;
      console.log(`🗑️ Removidos ${deletedCount} itens obsoletos`);
    }

    // 5. Adicionar apenas FAQs novos
    let addedFAQCount = 0;
    for (const faq of faqDiff.toAdd) {
      try {
        await addKnowledge({
          ai_agent_id: agentId,
          type: 'faq',
          question: faq.question,
          answer: faq.answer,
          always_include: false
        });
        addedFAQCount++;
      } catch (error) {
        console.error(`⚠️ Erro ao adicionar FAQ "${faq.question?.substring(0, 30)}...":`, error.message);
      }
    }

    // 6. Adicionar apenas objeções novas
    let addedObjCount = 0;
    for (const obj of objDiff.toAdd) {
      try {
        await addKnowledge({
          ai_agent_id: agentId,
          type: 'objection',
          question: obj.question,
          answer: obj.answer,
          always_include: false
        });
        addedObjCount++;
      } catch (error) {
        console.error(`⚠️ Erro ao adicionar objeção "${obj.question?.substring(0, 30)}...":`, error.message);
      }
    }

    const totalAdded = addedFAQCount + addedObjCount;
    console.log(`✅ Sincronização concluída: +${totalAdded} novos, -${deletedCount} removidos, ${faqDiff.unchanged + objDiff.unchanged} mantidos (${totalAdded} API calls)`);

    return {
      success: true,
      faqCount: faqDiff.unchanged + addedFAQCount,
      objectionCount: objDiff.unchanged + addedObjCount,
      deletedCount,
      addedCount: totalAdded,
      skipped: false
    };

  } catch (error) {
    console.error('❌ Erro ao sincronizar conhecimento do config:', error.message);
    throw error;
  }
}

module.exports = {
  searchRelevantKnowledge,
  addKnowledge,
  addKnowledgeBatch,
  updateKnowledge,
  deleteKnowledge,
  listKnowledge,
  getEssentialKnowledge,
  formatKnowledgeForPrompt,
  syncKnowledgeFromConfig
};
