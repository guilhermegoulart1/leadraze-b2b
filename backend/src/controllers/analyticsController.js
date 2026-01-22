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
    const accountId = req.user.account_id;
    const { period = '30' } = req.query; // dias

    console.log(`📊 Buscando dashboard para account ${accountId} (${period} dias)`);

    const periodDays = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    // 1. Totais gerais - usando account_id para incluir todas as opportunities
    const totalsQuery = `
      SELECT
        (SELECT COUNT(*) FROM campaigns WHERE account_id = $1) as total_campaigns,
        (SELECT COUNT(*) FROM campaigns WHERE account_id = $1 AND status = 'active') as active_campaigns,
        (SELECT COUNT(*) FROM opportunities WHERE account_id = $1) as total_leads,
        (SELECT COUNT(*) FROM opportunities WHERE account_id = $1 AND qualified_at IS NOT NULL) as qualified_leads,
        (SELECT COUNT(*) FROM opportunities WHERE account_id = $1 AND sent_at IS NOT NULL AND accepted_at IS NULL) as invite_sent,
        (SELECT COUNT(*) FROM opportunities WHERE account_id = $1 AND accepted_at IS NOT NULL) as accepted,
        (SELECT COUNT(*) FROM conversations WHERE account_id = $1) as total_conversations,
        (SELECT COUNT(*) FROM conversations WHERE account_id = $1 AND ai_active = true) as ai_conversations,
        (SELECT COUNT(*) FROM linkedin_accounts WHERE account_id = $1) as linkedin_accounts
    `;

    const totalsResult = await db.query(totalsQuery, [accountId]);
    const totals = totalsResult.rows[0];

    // 2. Pipeline de Opportunities - usando campos de data para determinar status
    const pipelineQuery = `
      SELECT
        CASE
          WHEN o.discarded_at IS NOT NULL THEN 'discarded'
          WHEN o.qualified_at IS NOT NULL THEN 'qualified'
          WHEN o.qualifying_started_at IS NOT NULL THEN 'qualifying'
          WHEN o.accepted_at IS NOT NULL THEN 'accepted'
          WHEN o.sent_at IS NOT NULL THEN 'invite_sent'
          ELSE 'leads'
        END as status,
        COUNT(*) as count
      FROM opportunities o
      WHERE o.account_id = $1
      GROUP BY 1
    `;

    const pipelineResult = await db.query(pipelineQuery, [accountId]);

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
      WHERE account_id = $1
      GROUP BY status
    `;

    const conversationsResult = await db.query(conversationsQuery, [accountId]);

    const conversations = {
      hot: 0,
      warm: 0,
      cold: 0
    };

    conversationsResult.rows.forEach(row => {
      conversations[row.status] = parseInt(row.count);
    });

    // 5. Atividade recente (último período) - usando account_id
    const activityQuery = `
      SELECT
        DATE(o.created_at) as date,
        COUNT(*) as count
      FROM opportunities o
      WHERE o.account_id = $1 AND o.created_at >= $2
      GROUP BY DATE(o.created_at)
      ORDER BY date ASC
    `;

    const activityResult = await db.query(activityQuery, [accountId, startDate]);

    // 6. Top Campanhas - usando sent_at e accepted_at para contagem correta
    const topCampaignsQuery = `
      SELECT
        c.id,
        c.name,
        c.status,
        COUNT(o.id) as total_leads,
        COUNT(o.id) FILTER (WHERE o.qualified_at IS NOT NULL) as qualified_leads,
        COUNT(o.id) FILTER (WHERE o.sent_at IS NOT NULL) as sent,
        COUNT(o.id) FILTER (WHERE o.accepted_at IS NOT NULL) as accepted
      FROM campaigns c
      LEFT JOIN opportunities o ON c.id = o.campaign_id
      WHERE c.account_id = $1
      GROUP BY c.id, c.name, c.status
      ORDER BY qualified_leads DESC, total_leads DESC
      LIMIT 5
    `;

    const topCampaigns = await db.query(topCampaignsQuery, [accountId]);

    // 7. Métricas de IA
    const aiMetricsQuery = `
      SELECT
        COUNT(*) FILTER (WHERE ai_active = true) as ai_active,
        COUNT(*) FILTER (WHERE manual_control_taken = true) as manual_control,
        COUNT(DISTINCT ai_agent_id) as agents_in_use
      FROM conversations
      WHERE account_id = $1
    `;

    const aiMetrics = await db.query(aiMetricsQuery, [accountId]);

    // 7.1. Interações por Agente de IA
    const aiAgentInteractionsQuery = `
      SELECT
        aa.id,
        aa.name,
        COUNT(DISTINCT conv.id) as conversations,
        COUNT(m.id) FILTER (WHERE m.sender_type = 'ai') as messages_sent
      FROM ai_agents aa
      LEFT JOIN conversations conv ON conv.ai_agent_id = aa.id AND conv.account_id = $1
      LEFT JOIN messages m ON m.conversation_id = conv.id
      WHERE aa.account_id = $1 AND aa.is_active = true
      GROUP BY aa.id, aa.name
      ORDER BY messages_sent DESC
    `;
    const aiAgentInteractions = await db.query(aiAgentInteractionsQuery, [accountId]);

    // 8. Métricas de Mensagens/Conversação
    const messagesMetricsQuery = `
      SELECT
        COUNT(*) as total_messages,
        COUNT(*) FILTER (WHERE m.sender_type = 'ai') as ai_messages,
        COUNT(*) FILTER (WHERE m.sender_type = 'lead') as lead_messages
      FROM messages m
      JOIN conversations conv ON m.conversation_id = conv.id
      WHERE conv.account_id = $1
    `;
    const messagesMetrics = await db.query(messagesMetricsQuery, [accountId]);
    const msgMetrics = messagesMetrics.rows[0];

    const totalConvs = parseInt(totals.total_conversations) || 1;
    const conversationMetrics = {
      total_messages: parseInt(msgMetrics.total_messages) || 0,
      ai_messages: parseInt(msgMetrics.ai_messages) || 0,
      lead_messages: parseInt(msgMetrics.lead_messages) || 0,
      avg_messages_per_lead: totalConvs > 0 ? ((parseInt(msgMetrics.total_messages) || 0) / totalConvs).toFixed(1) : 0
    };

    // 9. Contacts mais engajados (mais mensagens)
    const engagedLeadsQuery = `
      SELECT
        o.id,
        ct.name,
        ct.title,
        ct.company,
        COUNT(m.id) as message_count,
        COUNT(m.id) FILTER (WHERE m.sender_type = 'lead') as lead_responses
      FROM opportunities o
      LEFT JOIN contacts ct ON o.contact_id = ct.id
      LEFT JOIN conversations conv ON conv.opportunity_id = o.id
      LEFT JOIN messages m ON m.conversation_id = conv.id
      WHERE o.account_id = $1 AND conv.id IS NOT NULL
      GROUP BY o.id, ct.id, ct.name, ct.title, ct.company
      ORDER BY message_count DESC
      LIMIT 5
    `;
    const engagedLeads = await db.query(engagedLeadsQuery, [accountId]);

    // 10. Opportunities por dia (novas opportunities criadas)
    const leadsPerDayQuery = `
      SELECT
        DATE(o.created_at) as date,
        COUNT(*) as count
      FROM opportunities o
      WHERE o.account_id = $1 AND o.created_at >= $2
      GROUP BY DATE(o.created_at)
      ORDER BY date ASC
    `;
    const leadsPerDayData = await db.query(leadsPerDayQuery, [accountId, startDate]);

    // 11. Faturamento por dia (deals ganhos) - usando account_id
    const revenuePerDayQuery = `
      SELECT
        DATE(o.won_at) as date,
        COALESCE(SUM(o.value), 0) as value,
        COUNT(*) as count
      FROM opportunities o
      WHERE o.account_id = $1
        AND o.won_at IS NOT NULL
        AND o.won_at >= $2
      GROUP BY DATE(o.won_at)
      ORDER BY date ASC
    `;
    const revenuePerDayData = await db.query(revenuePerDayQuery, [accountId, startDate]);

    // 12. Total de faturamento no período - usando account_id
    const revenueTotalQuery = `
      SELECT
        COALESCE(SUM(o.value), 0) as total
      FROM opportunities o
      WHERE o.account_id = $1
        AND o.won_at IS NOT NULL
        AND o.won_at >= $2
    `;
    const revenueTotalData = await db.query(revenueTotalQuery, [accountId, startDate]);

    // 13. Opportunities por fonte - usando account_id
    const leadsBySourceQuery = `
      SELECT
        COALESCE(o.source, 'linkedin') as source,
        COUNT(*) as count
      FROM opportunities o
      WHERE o.account_id = $1 AND o.created_at >= $2
      GROUP BY COALESCE(o.source, 'linkedin')
      ORDER BY count DESC
    `;
    const leadsBySourceData = await db.query(leadsBySourceQuery, [accountId, startDate]);

    // Fetch dynamic source labels, colors and icons from lead_sources table
    const sourceConfigQuery = `
      SELECT name, label, color, icon
      FROM lead_sources
      WHERE account_id = $1 AND is_active = true
    `;
    const sourceConfigResult = await db.query(sourceConfigQuery, [accountId]);

    // Build source config maps
    const sourceLabels = {};
    const sourceColors = {};
    const sourceIcons = {};

    // Fallback defaults for accounts without configured sources
    const defaultSourceConfig = {
      'linkedin': { label: 'LinkedIn', color: '#0077b5', icon: 'in' },
      'google_maps': { label: 'Google Maps', color: '#34a853', icon: 'G' },
      'lista': { label: 'Lista', color: '#7c3aed', icon: 'L' },
      'list': { label: 'Lista', color: '#7c3aed', icon: 'L' },
      'trafego_pago': { label: 'Tráfego Pago', color: '#f59e0b', icon: '$' },
      'paid_traffic': { label: 'Tráfego Pago', color: '#f59e0b', icon: '$' },
      'manual': { label: 'Manual', color: '#3b82f6', icon: 'M' },
      'indicacao': { label: 'Indicação', color: '#10b981', icon: 'R' },
      'referral': { label: 'Indicação', color: '#10b981', icon: 'R' },
      'outro': { label: 'Outro', color: '#6b7280', icon: '?' },
      'other': { label: 'Outro', color: '#6b7280', icon: '?' }
    };

    // Populate from database if available
    sourceConfigResult.rows.forEach(row => {
      sourceLabels[row.name] = row.label;
      sourceColors[row.name] = row.color;
      sourceIcons[row.name] = row.icon;
    });

    // Apply fallbacks for sources not in database
    Object.keys(defaultSourceConfig).forEach(key => {
      if (!sourceLabels[key]) {
        sourceLabels[key] = defaultSourceConfig[key].label;
        sourceColors[key] = defaultSourceConfig[key].color;
        sourceIcons[key] = defaultSourceConfig[key].icon;
      }
    });

    const totalLeadsBySource = leadsBySourceData.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
    const leadsBySource = leadsBySourceData.rows.map(row => ({
      source: row.source,
      label: sourceLabels[row.source] || row.source,
      color: sourceColors[row.source] || '#6b7280',
      icon: sourceIcons[row.source] || '?',
      count: parseInt(row.count),
      percentage: totalLeadsBySource > 0 ? parseFloat(((parseInt(row.count) / totalLeadsBySource) * 100).toFixed(1)) : 0
    }));

    // 14. Pipeline expandido com scheduled, won e lost - usando campos de data
    const pipelineExpandedQuery = `
      SELECT
        CASE
          WHEN o.lost_at IS NOT NULL THEN 'lost'
          WHEN o.won_at IS NOT NULL THEN 'won'
          WHEN o.discarded_at IS NOT NULL THEN 'discarded'
          WHEN o.scheduled_at IS NOT NULL THEN 'scheduled'
          WHEN o.qualified_at IS NOT NULL THEN 'qualified'
          WHEN o.qualifying_started_at IS NOT NULL THEN 'qualifying'
          WHEN o.accepted_at IS NOT NULL THEN 'accepted'
          WHEN o.sent_at IS NOT NULL THEN 'invite_sent'
          ELSE 'leads'
        END as status,
        COUNT(*) as count,
        COALESCE(SUM(o.value), 0) as value
      FROM opportunities o
      WHERE o.account_id = $1
      GROUP BY 1
    `;
    const pipelineExpandedResult = await db.query(pipelineExpandedQuery, [accountId]);

    const pipelineExpanded = {
      leads: { count: 0, value: 0 },
      invite_sent: { count: 0, value: 0 },
      accepted: { count: 0, value: 0 },
      qualifying: { count: 0, value: 0 },
      scheduled: { count: 0, value: 0 },
      won: { count: 0, value: 0 },
      lost: { count: 0, value: 0 }
    };

    pipelineExpandedResult.rows.forEach(row => {
      if (pipelineExpanded[row.status] !== undefined) {
        pipelineExpanded[row.status] = {
          count: parseInt(row.count),
          value: parseFloat(row.value) || 0
        };
      }
    });

    // 15. Tarefas do usuário logado
    const userTasksQuery = `
      SELECT
        COUNT(*) FILTER (WHERE i.is_completed = false AND i.due_date < CURRENT_DATE) as overdue,
        COUNT(*) FILTER (WHERE i.is_completed = false AND i.due_date::date = CURRENT_DATE) as today,
        COUNT(*) FILTER (WHERE i.is_completed = false AND i.due_date::date = CURRENT_DATE + INTERVAL '1 day') as tomorrow,
        COUNT(*) FILTER (WHERE i.is_completed = false) as total_pending
      FROM opportunity_checklist_items i
      JOIN opportunity_checklist_item_assignees cia ON cia.checklist_item_id = i.id
      WHERE cia.user_id = $1
    `;
    const userTasksData = await db.query(userTasksQuery, [userId]);
    const userTasks = userTasksData.rows[0] || { overdue: 0, today: 0, tomorrow: 0, total_pending: 0 };

    const dashboard = {
      period_days: periodDays,

      // Totais gerais
      totals: {
        campaigns: parseInt(totals.total_campaigns),
        active_campaigns: parseInt(totals.active_campaigns),
        leads: parseInt(totals.total_leads),
        qualified_leads: parseInt(totals.qualified_leads),
        invite_sent: parseInt(totals.invite_sent),
        accepted: parseInt(totals.accepted),
        conversations: parseInt(totals.total_conversations),
        ai_conversations: parseInt(totals.ai_conversations),
        linkedin_accounts: parseInt(totals.linkedin_accounts)
      },

      // Gráfico: Faturamento por dia
      revenue_per_day: revenuePerDayData.rows.map(row => ({
        date: row.date,
        value: parseFloat(row.value) || 0,
        count: parseInt(row.count) || 0
      })),
      revenue_total: parseFloat(revenueTotalData.rows[0]?.total) || 0,

      // Gráfico: Leads por dia
      leads_per_day: leadsPerDayData.rows.map(row => ({
        date: row.date,
        count: parseInt(row.count) || 0
      })),
      leads_total: leadsPerDayData.rows.reduce((sum, row) => sum + parseInt(row.count), 0),

      // Gráfico: Leads por fonte
      leads_by_source: leadsBySource,

      // Pipeline expandido
      pipeline: pipelineExpanded,

      // Tarefas do usuário
      user_tasks: {
        overdue: parseInt(userTasks.overdue) || 0,
        today: parseInt(userTasks.today) || 0,
        tomorrow: parseInt(userTasks.tomorrow) || 0,
        total_pending: parseInt(userTasks.total_pending) || 0
      },

      // Taxas de conversão
      conversion_rates: {
        invitation_to_acceptance: parseFloat(conversionRate),
        acceptance_to_qualified: parseFloat(qualificationRate)
      },

      // Top campanhas
      top_campaigns: topCampaigns.rows,

      // Interações por agente de IA
      ai_agent_interactions: aiAgentInteractions.rows.map(row => ({
        id: row.id,
        name: row.name,
        conversations: parseInt(row.conversations) || 0,
        messages_sent: parseInt(row.messages_sent) || 0
      })),

      // Dados legados (para compatibilidade)
      conversations_by_status: conversations,
      activity_chart: activityResult.rows,
      ai_metrics: aiMetrics.rows[0],
      conversation_metrics: conversationMetrics,
      most_engaged_leads: engagedLeads.rows
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
        COUNT(*) FILTER (WHERE sent_at IS NULL) as pending,
        COUNT(*) FILTER (WHERE sent_at IS NOT NULL AND accepted_at IS NULL) as sent,
        COUNT(*) FILTER (WHERE accepted_at IS NOT NULL AND qualifying_started_at IS NULL) as accepted,
        COUNT(*) FILTER (WHERE qualifying_started_at IS NOT NULL AND qualified_at IS NULL) as qualifying,
        COUNT(*) FILTER (WHERE qualified_at IS NOT NULL) as qualified,
        COUNT(*) FILTER (WHERE discarded_at IS NOT NULL) as discarded,
        AVG(score) FILTER (WHERE qualified_at IS NOT NULL) as avg_qualified_score,
        COUNT(*) FILTER (WHERE sent_at >= NOW() - INTERVAL '7 days') as sent_last_7_days,
        COUNT(*) FILTER (WHERE accepted_at >= NOW() - INTERVAL '7 days') as accepted_last_7_days
      FROM opportunities
      WHERE campaign_id = $1
    `;

    const metricsResult = await db.query(metricsQuery, [campaignId]);
    const metrics = metricsResult.rows[0];

    // 2. Timeline de atividade (últimos 30 dias)
    const timelineQuery = `
      SELECT
        DATE(sent_at) as date,
        COUNT(*) as invites_sent
      FROM opportunities
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
      FROM opportunities
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

    // 4. Top opportunities qualificadas
    const topLeadsQuery = `
      SELECT
        o.id,
        ct.name,
        ct.title,
        ct.company,
        o.score,
        o.qualified_at
      FROM opportunities o
      LEFT JOIN contacts ct ON o.contact_id = ct.id
      WHERE o.campaign_id = $1 AND o.qualified_at IS NOT NULL
      ORDER BY o.score DESC, o.qualified_at DESC
      LIMIT 10
    `;

    const topLeads = await db.query(topLeadsQuery, [campaignId]);

    // 5. Tempo médio para aceitar
    const avgTimeQuery = `
      SELECT
        AVG(EXTRACT(EPOCH FROM (accepted_at - sent_at))/86400) as avg_days_to_accept
      FROM opportunities
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
      whereClause += ' AND o.campaign_id = $2';
      queryParams.push(campaign_id);
    }

    const funnelQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE o.discarded_at IS NULL) as in_funnel,
        COUNT(*) FILTER (WHERE o.sent_at IS NOT NULL AND o.accepted_at IS NULL) as invites_sent,
        COUNT(*) FILTER (WHERE o.accepted_at IS NOT NULL AND o.qualifying_started_at IS NULL) as accepted,
        COUNT(*) FILTER (WHERE o.qualifying_started_at IS NOT NULL AND o.qualified_at IS NULL) as qualifying,
        COUNT(*) FILTER (WHERE o.qualified_at IS NOT NULL) as qualified
      FROM opportunities o
      JOIN campaigns c ON o.campaign_id = c.id
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
        COUNT(DISTINCT o.id) as total_leads,
        COUNT(DISTINCT o.id) FILTER (WHERE o.sent_at IS NOT NULL AND o.accepted_at IS NULL) as sent,
        COUNT(DISTINCT o.id) FILTER (WHERE o.accepted_at IS NOT NULL) as accepted,
        COUNT(DISTINCT o.id) FILTER (WHERE o.qualified_at IS NOT NULL) as qualified,
        COUNT(DISTINCT conv.id) as conversations_count
      FROM linkedin_accounts la
      LEFT JOIN campaigns c ON la.id = c.linkedin_account_id
      LEFT JOIN opportunities o ON c.id = o.campaign_id
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
        COUNT(DISTINCT o.id) FILTER (WHERE o.qualified_at IS NOT NULL) as leads_qualified
      FROM ai_agents aa
      LEFT JOIN campaigns c ON aa.id = c.ai_agent_id
      LEFT JOIN conversations conv ON aa.id = conv.ai_agent_id
      LEFT JOIN messages m ON conv.id = m.conversation_id
      LEFT JOIN opportunities o ON conv.opportunity_id = o.id
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
      FROM opportunities o
      JOIN campaigns c ON o.campaign_id = c.id
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