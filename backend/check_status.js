require('dotenv').config();
const db = require('./src/config/database');

(async () => {
  try {
    const campaignId = '05db5ba8-0bd8-48fc-ba73-866dd0c2fbcb';

    // Check workflow states
    const wf = await db.query(`
      SELECT cws.conversation_id, cws.status, cws.current_node_id,
             cws.paused_until, cws.paused_reason, cws.resume_node_id,
             cws.updated_at
      FROM conversation_workflow_state cws
      WHERE cws.conversation_id IN (
        SELECT id FROM conversations WHERE campaign_id = $1
      )
      ORDER BY cws.updated_at DESC
    `, [campaignId]);
    console.log('=== WORKFLOW STATES ===');
    console.log(JSON.stringify(wf.rows, null, 2));

    // Check messages
    const msgs = await db.query(`
      SELECT m.conversation_id, LEFT(m.content, 80) as preview,
             m.sender_type, m.created_at,
             ct.name as contact_name
      FROM messages m
      JOIN conversations cv ON cv.id = m.conversation_id
      JOIN contacts ct ON ct.id = cv.contact_id
      WHERE cv.campaign_id = $1
      ORDER BY m.created_at DESC
      LIMIT 15
    `, [campaignId]);
    console.log('\n=== MESSAGES ===');
    console.log(JSON.stringify(msgs.rows, null, 2));

    // Check conversations opportunity linkage
    const convs = await db.query(`
      SELECT cv.id, ct.name, cv.opportunity_id, cv.assigned_user_id, cv.current_step
      FROM conversations cv
      JOIN contacts ct ON ct.id = cv.contact_id
      WHERE cv.campaign_id = $1
      ORDER BY cv.created_at DESC
    `, [campaignId]);
    console.log('\n=== CONVERSATIONS ===');
    console.log(JSON.stringify(convs.rows, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
