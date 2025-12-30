// backend/src/config/unipile.js
// Refatorado para usar @relay/core
const { UnipileProvider } = require('@guilhermegoulart1/relay-core');

// Configuração do Unipile
const dsn = process.env.UNIPILE_DSN;
const accessToken = (process.env.UNIPILE_ACCESS_TOKEN || process.env.UNIPILE_API_KEY || '').trim();

// Inicializar provider do Relay
const provider = new UnipileProvider({ dsn, accessToken });

// Log de erro se não inicializado
if (!provider.isInitialized()) {
  console.error('❌ Unipile Init Error:', provider.getError());
}

// Wrapper para manter compatibilidade retroativa com a API existente do LeadRaze
const unipileClient = {
  // Verificar se está inicializado
  isInitialized: () => provider.isInitialized(),
  getError: () => provider.getError(),

  // ================================
  // 🔗 ACCOUNT
  // ================================
  account: {
    getHostedAuthLink: async (options = {}) => {
      // Adicionar URLs padrão do LeadRaze se não fornecidas
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return provider.account.getHostedAuthLink({
        ...options,
        successRedirectUrl: options.successRedirectUrl || `${frontendUrl}/channels?connected=true`,
        failureRedirectUrl: options.failureRedirectUrl || `${frontendUrl}/channels?error=true`
      });
    },
    connectLinkedin: (credentials) => provider.account.connectLinkedin(credentials),
    // Manter nomes antigos para compatibilidade
    getAccountById: (accountId) => provider.account.getById(accountId),
    disconnectAccount: (accountId) => provider.account.disconnect(accountId)
  },

  // ================================
  // 👤 USERS
  // ================================
  users: {
    getOwnProfile: (accountId) => provider.users.getOwnProfile(accountId),
    getOne: (accountId, userId) => provider.users.getOne(accountId, userId),
    search: (params) => provider.users.search(params),
    sendConnectionRequest: (params) => provider.users.sendConnectionRequest(params),
    getFullProfile: (accountId, userId) => provider.users.getFullProfile(accountId, userId)
  },

  // ================================
  // 🔗 CONNECTIONS (1º GRAU)
  // ================================
  connections: {
    search: (params) => provider.connections.search(params)
  },

  // ================================
  // 🔍 LINKEDIN
  // ================================
  linkedin: {
    search: (params) => provider.linkedin.search(params),
    searchByUrl: (params) => provider.linkedin.searchByUrl(params)
  },

  // ================================
  // 💬 MESSAGING
  // ================================
  messaging: {
    send: (params) => provider.messaging.send(params),
    getMessages: (params) => provider.messaging.getMessages(params),
    sendMessage: (params) => provider.messaging.sendMessage(params),
    sendMessageWithAttachment: (params) => provider.messaging.sendMessageWithAttachment(params),
    getAttachment: (params) => provider.messaging.getAttachment(params),
    getChats: (params) => provider.messaging.getChats(params),
    getChat: (params) => provider.messaging.getChat(params),
    getAttendeeById: (attendeeId) => provider.messaging.getAttendeeById(attendeeId),
    getAttendeePicture: (attendeeId) => provider.messaging.getAttendeePicture(attendeeId),
    getOwnProfileFromChats: (accountId) => provider.messaging.getOwnProfileFromChats(accountId)
  },

  // ================================
  // 🔔 WEBHOOKS
  // ================================
  webhooks: {
    list: () => provider.webhooks.list(),
    create: (options) => provider.webhooks.create(options),
    delete: (webhookId) => provider.webhooks.delete(webhookId),
    findByUrl: (requestUrl) => provider.webhooks.findByUrl(requestUrl),
    ensureWebhook: (options) => provider.webhooks.ensureWebhook(options),
    addAccountToWebhook: (requestUrl, accountId, source) => provider.webhooks.addAccountToWebhook(requestUrl, accountId, source),
    removeAccountFromWebhook: (requestUrl, accountId, source) => provider.webhooks.removeAccountFromWebhook(requestUrl, accountId, source),
    getAccountIds: (requestUrl, source) => provider.webhooks.getAccountIds(requestUrl, source)
  },

  // ================================
  // 🔍 SEARCH PARAMETERS (Autocomplete)
  // ================================
  searchParams: {
    locations: (params) => provider.searchParams.locations(params),
    industries: (params) => provider.searchParams.industries(params),
    jobTitles: (params) => provider.searchParams.jobTitles(params),
    companies: (params) => provider.searchParams.companies(params),
    skills: (params) => provider.searchParams.skills(params),
    schools: (params) => provider.searchParams.schools(params)
  },

  // ================================
  // 📝 POSTS (v1.3.0+)
  // ================================
  posts: {
    create: (params) => provider.posts.create(params),
    getOne: (params) => provider.posts.getOne(params),
    getUserPosts: (params) => provider.posts.getUserPosts(params),
    getCompanyPosts: (params) => provider.posts.getCompanyPosts(params),
    search: (params) => provider.posts.search(params),
    delete: (params) => provider.posts.delete(params)
  },

  // ================================
  // 👍 REACTIONS (v1.3.0+)
  // ================================
  reactions: {
    add: (params) => provider.reactions.add(params),
    remove: (params) => provider.reactions.remove(params),
    list: (params) => provider.reactions.list(params)
  },

  // ================================
  // 💬 COMMENTS (v1.3.0+)
  // ================================
  comments: {
    create: (params) => provider.comments.create(params),
    reply: (params) => provider.comments.reply(params),
    list: (params) => provider.comments.list(params),
    delete: (params) => provider.comments.delete(params)
  },

  // ================================
  // 🏢 COMPANY (v1.3.0+)
  // ================================
  company: {
    getOne: (params) => provider.company.getOne(params),
    search: (params) => provider.company.search(params),
    getPosts: (params) => provider.company.getPosts(params),
    getEmployees: (params) => provider.company.getEmployees(params)
  },

  // ================================
  // 💼 JOBS (v1.3.0+)
  // ================================
  jobs: {
    search: (params) => provider.jobs.search(params),
    getOne: (params) => provider.jobs.getOne(params)
  }
};

module.exports = unipileClient;
