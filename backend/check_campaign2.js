require('dotenv').config();
const db = require('./src/config/database');

(async () => {
  try {
    const campaignId = '05db5ba8-0bd8-48fc-ba73-866dd0c2fbcb';

    // Check unipile_chat_id and linkedin_account_id
    const convos = await db.query(`
      SELECT cv.id, cv.unipile_chat_id, cv.linkedin_account_id,
             la.profile_name, la.unipile_account_id,
             ct.name as contact_name
      FROM conversations cv
      JOIN contacts ct ON ct.id = cv.contact_id
      LEFT JOIN linkedin_accounts la ON la.id = cv.linkedin_account_id
      WHERE cv.campaign_id = $1
      ORDER BY cv.created_at DESC
      LIMIT 6
    `, [campaignId]);
    console.log('=== CONVERSATIONS (chat_id + account) ===');
    console.log(JSON.stringify(convos.rows, null, 2));

    // Check campaign linkedin_account_id vs conversation linkedin_account_id
    const campaign = await db.query(`
      SELECT c.linkedin_account_id as campaign_account_id,
             la.profile_name as campaign_account_name,
             la.unipile_account_id as campaign_unipile_id
      FROM campaigns c
      LEFT JOIN linkedin_accounts la ON la.id = c.linkedin_account_id
      WHERE c.id = $1
    `, [campaignId]);
    console.log('\n=== CAMPAIGN ACCOUNT (search account) ===');
    console.log(JSON.stringify(campaign.rows[0], null, 2));

    // Check campaign_linkedin_accounts (send accounts)
    const sendAccounts = await db.query(`
      SELECT cla.linkedin_account_id, la.profile_name, la.unipile_account_id
      FROM campaign_linkedin_accounts cla
      JOIN linkedin_accounts la ON la.id = cla.linkedin_account_id
      WHERE cla.campaign_id = $1 AND cla.is_active = true
      ORDER BY cla.priority
    `, [campaignId]);
    console.log('\n=== SEND ACCOUNTS ===');
    console.log(JSON.stringify(sendAccounts.rows, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
