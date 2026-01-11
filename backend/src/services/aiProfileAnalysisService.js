// backend/src/services/aiProfileAnalysisService.js
// AI-powered LinkedIn profile analysis for enrichment

const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Analyze a LinkedIn profile and generate insights for sales context
 * Uses GPT-4o-mini for cost efficiency while maintaining quality
 *
 * @param {Object} profileData - Enriched profile data from LinkedIn
 * @returns {Promise<Object>} Analysis result with insights
 */
async function analyzeLinkedInProfile(profileData) {
  try {
    // Build a concise profile summary for the prompt
    const profileSummary = buildProfileSummary(profileData);

    if (!profileSummary) {
      console.log('[AI_ANALYSIS] Insufficient data for analysis');
      return null;
    }

    const prompt = `Analise este perfil profissional do LinkedIn e gere insights de vendas B2B.

PERFIL:
${profileSummary}

INSTRUÇÕES:
Retorne JSON com exatamente este formato:
{
  "resumo": "1-2 frases sobre quem é a pessoa e momento de carreira",
  "pontos_chave": ["ponto1", "ponto2", "ponto3"],
  "abordagem": "1 frase de como iniciar conversa/gancho"
}

REGRAS:
- resumo: Perfil profissional em 1-2 frases (max 150 chars)
- pontos_chave: 3 insights relevantes para vendas B2B (max 50 chars cada)
- abordagem: Gancho para PRIMEIRO CONTATO - deve ser SUTIL e nao invasivo (max 100 chars)
  * IMPORTANTE: É uma abordagem inicial, não pode ser direta demais
  * Nunca mencione vendas, produtos ou serviços diretamente
  * Foque em criar rapport e mostrar interesse genuíno na pessoa
  * Sugira algo consultivo baseado no perfil (ex: comentar transição de empresa, projeto recente, conquista)
  * Bom exemplo: "Perguntar sobre a experiência liderando times remotos na nova empresa"
  * Mau exemplo: "Oferecer solução para gestão de equipes"
- Seja direto, sem floreios
- Foque em: senioridade, poder de decisão, contexto de mercado
- Retorne APENAS o JSON, nada mais`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 300,
      response_format: { type: 'json_object' }
    });

    const responseText = completion.choices[0].message.content.trim();

    try {
      const analysis = JSON.parse(responseText);

      // Validate response structure
      if (!analysis.resumo || !analysis.pontos_chave || !analysis.abordagem) {
        console.log('[AI_ANALYSIS] Invalid response structure');
        return null;
      }

      console.log(`[AI_ANALYSIS] Analysis completed (${completion.usage.total_tokens} tokens)`);

      return {
        summary: analysis.resumo,
        keyPoints: analysis.pontos_chave.slice(0, 3), // Max 3 points
        approachHook: analysis.abordagem,
        analyzedAt: new Date().toISOString(),
        tokensUsed: completion.usage.total_tokens
      };

    } catch (parseError) {
      console.error('[AI_ANALYSIS] JSON parse error:', parseError.message);
      return null;
    }

  } catch (error) {
    console.error('[AI_ANALYSIS] Error:', error.message);
    return null;
  }
}

/**
 * Build a concise profile summary for the AI prompt
 * Optimized to use minimal tokens while providing key context
 */
function buildProfileSummary(profile) {
  const parts = [];

  // Name and headline (most important)
  if (profile.name) parts.push(`Nome: ${profile.name}`);
  if (profile.headline) parts.push(`Headline: ${profile.headline}`);

  // Current position (crucial for sales)
  if (profile.title || profile.company) {
    const currentRole = [];
    if (profile.title) currentRole.push(profile.title);
    if (profile.company) currentRole.push(`@ ${profile.company}`);
    parts.push(`Cargo atual: ${currentRole.join(' ')}`);
  }

  // Location (market context)
  if (profile.location) parts.push(`Local: ${profile.location}`);

  // Experience (career trajectory) - summarized
  let experience = profile.experience;
  if (typeof experience === 'string') {
    try { experience = JSON.parse(experience); } catch { experience = []; }
  }

  if (Array.isArray(experience) && experience.length > 0) {
    // Get last 3 positions for trajectory
    const recentJobs = experience.slice(0, 3).map(job => {
      const pos = job.position || job.title || '';
      const comp = job.company || job.company_name || '';
      return `${pos} @ ${comp}`.substring(0, 50);
    });
    if (recentJobs.length > 0) {
      parts.push(`Trajetória: ${recentJobs.join(' → ')}`);
    }
  }

  // Industry context from current company
  if (profile.industry) parts.push(`Setor: ${profile.industry}`);

  // Network size (influence indicator)
  if (profile.connections_count) {
    parts.push(`Conexões: ${profile.connections_count > 500 ? '500+' : profile.connections_count}`);
  }

  // Key flags
  const flags = [];
  if (profile.is_premium) flags.push('Premium');
  if (profile.is_creator) flags.push('Creator');
  if (profile.is_open_to_work) flags.push('Open to Work');
  if (profile.is_hiring) flags.push('Hiring');
  if (flags.length > 0) parts.push(`Badges: ${flags.join(', ')}`);

  // About/summary (if short enough)
  if (profile.about && profile.about.length < 200) {
    parts.push(`Sobre: ${profile.about.substring(0, 150)}`);
  }

  // Skills (top 5)
  let skills = profile.skills;
  if (typeof skills === 'string') {
    try { skills = JSON.parse(skills); } catch { skills = []; }
  }

  if (Array.isArray(skills) && skills.length > 0) {
    const skillNames = skills.slice(0, 5).map(s =>
      typeof s === 'string' ? s : (s.name || s.skill || '')
    ).filter(Boolean);
    if (skillNames.length > 0) {
      parts.push(`Skills: ${skillNames.join(', ')}`);
    }
  }

  return parts.length >= 2 ? parts.join('\n') : null;
}

module.exports = {
  analyzeLinkedInProfile,
  buildProfileSummary
};
