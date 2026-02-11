require('dotenv').config();
const db = require('./src/config/database');

(async () => {
  try {
    const campaignId = '05db5ba8-0bd8-48fc-ba73-866dd0c2fbcb';

    // Check contacts enrichment status
    const contacts = await db.query(`
      SELECT ct.id, ct.name, ct.headline, ct.company, ct.about,
             ct.email, ct.phone, ct.experience IS NOT NULL as has_experience,
             ct.education IS NOT NULL as has_education,
             ct.skills IS NOT NULL as has_skills,
             ct.full_profile_fetched_at, ct.network_distance,
             ct.connections_count, ct.profile_picture,
             ct.public_identifier, ct.linkedin_profile_id
      FROM contacts ct
      WHERE ct.id IN (
        SELECT contact_id FROM conversations WHERE campaign_id = $1
      )
    `, [campaignId]);
    console.log('=== CONTACT ENRICHMENT STATUS ===');
    console.log(JSON.stringify(contacts.rows, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
