require('dotenv').config();
const db = require('./src/config/database');

(async () => {
  try {
    const campaignId = '05db5ba8-0bd8-48fc-ba73-866dd0c2fbcb';

    // Check messages
    const msgs = await db.query(`
      SELECT m.conversation_id, LEFT(m.content, 120) as preview,
             m.sender_type, m.created_at,
             ct.name as contact_name
      FROM messages m
      JOIN conversations cv ON cv.id = m.conversation_id
      JOIN contacts ct ON ct.id = cv.contact_id
      WHERE cv.campaign_id = $1
      ORDER BY m.created_at DESC
      LIMIT 20
    `, [campaignId]);
    console.log('=== MESSAGES ===');
    console.log(JSON.stringify(msgs.rows, null, 2));

    // Check conversation statuses
    const convs = await db.query(`
      SELECT cv.id, ct.name, cv.status, cv.current_step,
             cv.last_message_at, LEFT(cv.last_message_preview, 80) as preview,
             cv.opportunity_id, cv.assigned_user_id
      FROM conversations cv
      JOIN contacts ct ON ct.id = cv.contact_id
      WHERE cv.campaign_id = $1
      ORDER BY cv.last_message_at DESC NULLS LAST
    `, [campaignId]);
    console.log('\n=== CONVERSATIONS ===');
    console.log(JSON.stringify(convs.rows, null, 2));

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
    console.log('\n=== WORKFLOW STATES ===');
    console.log(JSON.stringify(wf.rows, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
