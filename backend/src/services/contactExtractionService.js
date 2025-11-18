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
 * Atualiza os dados de contato de um lead
 */
async function updateLeadContacts(leadId, { email, phone, source = 'conversation' }) {
  const updates = [];
  const values = [];
  let paramIndex = 1;

  if (email) {
    updates.push(`email = $${paramIndex++}`);
    updates.push(`email_captured_at = NOW()`);
    updates.push(`email_source = $${paramIndex++}`);
    values.push(email, source);
  }

  if (phone) {
    updates.push(`phone = $${paramIndex++}`);
    updates.push(`phone_captured_at = NOW()`);
    updates.push(`phone_source = $${paramIndex++}`);
    values.push(phone, source);
  }

  if (updates.length === 0) {
    return null;
  }

  values.push(leadId);

  const query = `
    UPDATE leads
    SET ${updates.join(', ')}, updated_at = NOW()
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  const result = await db.query(query, values);
  return result.rows[0];
}

/**
 * Verifica se o lead já tem os dados de contato
 */
async function hasContactInfo(leadId) {
  const result = await db.query(
    'SELECT email, phone FROM leads WHERE id = $1',
    [leadId]
  );

  if (result.rows.length === 0) {
    return { hasEmail: false, hasPhone: false };
  }

  const lead = result.rows[0];
  return {
    hasEmail: !!lead.email,
    hasPhone: !!lead.phone
  };
}

/**
 * Processa uma mensagem de lead e atualiza contatos se encontrados
 */
async function processMessageForContacts(leadId, message) {
  try {
    // Verificar se já tem os dados
    const { hasEmail, hasPhone } = await hasContactInfo(leadId);

    // Se já tem ambos, não precisa extrair
    if (hasEmail && hasPhone) {
      console.log(`Lead ${leadId} já possui email e telefone`);
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

    // Atualizar lead
    const updated = await updateLeadContacts(leadId, {
      ...toUpdate,
      source: 'conversation'
    });

    console.log(`✅ Contatos atualizados para lead ${leadId}:`, toUpdate);

    return {
      extracted: true,
      contacts: toUpdate,
      lead: updated
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
  updateLeadContacts,
  hasContactInfo,
  processMessageForContacts
};
