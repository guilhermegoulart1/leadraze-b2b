// backend/src/controllers/analyticsController.js
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const { NotFoundError } = require('../utils/errors');

// ================================
// 1. DASHBOARD GERAL
// ================================

// backend/src/controllers/analyticsController.js

const getDashboard = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = '30' } = req.query; // dias

    console.log(`📊 Buscando dashboard para usuário ${userId} (${period} dias)`);

    const periodDays = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    // 1. Totais gerais
    const totalsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM campaigns WHERE user_id = $1) as total_campaigns,
        (SELECT COUNT(*) FROM campaigns WHERE user_id = $1 AND status = 'active') as active_campaigns,
        (SELECT COUNT(*) FROM leads l JOIN campaigns c ON l.campaign_id = c.id WHERE c.user_id = $1) as total_leads,
        (SELECT COUNT(*) FROM leads l JOIN campaigns c ON l.campaign_id = c.id WHERE c.user_id = $1 AND l.status = 'qualified') as qualified_leads,
        (SELECT COUNT(*) FROM conversations WHERE user_id = $1) as total_conversations,
        (SELECT COUNT(*) FROM conversations WHERE user_id = $1 AND ai_active = true) as ai_conversations,
        (SELECT COUNT(*) FROM linkedin_accounts WHERE user_id = $1) as linkedin_accounts
    `;

    const totalsResult = await db.query(totalsQuery, [userId]);
    const totals = totalsResult.rows[0];

    // 2. Pipeline de Leads
    const pipelineQuery = `
      SELECT 
        l.status,
        COUNT(*) as count
      FROM leads l
      JOIN campaigns c ON l.campaign_id = c.id
      WHERE c.user_id = $1
      GROUP BY l.status
    `;

    const pipelineResult = await db.query(pipelineQuery, [userId]);
    
    const pipeline = {
      leads: 0,
      invite_sent: 0,
      accepted: 0,
      qualifying: 0,
      qualified: 0,
      discarded: 0
    };

    pipelineResult.rows.forEach(row => {
      pipeline[row.status] = parseInt(row.count);
    });

    // 3. Taxa de conversão
    const conversionRate = pipeline.invite_sent > 0 
      ? ((pipeline.accepted / pipeline.invite_sent) * 100).toFixed(2)
      : 0;

    const qualificationRate = pipeline.accepted > 0
      ? ((pipeline.qualified / pipeline.accepted) * 100).toFixed(2)
      : 0;

    // 4. Conversas por status
    const conversationsQuery = `
      SELECT 
        status,
        COUNT(*) as count
      FROM conversations
      WHERE user_id = $1
      GROUP BY status
    `;

    const conversationsResult = await db.query(conversationsQuery, [userId]);
    
    const conversations = {
      hot: 0,
      warm: 0,
      cold: 0
    };

    conversationsResult.rows.forEach(row => {
      conversations[row.status] = parseInt(row.count);
    });

    // 5. Atividade recente (último período) - CORRIGIDO
    const activityQuery = `
      SELECT 
        DATE(l.created_at) as date,
        COUNT(*) as count
      FROM leads l
      JOIN campaigns c ON l.campaign_id = c.id
      WHERE c.user_id = $1 AND l.created_at >= $2
      GROUP BY DATE(l.created_at)
      ORDER BY date ASC
    `;

    const activityResult = await db.query(activityQuery, [userId, startDate]);

    // 6. Top Campanhas
    const topCampaignsQuery = `
      SELECT 
        c.id,
        c.name,
        c.status,
        COUNT(l.id) as total_leads,
        COUNT(l.id) FILTER (WHERE l.status = 'qualified') as qualified_leads,
        COUNT(l.id) FILTER (WHERE l.status = 'invite_sent') as sent,
        COUNT(l.id) FILTER (WHERE l.status = 'accepted') as accepted
      FROM campaigns c
      LEFT JOIN leads l ON c.id = l.campaign_id
      WHERE c.user_id = $1
      GROUP BY c.id, c.name, c.status
      ORDER BY qualified_leads DESC, total_leads DESC
      LIMIT 5
    `;

    const topCampaigns = await db.query(topCampaignsQuery, [userId]);

    // 7. Métricas de IA
    const aiMetricsQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE ai_active = true) as ai_active,
        COUNT(*) FILTER (WHERE manual_control_taken = true) as manual_control,
        COUNT(DISTINCT ai_agent_id) as agents_in_use
      FROM conversations
      WHERE user_id = $1
    `;

    const aiMetrics = await db.query(aiMetricsQuery, [userId]);

    const dashboard = {
      period_days: periodDays,
      totals: {
        campaigns: parseInt(totals.total_campaigns),
        active_campaigns: parseInt(totals.active_campaigns),
        leads: parseInt(totals.total_leads),
        qualified_leads: parseInt(totals.qualified_leads),
        conversations: parseInt(totals.total_conversations),
        ai_conversations: parseInt(totals.ai_conversations),
        linkedin_accounts: parseInt(totals.linkedin_accounts)
      },
      pipeline,
      conversion_rates: {
        invitation_to_acceptance: parseFloat(conversionRate),
        acceptance_to_qualified: parseFloat(qualificationRate)
      },
      conversations_by_status: conversations,
      activity_chart: activityResult.rows,
      top_campaigns: topCampaigns.rows,
      ai_metrics: aiMetrics.rows[0]
    };

    console.log('✅ Dashboard compilado');

    sendSuccess(res, dashboard);

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};


// ================================
// 2. MÉTRICAS DE CAMPANHA
// ================================
const getCampaignAnalytics = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const userId = req.user.id;

    console.log(`📊 Buscando analytics da campanha ${campaignId}`);

    // Verificar se campanha pertence ao usuário
    const campaign = await db.findOne('campaigns', { 
      id: campaignId, 
      user_id: userId 
    });

    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

    // 1. Métricas gerais
    const metricsQuery = `
      SELECT 
        COUNT(*) as total_leads,
        COUNT(*) FILTER (WHERE status = 'leads') as pending,
        COUNT(*) FILTER (WHERE status = 'invite_sent') as sent,
        COUNT(*) FILTER (WHERE status = 'accepted') as accepted,
        COUNT(*) FILTER (WHERE status = 'qualifying') as qualifying,
        COUNT(*) FILTER (WHERE status = 'qualified') as qualified,
        COUNT(*) FILTER (WHERE status = 'discarded') as discarded,
        AVG(score) FILTER (WHERE status = 'qualified') as avg_qualified_score,
        COUNT(*) FILTER (WHERE sent_at >= NOW() - INTERVAL '7 days') as sent_last_7_days,
        COUNT(*) FILTER (WHERE accepted_at >= NOW() - INTERVAL '7 days') as accepted_last_7_days
      FROM leads
      WHERE campaign_id = $1
    `;

    const metricsResult = await db.query(metricsQuery, [campaignId]);
    const metrics = metricsResult.rows[0];

    // 2. Timeline de atividade (últimos 30 dias)
    const timelineQuery = `
      SELECT 
        DATE(sent_at) as date,
        COUNT(*) as invites_sent
      FROM leads
      WHERE campaign_id = $1 AND sent_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(sent_at)
      ORDER BY date ASC
    `;

    const timeline = await db.query(timelineQuery, [campaignId]);

    // 3. Taxa de resposta por dia da semana
    const dayOfWeekQuery = `
      SELECT 
        EXTRACT(DOW FROM sent_at) as day_of_week,
        COUNT(*) as sent,
        COUNT(*) FILTER (WHERE accepted_at IS NOT NULL) as accepted
      FROM leads
      WHERE campaign_id = $1 AND sent_at IS NOT NULL
      GROUP BY EXTRACT(DOW FROM sent_at)
      ORDER BY day_of_week
    `;

    const dayOfWeekResult = await db.query(dayOfWeekQuery, [campaignId]);

    const daysMap = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const byDayOfWeek = dayOfWeekResult.rows.map(row => ({
      day: daysMap[parseInt(row.day_of_week)],
      sent: parseInt(row.sent),
      accepted: parseInt(row.accepted),
      acceptance_rate: row.sent > 0 ? ((row.accepted / row.sent) * 100).toFixed(2) : 0
    }));

    // 4. Top leads qualificados
    const topLeadsQuery = `
      SELECT 
        id,
        name,
        title,
        company,
        score,
        qualified_at
      FROM leads
      WHERE campaign_id = $1 AND status = 'qualified'
      ORDER BY score DESC, qualified_at DESC
      LIMIT 10
    `;

    const topLeads = await db.query(topLeadsQuery, [campaignId]);

    // 5. Tempo médio para aceitar
    const avgTimeQuery = `
      SELECT 
        AVG(EXTRACT(EPOCH FROM (accepted_at - sent_at))/86400) as avg_days_to_accept
      FROM leads
      WHERE campaign_id = $1 AND accepted_at IS NOT NULL AND sent_at IS NOT NULL
    `;

    const avgTimeResult = await db.query(avgTimeQuery, [campaignId]);
    const avgDaysToAccept = avgTimeResult.rows[0].avg_days_to_accept 
      ? parseFloat(avgTimeResult.rows[0].avg_days_to_accept).toFixed(1)
      : null;

    // Calcular taxas
    const totalSent = parseInt(metrics.sent);
    const totalAccepted = parseInt(metrics.accepted);
    const totalQualified = parseInt(metrics.qualified);

    const analytics = {
      campaign_id: campaignId,
      campaign_name: campaign.name,
      metrics: {
        total_leads: parseInt(metrics.total_leads),
        pending: parseInt(metrics.pending),
        sent: totalSent,
        accepted: totalAccepted,
        qualifying: parseInt(metrics.qualifying),
        qualified: totalQualified,
        discarded: parseInt(metrics.discarded),
        avg_qualified_score: metrics.avg_qualified_score 
          ? parseFloat(metrics.avg_qualified_score).toFixed(1)
          : null
      },
      rates: {
        acceptance_rate: totalSent > 0 ? ((totalAccepted / totalSent) * 100).toFixed(2) : 0,
        qualification_rate: totalAccepted > 0 ? ((totalQualified / totalAccepted) * 100).toFixed(2) : 0,
        avg_days_to_accept: avgDaysToAccept
      },
      recent_activity: {
        sent_last_7_days: parseInt(metrics.sent_last_7_days),
        accepted_last_7_days: parseInt(metrics.accepted_last_7_days)
      },
      timeline: timeline.rows,
      by_day_of_week: byDayOfWeek,
      top_qualified_leads: topLeads.rows
    };

    console.log('✅ Analytics da campanha compiladas');

    sendSuccess(res, analytics);

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 3. FUNIL DE CONVERSÃO
// ================================
const getConversionFunnel = async (req, res) => {
  try {
    const userId = req.user.id;
    const { campaign_id } = req.query;

    console.log(`🔄 Calculando funil de conversão`);

    let whereClause = 'c.user_id = $1';
    let queryParams = [userId];

    if (campaign_id) {
      whereClause += ' AND l.campaign_id = $2';
      queryParams.push(campaign_id);
    }

    const funnelQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE l.status IN ('leads', 'invite_sent', 'accepted', 'qualifying', 'qualified')) as in_funnel,
        COUNT(*) FILTER (WHERE l.status = 'invite_sent') as invites_sent,
        COUNT(*) FILTER (WHERE l.status = 'accepted') as accepted,
        COUNT(*) FILTER (WHERE l.status = 'qualifying') as qualifying,
        COUNT(*) FILTER (WHERE l.status = 'qualified') as qualified
      FROM leads l
      JOIN campaigns c ON l.campaign_id = c.id
      WHERE ${whereClause}
    `;

    const result = await db.query(funnelQuery, queryParams);
    const data = result.rows[0];

    const total = parseInt(data.total);
    const inFunnel = parseInt(data.in_funnel);
    const sent = parseInt(data.invites_sent);
    const accepted = parseInt(data.accepted);
    const qualifying = parseInt(data.qualifying);
    const qualified = parseInt(data.qualified);

    const funnel = [
      {
        stage: 'Total Leads',
        count: total,
        percentage: 100,
        conversion_from_previous: null
      },
      {
        stage: 'Convites Enviados',
        count: sent,
        percentage: total > 0 ? ((sent / total) * 100).toFixed(2) : 0,
        conversion_from_previous: null
      },
      {
        stage: 'Aceitos',
        count: accepted,
        percentage: total > 0 ? ((accepted / total) * 100).toFixed(2) : 0,
        conversion_from_previous: sent > 0 ? ((accepted / sent) * 100).toFixed(2) : 0
      },
      {
        stage: 'Qualificando',
        count: qualifying,
        percentage: total > 0 ? ((qualifying / total) * 100).toFixed(2) : 0,
        conversion_from_previous: accepted > 0 ? ((qualifying / accepted) * 100).toFixed(2) : 0
      },
      {
        stage: 'Qualificados',
        count: qualified,
        percentage: total > 0 ? ((qualified / total) * 100).toFixed(2) : 0,
        conversion_from_previous: qualifying > 0 ? ((qualified / qualifying) * 100).toFixed(2) : 0
      }
    ];

    console.log('✅ Funil calculado');

    sendSuccess(res, {
      campaign_id: campaign_id || 'all',
      funnel
    });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 4. PERFORMANCE DE CONTAS LINKEDIN
// ================================
const getLinkedInAccountsPerformance = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`📊 Calculando performance das contas LinkedIn`);

    const performanceQuery = `
      SELECT 
        la.id,
        la.linkedin_username,
        la.profile_name,
        la.status,
        la.daily_limit,
        la.today_sent,
        COUNT(DISTINCT c.id) as campaigns_count,
        COUNT(DISTINCT l.id) as total_leads,
        COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'invite_sent') as sent,
        COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'accepted') as accepted,
        COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'qualified') as qualified,
        COUNT(DISTINCT conv.id) as conversations_count
      FROM linkedin_accounts la
      LEFT JOIN campaigns c ON la.id = c.linkedin_account_id
      LEFT JOIN leads l ON c.id = l.campaign_id
      LEFT JOIN conversations conv ON la.id = conv.linkedin_account_id
      WHERE la.user_id = $1
      GROUP BY la.id, la.linkedin_username, la.profile_name, la.status, la.daily_limit, la.today_sent
      ORDER BY qualified DESC, accepted DESC
    `;

    const result = await db.query(performanceQuery, [userId]);

    const accounts = result.rows.map(account => ({
      ...account,
      acceptance_rate: account.sent > 0 
        ? ((account.accepted / account.sent) * 100).toFixed(2)
        : 0,
      qualification_rate: account.accepted > 0
        ? ((account.qualified / account.accepted) * 100).toFixed(2)
        : 0,
      daily_usage: account.daily_limit > 0
        ? ((account.today_sent / account.daily_limit) * 100).toFixed(2)
        : 0
    }));

    console.log('✅ Performance calculada');

    sendSuccess(res, { accounts });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 5. PERFORMANCE DE AGENTES DE IA
// ================================
const getAIAgentsPerformance = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`🤖 Calculando performance dos agentes de IA`);

    const performanceQuery = `
      SELECT 
        aa.id,
        aa.name,
        aa.personality_tone,
        aa.is_active,
        aa.usage_count,
        COUNT(DISTINCT c.id) as campaigns_using,
        COUNT(DISTINCT conv.id) as conversations_count,
        COUNT(DISTINCT conv.id) FILTER (WHERE conv.ai_active = true) as active_conversations,
        COUNT(DISTINCT m.id) FILTER (WHERE m.sender_type = 'ai') as messages_sent,
        COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'qualified') as leads_qualified
      FROM ai_agents aa
      LEFT JOIN campaigns c ON aa.id = c.ai_agent_id
      LEFT JOIN conversations conv ON aa.id = conv.ai_agent_id
      LEFT JOIN messages m ON conv.id = m.conversation_id
      LEFT JOIN leads l ON conv.lead_id = l.id
      WHERE aa.user_id = $1
      GROUP BY aa.id, aa.name, aa.personality_tone, aa.is_active, aa.usage_count
      ORDER BY leads_qualified DESC, messages_sent DESC
    `;

    const result = await db.query(performanceQuery, [userId]);

    const agents = result.rows.map(agent => ({
      ...agent,
      messages_per_conversation: agent.conversations_count > 0
        ? (agent.messages_sent / agent.conversations_count).toFixed(1)
        : 0,
      qualification_rate: agent.conversations_count > 0
        ? ((agent.leads_qualified / agent.conversations_count) * 100).toFixed(2)
        : 0
    }));

    console.log('✅ Performance dos agentes calculada');

    sendSuccess(res, { agents });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 6. RELATÓRIO DE ATIVIDADE DIÁRIA
// ================================
const getDailyActivity = async (req, res) => {
  try {
    const userId = req.user.id;
    const { days = 30 } = req.query;

    console.log(`📅 Gerando relatório de atividade (${days} dias)`);

    const daysInt = parseInt(days);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysInt);

    const activityQuery = `
      SELECT 
        DATE(sent_at) as date,
        COUNT(*) as invites_sent,
        COUNT(*) FILTER (WHERE accepted_at IS NOT NULL) as invites_accepted,
        COUNT(DISTINCT campaign_id) as active_campaigns
      FROM leads l
      JOIN campaigns c ON l.campaign_id = c.id
      WHERE c.user_id = $1 AND sent_at >= $2
      GROUP BY DATE(sent_at)
      ORDER BY date ASC
    `;

    const activity = await db.query(activityQuery, [userId, startDate]);

    // Conversas por dia
    const conversationsQuery = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as new_conversations
      FROM conversations
      WHERE user_id = $1 AND created_at >= $2
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    const conversations = await db.query(conversationsQuery, [userId, startDate]);

    // Mensagens por dia
    const messagesQuery = `
      SELECT 
        DATE(m.sent_at) as date,
        COUNT(*) as messages_sent,
        COUNT(*) FILTER (WHERE m.sender_type = 'ai') as ai_messages,
        COUNT(*) FILTER (WHERE m.sender_type = 'user') as user_messages
      FROM messages m
      JOIN conversations conv ON m.conversation_id = conv.id
      WHERE conv.user_id = $1 AND m.sent_at >= $2
      GROUP BY DATE(m.sent_at)
      ORDER BY date ASC
    `;

    const messages = await db.query(messagesQuery, [userId, startDate]);

    // Combinar dados por data
    const dailyData = {};

    activity.rows.forEach(row => {
      const date = row.date.toISOString().split('T')[0];
      dailyData[date] = {
        date,
        invites_sent: parseInt(row.invites_sent),
        invites_accepted: parseInt(row.invites_accepted),
        active_campaigns: parseInt(row.active_campaigns),
        new_conversations: 0,
        messages_sent: 0,
        ai_messages: 0,
        user_messages: 0
      };
    });

    conversations.rows.forEach(row => {
      const date = row.date.toISOString().split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = {
          date,
          invites_sent: 0,
          invites_accepted: 0,
          active_campaigns: 0,
          new_conversations: 0,
          messages_sent: 0,
          ai_messages: 0,
          user_messages: 0
        };
      }
      dailyData[date].new_conversations = parseInt(row.new_conversations);
    });

    messages.rows.forEach(row => {
      const date = row.date.toISOString().split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = {
          date,
          invites_sent: 0,
          invites_accepted: 0,
          active_campaigns: 0,
          new_conversations: 0,
          messages_sent: 0,
          ai_messages: 0,
          user_messages: 0
        };
      }
      dailyData[date].messages_sent = parseInt(row.messages_sent);
      dailyData[date].ai_messages = parseInt(row.ai_messages);
      dailyData[date].user_messages = parseInt(row.user_messages);
    });

    const dailyReport = Object.values(dailyData).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    console.log('✅ Relatório diário gerado');

    sendSuccess(res, {
      period_days: daysInt,
      daily_activity: dailyReport
    });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

module.exports = {
  getDashboard,
  getCampaignAnalytics,
  getConversionFunnel,
  getLinkedInAccountsPerformance,
  getAIAgentsPerformance,
  getDailyActivity
};