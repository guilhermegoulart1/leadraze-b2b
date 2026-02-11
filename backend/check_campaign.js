require('dotenv').config();
const db = require('./src/config/database');

(async () => {
  try {
    const campaignId = '05db5ba8-0bd8-48fc-ba73-866dd0c2fbcb';

    // Check conversations with all relevant fields
    const convos = await db.query(`
      SELECT cv.id, cv.status, cv.ai_active, cv.ai_agent_id, cv.campaign_id,
             cv.contact_id, ct.name as contact_name, cv.created_at,
             cv.linkedin_account_id, cv.current_step, cv.step_history,
             cv.opportunity_id
      FROM conversations cv
      JOIN contacts ct ON ct.id = cv.contact_id
      WHERE cv.campaign_id = $1
      ORDER BY cv.created_at DESC
      LIMIT 10
    `, [campaignId]);
    console.log('=== CONVERSATIONS ===');
    console.log(JSON.stringify(convos.rows, null, 2));

    // Check messages
    const msgs = await db.query(`
      SELECT m.conversation_id, LEFT(m.content, 100) as content_preview,
             m.sender_type, m.created_at
      FROM messages m
      WHERE m.conversation_id IN (
        SELECT id FROM conversations WHERE campaign_id = $1
      )
      ORDER BY m.created_at DESC
      LIMIT 10
    `, [campaignId]);
    console.log('\n=== MESSAGES ===');
    console.log(JSON.stringify(msgs.rows, null, 2));

    // Check opportunities
    const opps = await db.query(`
      SELECT o.id, ct.name as contact_name, ps.name as stage_name, o.created_at
      FROM opportunities o
      JOIN contacts ct ON ct.id = o.contact_id
      LEFT JOIN pipeline_stages ps ON ps.id = o.stage_id
      WHERE o.contact_id IN (
        SELECT contact_id FROM conversations WHERE campaign_id = $1
      )
      ORDER BY o.created_at DESC
    `, [campaignId]);
    console.log('\n=== OPPORTUNITIES ===');
    console.log(JSON.stringify(opps.rows, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
