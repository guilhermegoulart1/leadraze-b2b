import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const SCRAPFLY_API_KEY = process.env.SCRAPFLY_API_KEY;
const INSTAGRAM_APP_ID = '936619743392459';

// Contadores globais
let totalCreditsUsed = 0;
let remainingCredits = null;

/**
 * Faz uma requisição via Scrapfly
 */
async function scrapflyRequest(targetUrl, customHeaders = {}) {
  const params = new URLSearchParams({
    key: SCRAPFLY_API_KEY,
    url: targetUrl,
    asp: 'true',
    country: 'US',
  });

  for (const [key, value] of Object.entries(customHeaders)) {
    params.append(`headers[${key}]`, value);
  }

  const url = `https://api.scrapfly.io/scrape?${params.toString()}`;

  const response = await fetch(url);
  const data = await response.json();

  // Atualizar contadores de créditos
  if (data.context?.cost) {
    const cost = typeof data.context.cost === 'object' ?
      Object.values(data.context.cost).reduce((a, b) => a + b, 0) :
      data.context.cost;
    totalCreditsUsed += cost;
  }
  if (data.context?.remaining_credits) {
    remainingCredits = data.context.remaining_credits;
  }

  if (!response.ok || data.result?.error) {
    throw new Error(data.result?.error?.message || JSON.stringify(data));
  }

  return data;
}

/**
 * Busca perfil e posts de um usuário
 */
async function getProfileAndPosts(username, maxPosts = 12) {
  console.log(`\n📥 Buscando perfil de @${username} (com render JS)...`);

  const targetUrl = `https://www.instagram.com/${username}/`;

  // Usar render_js para carregar os posts
  const params = new URLSearchParams({
    key: SCRAPFLY_API_KEY,
    url: targetUrl,
    asp: 'true',
    country: 'US',
    render_js: 'true',
    rendering_wait: '3000',
  });

  const response = await fetch(`https://api.scrapfly.io/scrape?${params.toString()}`);
  const data = await response.json();

  // Atualizar contadores
  if (data.context?.cost) {
    const cost = typeof data.context.cost === 'object' ?
      Object.values(data.context.cost).reduce((a, b) => a + b, 0) :
      data.context.cost;
    totalCreditsUsed += cost;
  }
  if (data.context?.remaining_credits) {
    remainingCredits = data.context.remaining_credits;
  }

  if (!response.ok || data.result?.error) {
    throw new Error(data.result?.error?.message || 'Erro ao buscar perfil');
  }

  const html = data.result?.content;

  if (!html) {
    throw new Error('Sem conteúdo HTML retornado');
  }

  console.log(`📄 HTML do perfil: ${html.length} caracteres`);

  // Extrair shortcodes dos posts do HTML
  const shortcodes = [];

  // Padrão 1: links de posts
  const postMatches = html.matchAll(/\/p\/([A-Za-z0-9_-]+)\//g);
  for (const m of postMatches) {
    if (!shortcodes.includes(m[1])) {
      shortcodes.push(m[1]);
    }
  }

  // Padrão 2: "shortcode":"XXX"
  const shortcodeMatches = html.matchAll(/"shortcode":\s*"([A-Za-z0-9_-]+)"/g);
  for (const m of shortcodeMatches) {
    if (!shortcodes.includes(m[1])) {
      shortcodes.push(m[1]);
    }
  }

  // Debug: salvar HTML
  fs.writeFileSync(path.join(process.cwd(), `results/debug_profile_${username}.html`), html);
  console.log(`💾 HTML do perfil salvo para debug`);

  const uniqueShortcodes = [...new Set(shortcodes)].slice(0, maxPosts);
  console.log(`📊 Posts encontrados: ${uniqueShortcodes.length}`);

  // Se não encontrou posts, tentar extrair de outra forma
  if (uniqueShortcodes.length === 0) {
    // Buscar padrão de código no HTML (media code)
    const codeMatches = html.matchAll(/"code":\s*"([A-Za-z0-9_-]+)"/g);
    for (const m of codeMatches) {
      if (!uniqueShortcodes.includes(m[1]) && m[1].length > 5) {
        uniqueShortcodes.push(m[1]);
      }
    }
    console.log(`📊 Posts encontrados (via code): ${uniqueShortcodes.length}`);
  }

  return {
    username,
    shortcodes: uniqueShortcodes.slice(0, maxPosts),
    html
  };
}

/**
 * Extrai usernames de comentaristas de um post
 */
async function getCommentersFromPost(shortcode) {
  console.log(`\n📥 Buscando comentários do post ${shortcode}...`);

  const targetUrl = `https://www.instagram.com/p/${shortcode}/`;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };

  const response = await scrapflyRequest(targetUrl, headers);
  const html = response.result?.content;

  if (!html) {
    return [];
  }

  // Extrair usernames do HTML
  const usernames = [];
  const usernameMatches = html.matchAll(/"username":\s*"([^"]+)"/g);
  for (const m of usernameMatches) {
    if (m[1] && !m[1].includes('.') && m[1].length < 30) {
      usernames.push(m[1]);
    }
  }

  const unique = [...new Set(usernames)];
  console.log(`   ✅ ${unique.length} usernames encontrados`);

  return unique;
}

/**
 * Função principal
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Uso:
  node get-commenters.js @username [--posts N]
  node get-commenters.js https://instagram.com/p/XXX/

Exemplos:
  node get-commenters.js @joeljota --posts 5
  node get-commenters.js https://www.instagram.com/p/DRfC0SWANxe/

Opções:
  --posts N    Número máximo de posts a buscar (padrão: 12)
`);
    process.exit(1);
  }

  if (!SCRAPFLY_API_KEY) {
    console.error('❌ SCRAPFLY_API_KEY não configurada no .env');
    process.exit(1);
  }

  // Parse argumentos
  let input = args[0];
  let maxPosts = 12;

  const postsIndex = args.indexOf('--posts');
  if (postsIndex !== -1 && args[postsIndex + 1]) {
    maxPosts = parseInt(args[postsIndex + 1], 10);
  }

  console.log('='.repeat(60));
  console.log('🚀 SCRAPFLY INSTAGRAM COMMENTS SCRAPER');
  console.log('='.repeat(60));

  try {
    let allUsernames = [];
    let profileUsername = '';

    // Verificar se é um @ ou uma URL
    if (input.startsWith('@') || !input.includes('instagram.com')) {
      // É um username - buscar perfil e posts
      profileUsername = input.replace('@', '');
      console.log(`👤 Perfil: @${profileUsername}`);
      console.log(`📊 Máximo de posts: ${maxPosts}`);

      const profile = await getProfileAndPosts(profileUsername, maxPosts);

      if (profile.shortcodes.length === 0) {
        console.log('❌ Nenhum post encontrado');
        process.exit(1);
      }

      console.log(`\n🔄 Processando ${profile.shortcodes.length} posts...`);

      // Buscar comentaristas de cada post
      for (let i = 0; i < profile.shortcodes.length; i++) {
        const shortcode = profile.shortcodes[i];
        console.log(`\n[${i + 1}/${profile.shortcodes.length}] Post: ${shortcode}`);

        try {
          const commenters = await getCommentersFromPost(shortcode);
          allUsernames.push(...commenters);
        } catch (error) {
          console.log(`   ⚠️ Erro: ${error.message}`);
        }

        // Pequena pausa entre requisições
        if (i < profile.shortcodes.length - 1) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }

    } else {
      // É uma URL de post único
      const match = input.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
      if (!match) {
        console.error('❌ URL inválida');
        process.exit(1);
      }

      const shortcode = match[1];
      profileUsername = `post_${shortcode}`;
      console.log(`📎 Post: ${shortcode}`);

      const commenters = await getCommentersFromPost(shortcode);
      allUsernames = commenters;
    }

    // Remover duplicatas e o próprio perfil
    const uniqueUsernames = [...new Set(allUsernames)]
      .filter(u => u !== profileUsername);

    // Preparar resultado
    const result = {
      profile: profileUsername,
      total_comentaristas: uniqueUsernames.length,
      credits_used: totalCreditsUsed,
      remaining_credits: remainingCredits,
      usernames: uniqueUsernames
    };

    // Salvar resultado
    const filename = `results/${profileUsername}_${Date.now()}.json`;
    fs.writeFileSync(path.join(process.cwd(), filename), JSON.stringify(result, null, 2));

    // Exibir resultado
    console.log('\n' + '='.repeat(60));
    console.log('✅ RESULTADO');
    console.log('='.repeat(60));
    console.log(`👤 Perfil: @${profileUsername}`);
    console.log(`📊 Total de comentaristas únicos: ${uniqueUsernames.length}`);
    console.log(`💰 Créditos usados: ${totalCreditsUsed}`);
    console.log(`💳 Créditos restantes: ${remainingCredits || 'N/A'}`);
    console.log(`\n📝 Primeiros 20 usernames:`);
    console.log(uniqueUsernames.slice(0, 20));
    if (uniqueUsernames.length > 20) {
      console.log(`   ... e mais ${uniqueUsernames.length - 20} usernames`);
    }
    console.log(`\n💾 Resultado salvo em: ${filename}`);

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    process.exit(1);
  }
}

main();
