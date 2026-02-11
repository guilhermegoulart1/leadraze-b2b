require('dotenv').config();
const db = require('./src/config/database');

(async () => {
  try {
    const campaignId = '05db5ba8-0bd8-48fc-ba73-866dd0c2fbcb';

    // Get conversation IDs
    const convos = await db.query(`
      SELECT id FROM conversations WHERE campaign_id = $1
    `, [campaignId]);
    const convoIds = convos.rows.map(r => r.id);
    console.log('Conversation IDs:', convoIds);

    // Check workflow state
    const wfState = await db.query(`
      SELECT cws.conversation_id, cws.status, cws.current_node_id,
             cws.paused_until, cws.created_at, cws.updated_at
      FROM conversation_workflow_state cws
      WHERE cws.conversation_id = ANY($1)
      ORDER BY cws.created_at DESC
    `, [convoIds]);
    console.log('\n=== WORKFLOW STATES ===');
    console.log(JSON.stringify(wfState.rows, null, 2));

    // Check workflow execution logs
    const wfLogs = await db.query(`
      SELECT conversation_id, event_type, node_id, node_type,
             error_message, created_at
      FROM workflow_execution_logs
      WHERE conversation_id = ANY($1)
      ORDER BY created_at DESC
      LIMIT 30
    `, [convoIds]);
    console.log('\n=== WORKFLOW LOGS ===');
    console.log(JSON.stringify(wfLogs.rows, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
