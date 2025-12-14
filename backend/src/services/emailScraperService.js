/**
 * Email & Company Intelligence Scraper Service
 * Extrai emails, telefones e informacoes de empresas via web scraping + Gemini AI
 *
 * Custo do scraping: R$ 0,00
 * Custo Gemini: ~$0.0005 por empresa (contexto 1M tokens)
 */
const axios = require('axios');
const cheerio = require('cheerio');
const { geminiService } = require('../config/gemini');

class EmailScraperService {
  constructor() {
    // Paginas comuns de contato para buscar (expandido)
    this.contactPaths = [
      '',                // pagina inicial
      '/contato',
      '/contact',
      '/sobre',
      '/about',
      '/fale-conosco',
      '/contact-us',
      '/quem-somos',
      '/equipe',
      '/team',
      '/nossa-equipe',
      '/about-us',
      '/nossa-historia',
      '/empresa',
      '/company'
    ];

    // Regex para extrair emails validos
    this.emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

    // Regex para extrair CNPJ (com ou sem formatacao)
    this.cnpjRegex = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g;

    // Regex para telefones brasileiros
    this.phoneRegex = /(?:\+55\s?)?(?:\(?\d{2}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}/g;

    // Regex para links de redes sociais
    this.socialRegex = {
      linkedin: /(?:linkedin\.com\/(?:company|in)\/[\w-]+)/gi,
      instagram: /(?:instagram\.com\/[\w.]+)/gi,
      facebook: /(?:facebook\.com\/[\w.]+)/gi,
      youtube: /(?:youtube\.com\/(?:channel|c|user|@)\/[\w-]+)/gi,
      twitter: /(?:twitter\.com\/[\w]+|x\.com\/[\w]+)/gi
    };

    // Emails genericos para classificacao (baixa qualidade)
    this.genericPrefixes = [
      'contato', 'contact', 'info', 'suporte', 'support',
      'vendas', 'sales', 'comercial', 'atendimento',
      'sac', 'faleconosco', 'marketing', 'rh', 'financeiro',
      'administrativo', 'admin', 'noreply', 'no-reply'
    ];

    // Timeout para requisicoes
    this.timeout = 10000;
  }

  /**
   * Extrai email, CNPJ, telefones, equipe e gera descricao da empresa
   * @param {string} websiteUrl - URL do site
   * @param {string} companyName - Nome da empresa (para contexto)
   * @param {string} businessCategory - Categoria do negocio (para contexto)
   * @returns {Promise<Object>} Dados extraidos
   */
  async scrapeAndAnalyze(websiteUrl, companyName = '', businessCategory = '') {
    const emptyResult = {
      email: null,
      source: null,
      cnpj: null,
      emails: [],
      phones: [],
      social_links: {},
      team_members: [],
      companyDescription: null,
      companyServices: null,
      painPoints: null
    };

    if (!websiteUrl) {
      return emptyResult;
    }

    try {
      const baseUrl = this._normalizeUrl(websiteUrl);

      let allEmails = [];
      let allPhones = [];
      let allCnpjs = [];
      let socialLinks = {};
      let allTextContent = '';
      let emailSource = null;

      // Scrape multiplas paginas em paralelo (maximo 5 por vez)
      const pagesToScrape = this.contactPaths.slice(0, 10);
      const scrapePromises = pagesToScrape.map(path =>
        this._scrapePageContent(`${baseUrl}${path}`).catch(() => null)
      );

      const results = await Promise.all(scrapePromises);

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (!result) continue;

        const { emails, phones, cnpjs, social, textContent } = result;
        const url = `${baseUrl}${pagesToScrape[i]}`;

        // Acumula dados
        allEmails.push(...emails);
        allPhones.push(...phones);
        allCnpjs.push(...cnpjs);

        // Merge social links
        Object.keys(social).forEach(key => {
          if (social[key] && !socialLinks[key]) {
            socialLinks[key] = social[key];
          }
        });

        if (textContent) {
          allTextContent += '\n\n' + textContent;
        }

        // Pega source do primeiro email
        if (emails.length > 0 && !emailSource) {
          emailSource = url;
        }
      }

      // Remove duplicados e valida
      const uniqueEmails = this._processEmails(allEmails);
      const uniquePhones = this._processPhones(allPhones);
      const validCnpj = this._findValidCnpj(allCnpjs);

      // Log resultados do scraping
      console.log(`📧 ${companyName}: ${uniqueEmails.length} emails, ${uniquePhones.length} phones, CNPJ: ${validCnpj || 'N/A'}`);

      // Analise com Gemini se tiver conteudo suficiente
      let analysis = null;
      if (allTextContent.length > 200 && geminiService.isConfigured()) {
        analysis = await this._analyzeWithGemini(allTextContent, companyName, businessCategory);
      }

      // Merge team_members do Gemini com o que ja temos
      const teamMembers = analysis?.team_members || [];

      return {
        email: uniqueEmails[0]?.email || null,
        source: emailSource,
        cnpj: validCnpj,
        emails: uniqueEmails,
        phones: uniquePhones,
        social_links: this._formatSocialLinks(socialLinks),
        team_members: teamMembers,
        companyDescription: analysis?.company?.description || null,
        companyServices: analysis?.company?.services || null,
        painPoints: analysis?.sales_opportunities?.pain_points || null
      };

    } catch (error) {
      console.log(`⚠️ Erro ao scrape ${websiteUrl}: ${error.message}`);
      return emptyResult;
    }
  }

  /**
   * Metodo legado - apenas extrai email (mantido para compatibilidade)
   */
  async scrapeEmailFromWebsite(websiteUrl) {
    const result = await this.scrapeAndAnalyze(websiteUrl);
    return { email: result.email, source: result.source };
  }

  /**
   * Scrape uma pagina e extrai dados
   */
  async _scrapePageContent(url) {
    const response = await axios.get(url, {
      timeout: this.timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      maxRedirects: 3,
      validateStatus: (status) => status < 400
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Remove scripts, styles, e elementos nao relevantes
    $('script, style, noscript, iframe').remove();

    // Extrai texto limpo da pagina
    const textContent = $('body').text()
      .replace(/\s+/g, ' ')
      .trim();

    // Extrai dados do HTML completo (inclui atributos href)
    const fullHtml = $.html();

    // Emails
    const rawEmails = fullHtml.match(this.emailRegex) || [];

    // Telefones
    const rawPhones = fullHtml.match(this.phoneRegex) || [];

    // CNPJs
    const rawCnpjs = fullHtml.match(this.cnpjRegex) || [];

    // Redes sociais
    const social = {};
    Object.keys(this.socialRegex).forEach(network => {
      const matches = fullHtml.match(this.socialRegex[network]);
      if (matches && matches.length > 0) {
        social[network] = 'https://' + matches[0];
      }
    });

    return {
      emails: rawEmails,
      phones: rawPhones,
      cnpjs: rawCnpjs,
      social,
      textContent: textContent.substring(0, 15000) // Limite maior para Gemini
    };
  }

  /**
   * Analisa o conteudo do site com Gemini para prospeccao B2B
   */
  async _analyzeWithGemini(websiteText, companyName, businessCategory) {
    try {
      const systemPrompt = `Voce e um especialista em inteligencia comercial B2B. Analise conteudo de sites de empresas e extraia informacoes uteis para prospeccao. Sempre responda em JSON valido.`;

      const userPrompt = `Analise o conteudo deste site e extraia TODAS as informacoes uteis para prospeccao B2B.

EMPRESA: ${companyName || 'Nao informado'}
CATEGORIA: ${businessCategory || 'Nao informada'}

EXTRAIA COM MUITO CUIDADO:

1. EQUIPE/SOCIOS (team_members):
   - Nomes de fundadores, socios, diretores, gerentes
   - Seus cargos/funcoes
   - LinkedIn pessoal (se mencionado)
   - Email pessoal (se mencionado)

2. SOBRE A EMPRESA (company):
   - Descricao objetiva em 2-3 frases
   - Lista de principais servicos/produtos (maximo 5)
   - Diferenciais competitivos
   - Anos de mercado (se mencionado)
   - Numero de funcionarios (se mencionado)

3. OPORTUNIDADES DE VENDA (sales_opportunities):
   - Possiveis dores/problemas da empresa
   - Gaps tecnologicos identificados
   - Necessidades nao atendidas

Responda APENAS com JSON valido neste formato:
{
  "team_members": [{"name": "", "role": "", "email": "", "linkedin": ""}],
  "company": {
    "description": "",
    "services": [],
    "differentials": [],
    "years_in_market": null,
    "employee_count": null
  },
  "sales_opportunities": {
    "pain_points": [],
    "tech_gaps": [],
    "needs": []
  }
}

Se nao encontrar alguma informacao, use null ou array vazio.

CONTEUDO DO SITE:
${websiteText}`;

      const response = await geminiService.generateText(systemPrompt, userPrompt, {
        temperature: 0.3,
        maxTokens: 2000
      });

      // Extrai JSON da resposta
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log(`🧠 Gemini analysis completed for ${companyName || 'company'}`);
        return parsed;
      }

      return null;
    } catch (error) {
      console.log(`⚠️ Gemini analysis failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Processa e classifica emails encontrados
   */
  _processEmails(rawEmails) {
    // Remove duplicados
    const unique = [...new Set(rawEmails.map(e => e.toLowerCase()))];

    // Filtra emails invalidos
    const filtered = unique.filter(email => {
      // Remove emails com extensoes de imagem/arquivo
      if (/\.(png|jpg|jpeg|gif|svg|webp|css|js|woff|woff2|ttf|eot)$/i.test(email)) return false;
      // Remove emails muito curtos ou longos
      if (email.length < 6 || email.length > 100) return false;
      // Remove emails com caracteres estranhos
      if (/[<>(){}[\]\\|;:'"`,]/.test(email)) return false;
      return true;
    });

    // Classifica cada email
    const classified = filtered.map(email => {
      const prefix = email.split('@')[0].toLowerCase();
      let type = 'personal';

      for (const genericPrefix of this.genericPrefixes) {
        if (prefix.includes(genericPrefix)) {
          if (['vendas', 'sales', 'comercial'].some(s => prefix.includes(s))) {
            type = 'commercial';
          } else if (['suporte', 'support', 'sac', 'atendimento'].some(s => prefix.includes(s))) {
            type = 'support';
          } else {
            type = 'generic';
          }
          break;
        }
      }

      // Detecta departamento pelo prefixo
      let department = null;
      if (prefix.includes('rh') || prefix.includes('hr')) department = 'RH';
      else if (prefix.includes('financeiro') || prefix.includes('finance')) department = 'Financeiro';
      else if (prefix.includes('marketing')) department = 'Marketing';
      else if (prefix.includes('comercial') || prefix.includes('vendas') || prefix.includes('sales')) department = 'Comercial';
      else if (prefix.includes('suporte') || prefix.includes('support')) department = 'Suporte';

      return { email, type, department };
    });

    // Ordena: personal > commercial > support > generic
    const priority = { personal: 0, commercial: 1, support: 2, generic: 3 };
    classified.sort((a, b) => priority[a.type] - priority[b.type]);

    return classified.slice(0, 10); // Maximo 10 emails
  }

  /**
   * Processa e formata telefones encontrados
   */
  _processPhones(rawPhones) {
    const unique = [...new Set(rawPhones)];

    const processed = unique
      .map(phone => {
        // Limpa o telefone
        const cleaned = phone.replace(/\D/g, '');

        // Valida tamanho (8 a 13 digitos)
        if (cleaned.length < 8 || cleaned.length > 13) return null;

        // Formata
        let formatted = phone.trim();
        let type = 'landline';

        // Detecta tipo
        if (cleaned.length >= 11) {
          const ddd = cleaned.slice(-11, -9);
          const firstDigit = cleaned.slice(-9, -8);
          if (firstDigit === '9') {
            type = 'mobile';
          }
        }

        // Detecta WhatsApp (heuristica: celulares geralmente sao WhatsApp)
        if (type === 'mobile') {
          type = 'whatsapp';
        }

        return { phone: formatted, type };
      })
      .filter(Boolean);

    return processed.slice(0, 5); // Maximo 5 telefones
  }

  /**
   * Encontra e valida o primeiro CNPJ valido da lista
   */
  _findValidCnpj(cnpjs) {
    for (const cnpj of cnpjs) {
      const cleaned = cnpj.replace(/[^\d]/g, '');
      if (cleaned.length !== 14) continue;
      if (/^(\d)\1+$/.test(cleaned)) continue;

      if (this._validateCnpjDigits(cleaned)) {
        return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
      }
    }
    return null;
  }

  /**
   * Valida os digitos verificadores do CNPJ
   */
  _validateCnpjDigits(cnpj) {
    let sum = 0;
    let weight = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    for (let i = 0; i < 12; i++) {
      sum += parseInt(cnpj[i]) * weight[i];
    }
    let remainder = sum % 11;
    let digit1 = remainder < 2 ? 0 : 11 - remainder;

    if (parseInt(cnpj[12]) !== digit1) return false;

    sum = 0;
    weight = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    for (let i = 0; i < 13; i++) {
      sum += parseInt(cnpj[i]) * weight[i];
    }
    remainder = sum % 11;
    let digit2 = remainder < 2 ? 0 : 11 - remainder;

    return parseInt(cnpj[13]) === digit2;
  }

  /**
   * Formata links de redes sociais
   */
  _formatSocialLinks(social) {
    const formatted = {};
    Object.keys(social).forEach(key => {
      if (social[key]) {
        formatted[key] = social[key];
      }
    });
    return Object.keys(formatted).length > 0 ? formatted : {};
  }

  /**
   * Normaliza URL base
   */
  _normalizeUrl(url) {
    let normalized = url.trim();

    if (!normalized.startsWith('http')) {
      normalized = 'https://' + normalized;
    }

    normalized = normalized.replace(/\/+$/, '');

    try {
      const urlObj = new URL(normalized);
      return `${urlObj.protocol}//${urlObj.host}`;
    } catch {
      return normalized;
    }
  }
}

module.exports = new EmailScraperService();
