/**
 * Script to check found_places data for a Google Maps agent
 * Usage: node backend/scripts/check-found-places.js <agent_id>
 */

require('dotenv').config();
const db = require('../src/config/database');

async function checkFoundPlaces(agentId) {
  try {
    console.log(`\n🔍 Checking agent: ${agentId}\n`);

    // Get agent data
    const result = await db.query(
      `SELECT
        id,
        name,
        insert_in_crm,
        leads_inserted,
        total_leads_found,
        found_places
      FROM google_maps_agents
      WHERE id = $1`,
      [agentId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const agent = result.rows[0];

    console.log(`📋 Agent: ${agent.name}`);
    console.log(`   ID: ${agent.id}`);
    console.log(`   Insert in CRM: ${agent.insert_in_crm}`);
    console.log(`   Leads inserted: ${agent.leads_inserted}`);
    console.log(`   Total leads found: ${agent.total_leads_found}`);
    console.log(`\n📦 found_places array:`);

    const foundPlaces = agent.found_places || [];

    if (Array.isArray(foundPlaces)) {
      console.log(`   Length: ${foundPlaces.length}`);

      if (foundPlaces.length > 0) {
        console.log(`\n✅ First item structure:`);
        console.log(JSON.stringify(foundPlaces[0], null, 2));

        // Check for AI enrichment fields
        const firstItem = foundPlaces[0];
        console.log(`\n🤖 AI Enrichment fields in first item:`);
        console.log(`   company_description: ${firstItem.company_description ? '✅ YES' : '❌ NO'}`);
        console.log(`   company_services: ${firstItem.company_services?.length > 0 ? `✅ YES (${firstItem.company_services.length})` : '❌ NO'}`);
        console.log(`   pain_points: ${firstItem.pain_points?.length > 0 ? `✅ YES (${firstItem.pain_points.length})` : '❌ NO'}`);
        console.log(`   emails: ${firstItem.emails?.length > 0 ? `✅ YES (${firstItem.emails.length})` : '❌ NO'}`);
        console.log(`   phones: ${firstItem.phones?.length > 0 ? `✅ YES (${firstItem.phones.length})` : '❌ NO'}`);
        console.log(`   social_links: ${firstItem.social_links ? '✅ YES' : '❌ NO'}`);
      } else {
        console.log(`   ⚠️  Array is empty!`);
      }
    } else {
      console.log(`   ❌ Not an array! Type: ${typeof foundPlaces}`);
      console.log(`   Value:`, foundPlaces);
    }

    await db.end();
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error:`, error.message);
    await db.end();
    process.exit(1);
  }
}

// Parse command line arguments
const agentId = process.argv[2];

if (!agentId) {
  console.error('Usage: node backend/scripts/check-found-places.js <agent_id>');
  console.error('Example: node backend/scripts/check-found-places.js c074ed95-7ded-42b5-9e83-c9eefa8e2da3');
  process.exit(1);
}

checkFoundPlaces(agentId);
