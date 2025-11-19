# Unipile API - Resposta Completa de Perfil LinkedIn

## Resumo Executivo

Teste realizado com sucesso usando o endpoint `/api/v1/users/{provider_id}` da Unipile API com o parametro `linkedin_sections=*` para obter dados completos do perfil.

## Configuracao do Request

```javascript
const dsn = 'api3.unipile.com:13332';
const token = 't3OuwvKV.vX8ejIpZxp5LAeYDDH2FmxYer5ind7/h8Tqev/Xwl9E=';
const accountId = 'seiTJuv3TqK5_GhjJgVZlw';
const providerId = 'ACoAABlSwsQBSS9qx1bxMMujZNrgfE7dCmZLGMo';

// URL CORRETA (com linkedin_sections=*)
const url = `https://${dsn}/api/v1/users/${providerId}?account_id=${accountId}&linkedin_sections=*`;

fetch(url, {
  headers: { 'X-API-KEY': token }
})
```

## Campos Disponiveis na Resposta

### 1. Campos de Identificacao Basicos
```json
{
  "object": "UserProfile",
  "provider": "LINKEDIN",
  "provider_id": "ACoAABlSwsQBSS9qx1bxMMujZNrgfE7dCmZLGMo",
  "public_identifier": "felipelafalce",
  "member_urn": "424854212",
  "first_name": "Felipe",
  "last_name": "La Falce"
}
```

### 2. Informacoes Profissionais
```json
{
  "headline": "Marketing Digital | Automação | Growth Marketing | Web Analytics | Gestão de Tráfego",
  "summary": "- Sólida experiência em implementação e otimização...",
  "location": "Porto Alegre, Rio Grande do Sul, Brazil"
}
```

### 3. Configuracoes de Idioma/Locale
```json
{
  "primary_locale": {
    "country": "BR",
    "language": "pt"
  }
}
```

### 4. Flags de Tipo de Conta
```json
{
  "is_open_profile": false,
  "is_premium": false,
  "is_influencer": false,
  "is_creator": false,
  "is_relationship": false,
  "network_distance": "SECOND_DEGREE",
  "is_self": false
}
```

### 5. Estatisticas do Perfil
```json
{
  "follower_count": 797,
  "connections_count": 788,
  "shared_connections_count": 14
}
```

### 6. URLs de Fotos
```json
{
  "profile_picture_url": "https://media.licdn.com/dms/image/v2/D4E03AQGTmHOp5C4a-w/profile-displayphoto-shrink_100_100/...",
  "profile_picture_url_large": "https://media.licdn.com/dms/image/v2/D4E03AQGTmHOp5C4a-w/profile-displayphoto-shrink_800_800/..."
}
```

### 7. Websites
```json
{
  "websites": []  // Array de URLs do perfil
}
```

## Dados Detalhados com linkedin_sections=*

### 8. Experiencia Profissional (work_experience)
```json
{
  "work_experience_total_count": 2,
  "work_experience": [
    {
      "company_id": "2898773",
      "company": "CFL Incorporadora",
      "position": "Marketing Digital e Performance",
      "location": "Porto Alegre, Rio Grande do Sul, Brasil",
      "description": "- Faço o planejamento estratégico...",
      "company_picture_url": "https://media.licdn.com/dms/image/...",
      "skills": [],
      "start": "11/1/2021",
      "end": null  // null = cargo atual
    },
    {
      "company_id": "1331898",
      "company": "Melnick Even Incorporações e Construções",
      "position": "Analista de marketing digital",
      "company_picture_url": "https://media.licdn.com/dms/image/...",
      "skills": [],
      "start": "2/1/2020",
      "end": "11/1/2021"
    }
  ]
}
```

**Campos Disponiveis em work_experience:**
- `company_id` - ID da empresa no LinkedIn
- `company` - Nome da empresa
- `position` - Cargo/Titulo
- `location` - Localizacao do trabalho
- `description` - Descricao detalhada das responsabilidades
- `company_picture_url` - Logo da empresa
- `skills` - Array de skills relacionadas
- `start` - Data de inicio (formato: "MM/D/YYYY")
- `end` - Data de fim (null = atual)

### 9. Educacao (education)
```json
{
  "education_total_count": 1,
  "education": [
    {
      "school_id": "15093247",
      "school": "ULBRA",
      "start": null,
      "end": null
    }
  ]
}
```

**Campos Disponiveis em education:**
- `school_id` - ID da instituicao no LinkedIn
- `school` - Nome da instituicao
- `start` - Data de inicio
- `end` - Data de fim
- (Pode ter outros campos como `degree`, `field_of_study`, `description` dependendo do perfil)

### 10. Skills/Competencias (skills)
```json
{
  "skills_total_count": 57,
  "skills": [
    {
      "name": "Pesquisa do Google",
      "endorsement_count": 1,
      "insights": [
        "Cerficação em Rede de Pesquisa do Google Ads"
      ],
      "endorsement_id": null,
      "endorsed": false
    },
    {
      "name": "Google display",
      "endorsement_count": 1,
      "insights": [
        "Certificação em Display do Google Ads"
      ],
      "endorsement_id": null,
      "endorsed": false
    }
    // ... 55 skills a mais
  ]
}
```

**Campos Disponiveis em skills:**
- `name` - Nome da skill
- `endorsement_count` - Numero de endorsements
- `insights` - Array de insights (certificacoes, experiencias relacionadas)
- `endorsement_id` - ID do endorsement (se existir)
- `endorsed` - Boolean indicando se voce endossou

### 11. Idiomas (languages)
```json
{
  "languages_total_count": 2,
  "languages": [
    {
      "name": "Inglês",
      "proficiency": "Limited working proficiency"
    },
    {
      "name": "Português"
    }
  ]
}
```

**Campos Disponiveis em languages:**
- `name` - Nome do idioma
- `proficiency` - Nivel de proficiencia (opcional)

### 12. Certificacoes (certifications)
```json
{
  "certifications_total_count": 5,
  "certifications": [
    {
      "name": "Google Analytics 4: eventos e parametrizações",
      "organization": "Alura",
      "url": "https://cursos.alura.com.br/certificate/..."
    },
    {
      "name": "Programa de Nivelamento em Análise de Dados",
      "organization": "Ânima Empreenda Digital",
      "url": "http://smartshare.animaeducacao.com.br/..."
    }
    // ... 3 certificacoes a mais
  ]
}
```

**Campos Disponiveis em certifications:**
- `name` - Nome da certificacao
- `organization` - Organizacao emissora
- `url` - URL da certificacao/verificacao

### 13. Experiencia Voluntaria (volunteering_experience)
```json
{
  "volunteering_experience_total_count": 0,
  "volunteering_experience": []
}
```

**Campos esperados (quando existem):**
- `organization` - Nome da organizacao
- `role` - Funcao/cargo
- `cause` - Causa
- `description` - Descricao
- `start` - Data de inicio
- `end` - Data de fim

### 14. Projetos (projects)
```json
{
  "projects_total_count": 0,
  "projects": []
}
```

**Campos esperados (quando existem):**
- `title` - Titulo do projeto
- `description` - Descricao
- `url` - URL do projeto
- `start` - Data de inicio
- `end` - Data de fim

## Campos de Contato

**IMPORTANTE:** No teste realizado, nenhum campo de contato foi retornado:
- `email` - NAO disponivel
- `emails` - NAO disponivel
- `phone` - NAO disponivel
- `phone_numbers` - NAO disponivel
- `contact_info` - NAO disponivel

**Motivos possiveis:**
1. O perfil testado e de 2º grau (`network_distance: "SECOND_DEGREE"`)
2. LinkedIn restringe acesso a emails/telefones para perfis que nao sao conexoes diretas
3. O usuario pode nao ter tornado essas informacoes publicas
4. Pode ser necessario um perfil de 1º grau (conexao direta) para acessar

## Estrutura Completa de Campos

```typescript
interface UnipileUserProfile {
  // Identificacao
  object: "UserProfile";
  provider: "LINKEDIN";
  provider_id: string;
  public_identifier: string;
  member_urn: string;
  first_name: string;
  last_name: string;

  // Profissional
  headline: string;
  summary?: string;
  location: string;

  // Locale
  primary_locale: {
    country: string;
    language: string;
  };

  // Flags
  is_open_profile: boolean;
  is_premium: boolean;
  is_influencer: boolean;
  is_creator: boolean;
  is_relationship: boolean;
  network_distance: "FIRST_DEGREE" | "SECOND_DEGREE" | "THIRD_DEGREE";
  is_self: boolean;

  // Estatisticas
  follower_count: number;
  connections_count: number;
  shared_connections_count: number;

  // URLs
  websites: string[];
  profile_picture_url: string;
  profile_picture_url_large: string;

  // Experiencia (com linkedin_sections=*)
  work_experience_total_count: number;
  work_experience: Array<{
    company_id: string;
    company: string;
    position: string;
    location?: string;
    description?: string;
    company_picture_url?: string;
    skills: string[];
    start: string | null;
    end: string | null;
  }>;

  // Educacao (com linkedin_sections=*)
  education_total_count: number;
  education: Array<{
    school_id: string;
    school: string;
    start: string | null;
    end: string | null;
    degree?: string;
    field_of_study?: string;
  }>;

  // Skills (com linkedin_sections=*)
  skills_total_count: number;
  skills: Array<{
    name: string;
    endorsement_count: number;
    insights: string[];
    endorsement_id: string | null;
    endorsed: boolean;
  }>;

  // Idiomas (com linkedin_sections=*)
  languages_total_count: number;
  languages: Array<{
    name: string;
    proficiency?: string;
  }>;

  // Certificacoes (com linkedin_sections=*)
  certifications_total_count: number;
  certifications: Array<{
    name: string;
    organization: string;
    url?: string;
  }>;

  // Experiencia Voluntaria (com linkedin_sections=*)
  volunteering_experience_total_count: number;
  volunteering_experience: Array<{
    organization: string;
    role: string;
    cause?: string;
    description?: string;
    start?: string;
    end?: string;
  }>;

  // Projetos (com linkedin_sections=*)
  projects_total_count: number;
  projects: Array<{
    title: string;
    description?: string;
    url?: string;
    start?: string;
    end?: string;
  }>;

  // Contato (raramente disponivel)
  email?: string;
  emails?: string[];
  phone?: string;
  phone_numbers?: string[];
  contact_info?: {
    email?: string;
    phone?: string;
    websites?: string[];
  };
}
```

## Comparacao: Com vs Sem linkedin_sections=*

### Sem linkedin_sections (endpoint basico)
```
Campos retornados: 23 campos
- Dados basicos de perfil
- Flags e estatisticas
- SEM experience, education, skills, certifications, languages
```

### Com linkedin_sections=* (endpoint completo)
```
Campos retornados: 35+ campos
- Todos os dados basicos
- work_experience (com detalhes completos)
- education
- skills (com endorsements e insights)
- languages
- certifications (com URLs)
- volunteering_experience
- projects
```

## Exemplo de Uso em Codigo

```javascript
// Funcao para buscar perfil completo
async function getLinkedInProfile(providerId) {
  const dsn = 'api3.unipile.com:13332';
  const token = process.env.UNIPILE_ACCESS_TOKEN;
  const accountId = 'seiTJuv3TqK5_GhjJgVZlw';

  const url = `https://${dsn}/api/v1/users/${providerId}?account_id=${accountId}&linkedin_sections=*`;

  const response = await fetch(url, {
    headers: { 'X-API-KEY': token }
  });

  if (!response.ok) {
    throw new Error(`Erro: ${response.status}`);
  }

  return await response.json();
}

// Extrair dados especificos
const profile = await getLinkedInProfile('ACoAABlSwsQBSS9qx1bxMMujZNrgfE7dCmZLGMo');

console.log('Nome:', `${profile.first_name} ${profile.last_name}`);
console.log('Cargo atual:', profile.work_experience[0]?.position);
console.log('Empresa atual:', profile.work_experience[0]?.company);
console.log('Total de skills:', profile.skills_total_count);
console.log('Skills principais:', profile.skills.slice(0, 5).map(s => s.name));
```

## Limitacoes Identificadas

1. **Sem dados de contato**: Email e telefone nao estao disponiveis para perfis de 2º grau
2. **Dependencia do grau de conexao**: Dados completos podem estar limitados pelo `network_distance`
3. **Dados opcionais**: Muitos campos podem ser null ou vazios dependendo do que o usuario preencheu
4. **Datas variaveis**: Formato de datas pode variar ("MM/D/YYYY" ou null)

## Conclusao

O endpoint `/api/v1/users/{provider_id}?account_id={account_id}&linkedin_sections=*` retorna:

- 35+ campos de dados estruturados
- Experiencia profissional completa com descricoes
- Educacao
- 57 skills com endorsements e insights
- Certificacoes com URLs
- Idiomas
- Estatisticas do perfil
- Flags de tipo de conta

**Para obter dados completos, e ESSENCIAL usar o parametro `linkedin_sections=*`**
