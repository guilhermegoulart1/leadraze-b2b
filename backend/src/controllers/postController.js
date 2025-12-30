// backend/src/controllers/postController.js
const db = require('../config/database');
const unipileClient = require('../config/unipile');
const { sendSuccess, sendError, sendPaginated } = require('../utils/responses');
const {
  ValidationError,
  UnipileError,
  ForbiddenError
} = require('../utils/errors');

// ================================
// 1. BUSCAR POSTS
// ================================
const searchPosts = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const {
      linkedin_account_id,
      keywords,
      author,
      date_filter, // past_24h, past_week, past_month
      content_type, // images, videos, articles
      limit = 25,
      cursor
    } = req.body;

    console.log('📝 === BUSCAR POSTS ===');
    console.log('🔍 Keywords:', keywords);
    console.log('👤 Author:', author);
    console.log('📅 Date Filter:', date_filter);

    if (!linkedin_account_id) {
      throw new ValidationError('linkedin_account_id is required');
    }

    if (!keywords && !author) {
      throw new ValidationError('keywords or author is required');
    }

    // Verify LinkedIn account belongs to user
    const accountQuery = await db.query(
      'SELECT * FROM linkedin_accounts WHERE id = $1 AND user_id = $2 AND account_id = $3',
      [linkedin_account_id, userId, accountId]
    );

    if (accountQuery.rows.length === 0) {
      throw new ForbiddenError('LinkedIn account not found or access denied');
    }

    const account = accountQuery.rows[0];

    if (!unipileClient.isInitialized()) {
      throw new UnipileError(`Unipile client error: ${unipileClient.getError()}`);
    }

    console.log('📡 Searching posts on Unipile...');

    // Search posts via Unipile
    const searchParams = {
      account_id: account.unipile_account_id,
      keywords: keywords || '',
      limit: parseInt(limit),
      cursor: cursor || null
    };

    // Add optional filters
    if (author) searchParams.author = author;
    if (date_filter) searchParams.date_filter = date_filter;
    if (content_type) searchParams.content_type = content_type;

    const searchResult = await unipileClient.posts.search(searchParams);

    console.log('✅ Posts received');
    console.log('📊 Total results:', searchResult?.items?.length || 0);

    // Debug: ver estrutura do primeiro post
    if (searchResult?.items?.[0]) {
      console.log('📦 Sample post structure:', JSON.stringify(searchResult.items[0], null, 2));
    }

    const posts = searchResult.items || [];

    // Process and normalize posts
    const processedPosts = posts.map(post => ({
      id: post.id || post.social_id,
      social_id: post.social_id || null, // URN completo para usar em comments/reactions
      content: post.text || post.content || post.body || '',
      created_at: post.parsed_datetime || post.created_at || null,
      date_relative: post.date || null, // "1d", "2h", etc.

      // Author info
      author: {
        id: post.author?.id || post.author?.public_identifier,
        name: post.author?.name || 'Unknown',
        title: post.author?.headline || post.author?.title || null,
        company: post.author?.company || null,
        profile_picture: post.author?.profile_picture || post.author?.avatar || null,
        profile_url: post.author?.public_identifier
          ? `https://www.linkedin.com/in/${post.author.public_identifier}`
          : null,
        is_company: post.author?.is_company || false
      },

      // Engagement
      likes: post.reaction_counter || post.reactions || 0,
      comments: post.comment_counter || post.comments_count || 0,
      shares: post.repost_counter || post.shares || 0,
      impressions: post.impressions_counter || 0,

      // Media
      media: post.attachments || [],
      has_image: post.attachments?.some(a => a.type === 'image' || a.type === 'IMAGE') || false,
      has_video: post.attachments?.some(a => a.type === 'video' || a.type === 'VIDEO') || false,

      // Post URL
      url: post.share_url || post.url || null,

      // Extra
      is_repost: post.is_repost || false,
      provider: post.provider || 'LINKEDIN'
    }));

    sendPaginated(res, processedPosts, {
      cursor: searchResult.cursor || null,
      has_more: !!searchResult.cursor
    }, 'Posts retrieved successfully');

  } catch (error) {
    console.error('❌ Error searching posts:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 2. OBTER POST POR ID
// ================================
const getPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { linkedin_account_id } = req.query;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log('📝 === GET POST BY ID ===');
    console.log('🆔 Post ID:', postId);

    if (!postId || !linkedin_account_id) {
      throw new ValidationError('postId and linkedin_account_id are required');
    }

    // Verify account
    const accountQuery = await db.query(
      'SELECT * FROM linkedin_accounts WHERE id = $1 AND user_id = $2 AND account_id = $3',
      [linkedin_account_id, userId, accountId]
    );

    if (accountQuery.rows.length === 0) {
      throw new ForbiddenError('LinkedIn account not found');
    }

    const account = accountQuery.rows[0];

    // Get post details
    const postDetails = await unipileClient.posts.getOne({
      account_id: account.unipile_account_id,
      post_id: postId
    });

    sendSuccess(res, {
      data: postDetails
    }, 'Post retrieved successfully');

  } catch (error) {
    console.error('❌ Error getting post:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 3. ADICIONAR AUTORES A CAMPANHA
// ================================
const addAuthorsToCampaign = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { campaign_id, authors, linkedin_account_id } = req.body;

    console.log('👥 === ADD AUTHORS TO CAMPAIGN ===');
    console.log('📁 Campaign ID:', campaign_id);
    console.log('👤 Authors count:', authors?.length);

    if (!campaign_id || !authors || !Array.isArray(authors) || authors.length === 0) {
      throw new ValidationError('campaign_id and authors array are required');
    }

    // Verify campaign belongs to user's account
    const campaignQuery = await db.query(
      'SELECT * FROM campaigns WHERE id = $1 AND account_id = $2',
      [campaign_id, accountId]
    );

    if (campaignQuery.rows.length === 0) {
      throw new ForbiddenError('Campaign not found');
    }

    const campaign = campaignQuery.rows[0];

    // Process each author and create leads
    const createdLeads = [];
    const errors = [];

    for (const author of authors) {
      try {
        // Check if lead already exists by provider_id
        const existingLead = await db.query(
          'SELECT id FROM leads WHERE campaign_id = $1 AND provider_id = $2',
          [campaign_id, author.id]
        );

        if (existingLead.rows.length > 0) {
          errors.push({ author_id: author.id, error: 'Lead already exists' });
          continue;
        }

        // Create lead
        const insertResult = await db.query(
          `INSERT INTO leads (
            campaign_id, account_id, user_id, provider_id,
            name, title, company, location, profile_url, profile_picture,
            source, status, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
          RETURNING id`,
          [
            campaign_id,
            accountId,
            userId,
            author.id,
            author.name || 'Unknown',
            author.title || null,
            author.company || null,
            author.location || null,
            author.profile_url || null,
            author.profile_picture || null,
            'linkedin_posts',
            'leads'
          ]
        );

        createdLeads.push({
          lead_id: insertResult.rows[0].id,
          author_id: author.id,
          name: author.name
        });
      } catch (err) {
        console.error('Error creating lead for author:', author.id, err);
        errors.push({ author_id: author.id, error: err.message });
      }
    }

    sendSuccess(res, {
      data: {
        created: createdLeads.length,
        leads: createdLeads,
        errors: errors.length > 0 ? errors : undefined
      }
    }, `${createdLeads.length} leads created successfully`);

  } catch (error) {
    console.error('❌ Error adding authors to campaign:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 4. OBTER POSTS DE UM USUARIO
// ================================
const getUserPosts = async (req, res) => {
  try {
    const { userId: targetUserId } = req.params;
    const { linkedin_account_id, limit = 10, cursor } = req.query;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log('📝 === GET USER POSTS ===');
    console.log('👤 Target User ID:', targetUserId);

    if (!targetUserId || !linkedin_account_id) {
      throw new ValidationError('userId and linkedin_account_id are required');
    }

    // Verify account
    const accountQuery = await db.query(
      'SELECT * FROM linkedin_accounts WHERE id = $1 AND user_id = $2 AND account_id = $3',
      [linkedin_account_id, userId, accountId]
    );

    if (accountQuery.rows.length === 0) {
      throw new ForbiddenError('LinkedIn account not found');
    }

    const account = accountQuery.rows[0];

    // Get user posts
    const postsResult = await unipileClient.posts.getUserPosts({
      account_id: account.unipile_account_id,
      user_id: targetUserId,
      limit: parseInt(limit),
      cursor: cursor || null
    });

    const posts = postsResult.items || [];

    sendSuccess(res, {
      data: posts,
      pagination: {
        cursor: postsResult.cursor || null,
        has_more: !!postsResult.cursor
      }
    }, 'User posts retrieved successfully');

  } catch (error) {
    console.error('❌ Error getting user posts:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 5. LISTAR COMENTÁRIOS DE UM POST
// ================================
const getPostComments = async (req, res) => {
  try {
    const { postId } = req.params;
    const { linkedin_account_id, limit = 50, cursor } = req.query;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log('💬 === BUSCAR COMENTÁRIOS DO POST ===');
    console.log('📝 Post ID:', postId);

    if (!postId || !linkedin_account_id) {
      throw new ValidationError('postId and linkedin_account_id are required');
    }

    // Verificar conta
    const accountQuery = await db.query(
      'SELECT * FROM linkedin_accounts WHERE id = $1 AND user_id = $2 AND account_id = $3',
      [linkedin_account_id, userId, accountId]
    );

    if (accountQuery.rows.length === 0) {
      throw new ForbiddenError('LinkedIn account not found');
    }

    const account = accountQuery.rows[0];

    // Buscar comentários via Unipile
    const commentsResult = await unipileClient.comments.list({
      account_id: account.unipile_account_id,
      post_id: postId,
      limit: parseInt(limit),
      cursor: cursor || null
    });

    // Debug
    if (commentsResult?.items?.[0]) {
      console.log('📦 Sample comment:', JSON.stringify(commentsResult.items[0], null, 2));
    }

    const comments = commentsResult.items || [];

    // Processar comentários e extrair perfis
    // NOTA: Comentários têm estrutura diferente de reações:
    // - author: string (nome)
    // - author_details: object { id, headline, profile_url }
    const processedComments = comments.map(comment => {
      // Suportar ambas estruturas: author como objeto OU author_details separado
      const authorDetails = comment.author_details || {};
      const authorIsObject = typeof comment.author === 'object' && comment.author !== null;

      const authorId = authorDetails.id || (authorIsObject ? comment.author?.id : null);
      const authorName = authorIsObject ? comment.author?.name : (comment.author || 'Unknown');
      const authorHeadline = authorDetails.headline || (authorIsObject ? comment.author?.headline : null);
      const authorProfileUrl = authorDetails.profile_url || (authorIsObject ? comment.author?.profile_url : null);
      const authorProfilePicture = authorDetails.profile_picture || (authorIsObject ? comment.author?.profile_picture : null);
      const authorPublicIdentifier = authorDetails.public_identifier || (authorIsObject ? comment.author?.public_identifier : null);

      return {
        id: comment.id || comment.comment_id,
        text: comment.text || comment.content || '',
        created_at: comment.parsed_datetime || comment.created_at || comment.date,
        date_relative: comment.date || null,

        // Author info
        author: {
          id: authorId,
          name: authorName,
          title: authorHeadline,
          company: authorDetails.company || (authorIsObject ? comment.author?.company : null),
          profile_picture: authorProfilePicture,
          profile_url: authorProfileUrl || (authorPublicIdentifier
            ? `https://www.linkedin.com/in/${authorPublicIdentifier}`
            : null),
          public_identifier: authorPublicIdentifier
        },

        // Engagement do comentário
        likes: comment.reaction_counter || comment.likes || 0,
        replies: comment.reply_count || comment.replies || 0
      };
    });

    sendPaginated(res, processedComments, {
      cursor: commentsResult.cursor || null,
      has_more: !!commentsResult.cursor
    }, 'Comments retrieved successfully');

  } catch (error) {
    console.error('❌ Error getting post comments:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 6. LISTAR REAÇÕES DE UM POST
// ================================
const getPostReactions = async (req, res) => {
  try {
    const { postId } = req.params;
    const { linkedin_account_id, limit = 50, cursor } = req.query;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log('👍 === BUSCAR REAÇÕES DO POST ===');
    console.log('📝 Post ID:', postId);

    if (!postId || !linkedin_account_id) {
      throw new ValidationError('postId and linkedin_account_id are required');
    }

    // Verificar conta
    const accountQuery = await db.query(
      'SELECT * FROM linkedin_accounts WHERE id = $1 AND user_id = $2 AND account_id = $3',
      [linkedin_account_id, userId, accountId]
    );

    if (accountQuery.rows.length === 0) {
      throw new ForbiddenError('LinkedIn account not found');
    }

    const account = accountQuery.rows[0];

    // Buscar reações via Unipile
    const reactionsResult = await unipileClient.reactions.list({
      account_id: account.unipile_account_id,
      post_id: postId,
      limit: parseInt(limit),
      cursor: cursor || null
    });

    // Debug
    if (reactionsResult?.items?.[0]) {
      console.log('📦 Sample reaction:', JSON.stringify(reactionsResult.items[0], null, 2));
    }

    const reactions = reactionsResult.items || [];

    // Processar reações e extrair perfis
    const processedReactions = reactions.map(reaction => ({
      id: reaction.id || reaction.reaction_id,
      type: reaction.reaction_type || reaction.type || 'LIKE',

      // Author info (quem reagiu)
      author: {
        id: reaction.author?.id || reaction.user?.id || reaction.actor?.id,
        name: reaction.author?.name || reaction.user?.name || reaction.actor?.name || 'Unknown',
        title: reaction.author?.headline || reaction.user?.headline || reaction.actor?.headline || null,
        company: reaction.author?.company || reaction.user?.company || null,
        profile_picture: reaction.author?.profile_picture || reaction.user?.profile_picture || null,
        profile_url: (reaction.author?.public_identifier || reaction.user?.public_identifier)
          ? `https://www.linkedin.com/in/${reaction.author?.public_identifier || reaction.user?.public_identifier}`
          : null,
        public_identifier: reaction.author?.public_identifier || reaction.user?.public_identifier || null
      }
    }));

    sendPaginated(res, processedReactions, {
      cursor: reactionsResult.cursor || null,
      has_more: !!reactionsResult.cursor
    }, 'Reactions retrieved successfully');

  } catch (error) {
    console.error('❌ Error getting post reactions:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 7. OBTER TODOS OS PERFIS ENGAJADOS (COMENTÁRIOS + REAÇÕES)
// ================================
const getPostEngagedProfiles = async (req, res) => {
  try {
    const { postId } = req.params;
    const { linkedin_account_id, limit = 100 } = req.query;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log('👥 === BUSCAR PERFIS ENGAJADOS ===');
    console.log('📝 Post ID:', postId);

    if (!postId || !linkedin_account_id) {
      throw new ValidationError('postId and linkedin_account_id are required');
    }

    // Verificar conta
    const accountQuery = await db.query(
      'SELECT * FROM linkedin_accounts WHERE id = $1 AND user_id = $2 AND account_id = $3',
      [linkedin_account_id, userId, accountId]
    );

    if (accountQuery.rows.length === 0) {
      throw new ForbiddenError('LinkedIn account not found');
    }

    const account = accountQuery.rows[0];

    // Buscar comentários e reações em paralelo
    const [commentsResult, reactionsResult] = await Promise.all([
      unipileClient.comments.list({
        account_id: account.unipile_account_id,
        post_id: postId,
        limit: parseInt(limit)
      }).catch(err => {
        console.warn('⚠️ Error fetching comments:', err.message);
        return { items: [] };
      }),
      unipileClient.reactions.list({
        account_id: account.unipile_account_id,
        post_id: postId,
        limit: parseInt(limit)
      }).catch(err => {
        console.warn('⚠️ Error fetching reactions:', err.message);
        return { items: [] };
      })
    ]);

    // Debug: ver estrutura completa das respostas
    console.log('📦 Comments API response keys:', Object.keys(commentsResult || {}));
    console.log('📦 Reactions API response keys:', Object.keys(reactionsResult || {}));

    const comments = commentsResult.items || [];
    const reactions = reactionsResult.items || [];

    console.log('💬 Comments received:', comments.length);
    console.log('👍 Reactions received:', reactions.length);

    // Debug: ver estrutura do primeiro comentário
    if (comments[0]) {
      console.log('📦 Sample comment:', JSON.stringify(comments[0], null, 2));
    }

    // Debug: ver estrutura da primeira reação
    if (reactions[0]) {
      console.log('📦 Sample reaction:', JSON.stringify(reactions[0], null, 2));
    }

    // Extrair perfis únicos
    const profilesMap = new Map();

    // De comentários
    // NOTA: Comentários têm estrutura diferente: author é string, author_details é objeto
    comments.forEach(comment => {
      const authorDetails = comment.author_details || {};
      const authorIsObject = typeof comment.author === 'object' && comment.author !== null;

      const authorId = authorDetails.id || (authorIsObject ? comment.author?.id : null);
      const authorName = authorIsObject ? comment.author?.name : (comment.author || 'Unknown');
      const authorHeadline = authorDetails.headline || (authorIsObject ? comment.author?.headline : null);
      const authorProfileUrl = authorDetails.profile_url || (authorIsObject ? comment.author?.profile_url : null);
      const authorProfilePicture = authorDetails.profile_picture || (authorIsObject ? comment.author?.profile_picture : null);
      const authorPublicIdentifier = authorDetails.public_identifier || (authorIsObject ? comment.author?.public_identifier : null);

      if (authorId && !profilesMap.has(authorId)) {
        profilesMap.set(authorId, {
          id: authorId,
          name: authorName,
          title: authorHeadline,
          company: authorDetails.company || (authorIsObject ? comment.author?.company : null),
          profile_picture: authorProfilePicture,
          profile_url: authorProfileUrl || (authorPublicIdentifier
            ? `https://www.linkedin.com/in/${authorPublicIdentifier}`
            : null),
          public_identifier: authorPublicIdentifier,
          engagement_type: 'comment',
          comment_text: comment.text || null
        });
      }
    });

    // De reações
    reactions.forEach(reaction => {
      const author = reaction.author || reaction.user || reaction.actor || {};
      const authorId = author.id || author.public_identifier;
      if (authorId) {
        if (profilesMap.has(authorId)) {
          // Já existe, adicionar tipo de engajamento
          const existing = profilesMap.get(authorId);
          existing.engagement_type = 'both';
          existing.reaction_type = reaction.value || reaction.reaction_type || reaction.type || 'LIKE';
        } else {
          profilesMap.set(authorId, {
            id: authorId,
            name: author.name || 'Unknown',
            title: author.headline || null,
            company: author.company || null,
            profile_picture: author.profile_picture || author.avatar || null,
            profile_url: author.profile_url || (author.public_identifier
              ? `https://www.linkedin.com/in/${author.public_identifier}`
              : null),
            public_identifier: author.public_identifier || null,
            network_distance: author.network_distance || null,
            engagement_type: 'reaction',
            reaction_type: reaction.value || reaction.reaction_type || reaction.type || 'LIKE'
          });
        }
      }
    });

    const profiles = Array.from(profilesMap.values());

    sendSuccess(res, {
      profiles,
      stats: {
        total_profiles: profiles.length,
        commenters: profiles.filter(p => p.engagement_type === 'comment' || p.engagement_type === 'both').length,
        reactors: profiles.filter(p => p.engagement_type === 'reaction' || p.engagement_type === 'both').length,
        total_comments: comments.length,
        total_reactions: reactions.length
      }
    }, 'Engaged profiles retrieved successfully');

  } catch (error) {
    console.error('❌ Error getting engaged profiles:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

module.exports = {
  searchPosts,
  getPost,
  addAuthorsToCampaign,
  getUserPosts,
  getPostComments,
  getPostReactions,
  getPostEngagedProfiles
};
