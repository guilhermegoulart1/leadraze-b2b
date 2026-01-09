// backend/src/services/contactExtractionService.js

const OpenAI = require('openai');
const db = require('../config/database');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Regex patterns para extração de email e telefone
 */
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
const PHONE_REGEX = /(?:(?:\+|00)?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\s?)?\d{4}[-.\s]?\d{4}|(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,3}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}/g;

/**
 * Extrai email e telefone de uma mensagem usando regex
 */
function extractContactsWithRegex(message) {
  const emails = message.match(EMAIL_REGEX) || [];
  const phones = message.match(PHONE_REGEX) || [];

  return {
    email: emails.length > 0 ? emails[0] : null,
    phone: phones.length > 0 ? phones[0].replace(/\s/g, '') : null
  };
}

/**
 * Usa OpenAI para extrair informações de contato de forma mais inteligente
 * (captura contextos como "meu email é fulano arroba gmail ponto com")
 */
async function extractContactsWithAI(message) {
  try {
    const prompt = `Analise a mensagem abaixo e extraia APENAS email e telefone se houver.

MENSAGEM:
"${message}"

Retorne um JSON válido no formato:
{
  "email": "email@exemplo.com" ou null,
  "phone": "+55 11 99999-9999" ou null
}

REGRAS:
- Se o lead mencionou email de forma escrita (ex: "fulano arroba gmail ponto com"), converta para formato padrão
- Se o lead mencionou telefone de forma escrita, converta para formato padrão
- Se não houver email ou telefone, retorne null
- Retorne APENAS o JSON, sem explicações`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 150
    });

    const content = response.choices[0].message.content.trim();

    // Extrair JSON da resposta (pode vir com ```json ou ```\n)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { email: null, phone: null };
    }

    const extracted = JSON.parse(jsonMatch[0]);

    return {
      email: extracted.email || null,
      phone: extracted.phone || null
    };

  } catch (error) {
    console.error('Erro ao extrair contatos com AI:', error);
    return { email: null, phone: null };
  }
}

/**
 * Extrai informações de contato de uma mensagem
 * Usa regex primeiro (rápido) e se não encontrar, tenta AI (mais preciso)
 */
async function extractContacts(message) {
  // Tentar com regex primeiro (rápido)
  const regexResult = extractContactsWithRegex(message);

  // Se encontrou ambos com regex, retornar
  if (regexResult.email && regexResult.phone) {
    console.log('📧📞 Contatos extraídos com regex');
    return regexResult;
  }

  // Se não encontrou nenhum com regex, retornar vazio
  if (!regexResult.email && !regexResult.phone) {
    console.log('🔍 Nenhum contato encontrado com regex');
    return { email: null, phone: null };
  }

  // Se encontrou parcialmente com regex, tentar completar com AI
  console.log('🤖 Tentando extrair contatos com AI...');
  const aiResult = await extractContactsWithAI(message);

  return {
    email: regexResult.email || aiResult.email,
    phone: regexResult.phone || aiResult.phone
  };
}

/**
 * Atualiza os dados de contato na tabela contacts via opportunity_id
 */
async function updateContactInfo(opportunityId, { email, phone, source = 'conversation' }) {
  // Primeiro, buscar o contact_id da opportunity
  const oppResult = await db.query(
    'SELECT contact_id FROM opportunities WHERE id = $1',
    [opportunityId]
  );

  if (oppResult.rows.length === 0 || !oppResult.rows[0].contact_id) {
    console.log(`Opportunity ${opportunityId} não encontrada ou sem contact_id`);
    return null;
  }

  const contactId = oppResult.rows[0].contact_id;

  const updates = [];
  const values = [];
  let paramIndex = 1;

  if (email) {
    updates.push(`email = $${paramIndex++}`);
    values.push(email);
  }

  if (phone) {
    updates.push(`phone = $${paramIndex++}`);
    values.push(phone);
  }

  if (updates.length === 0) {
    return null;
  }

  values.push(contactId);

  const query = `
    UPDATE contacts
    SET ${updates.join(', ')}, updated_at = NOW()
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  const result = await db.query(query, values);
  return result.rows[0];
}

/**
 * Verifica se a opportunity já tem os dados de contato (via contacts)
 */
async function hasContactInfo(opportunityId) {
  const result = await db.query(
    `SELECT ct.email, ct.phone
     FROM opportunities o
     LEFT JOIN contacts ct ON o.contact_id = ct.id
     WHERE o.id = $1`,
    [opportunityId]
  );

  if (result.rows.length === 0) {
    return { hasEmail: false, hasPhone: false };
  }

  const contact = result.rows[0];
  return {
    hasEmail: !!contact.email,
    hasPhone: !!contact.phone
  };
}

/**
 * Processa uma mensagem de opportunity e atualiza contatos se encontrados
 */
async function processMessageForContacts(opportunityId, message) {
  try {
    // Verificar se já tem os dados
    const { hasEmail, hasPhone } = await hasContactInfo(opportunityId);

    // Se já tem ambos, não precisa extrair
    if (hasEmail && hasPhone) {
      console.log(`Opportunity ${opportunityId} já possui email e telefone`);
      return { extracted: false, reason: 'already_has_contacts' };
    }

    // Extrair contatos da mensagem
    const extracted = await extractContacts(message);

    // Filtrar apenas o que ainda não tem
    const toUpdate = {};
    if (extracted.email && !hasEmail) {
      toUpdate.email = extracted.email;
    }
    if (extracted.phone && !hasPhone) {
      toUpdate.phone = extracted.phone;
    }

    // Se não encontrou nada novo, retornar
    if (Object.keys(toUpdate).length === 0) {
      return { extracted: false, reason: 'no_new_contacts_found' };
    }

    // Atualizar contact via opportunity
    const updated = await updateContactInfo(opportunityId, {
      ...toUpdate,
      source: 'conversation'
    });

    console.log(`✅ Contatos atualizados para opportunity ${opportunityId}:`, toUpdate);

    return {
      extracted: true,
      contacts: toUpdate,
      contact: updated
    };

  } catch (error) {
    console.error('Erro ao processar mensagem para contatos:', error);
    throw error;
  }
}

module.exports = {
  extractContacts,
  extractContactsWithRegex,
  extractContactsWithAI,
  updateContactInfo,
  hasContactInfo,
  processMessageForContacts
};
