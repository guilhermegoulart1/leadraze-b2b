require('dotenv').config();
const db = require('../src/config/database');
const unipileClient = require('../src/config/unipile');

async function addUnipileChannel() {
  const userId = '46f0423c-8654-4bdc-8488-3b292489b56b';
  const accountId = '1782256a-2af2-45f5-8453-9945c565c8de';
  const unipileAccountId = '7ejCyUhoTrqRQtuZL0_kdw';

  console.log('🔍 Buscando dados da conta Unipile:', unipileAccountId);
  console.log('');

  // 1. Buscar dados da conta na Unipile
  let accountData = {};
  let profileData = null;

  try {
    accountData = await unipileClient.account.getAccountById(unipileAccountId);
    console.log('📊 Dados da conta Unipile:');
    console.log(JSON.stringify(accountData, null, 2));
    console.log('');
  } catch (err) {
    console.error('❌ Erro ao buscar conta:', err.message);
    process.exit(1);
  }

  // 2. Buscar perfil LinkedIn
  try {
    profileData = await unipileClient.users.getOwnProfile(unipileAccountId);
    console.log('👤 Perfil LinkedIn:');
    console.log(JSON.stringify(profileData, null, 2));
    console.log('');
  } catch (err) {
    console.warn('⚠️ Erro ao buscar perfil:', err.message);
  }

  // 3. Verificar se já existe
  const existing = await db.query(`
    SELECT la.*, u.email as user_email, u.name as user_name, a.name as account_name
    FROM linkedin_accounts la
    LEFT JOIN users u ON la.user_id = u.id
    LEFT JOIN accounts a ON la.account_id = a.id
    WHERE la.unipile_account_id = $1
  `, [unipileAccountId]);

  if (existing.rows.length > 0) {
    const ch = existing.rows[0];
    console.log('⚠️ Canal já existe no banco!');
    console.log('   - ID:', ch.id);
    console.log('   - Profile Name:', ch.profile_name);
    console.log('   - Associado ao usuário:', ch.user_name, '(' + ch.user_email + ')');
    console.log('   - Account:', ch.account_name);
    console.log('   - User ID:', ch.user_id);
    console.log('   - Account ID:', ch.account_id);
    console.log('');
    console.log('🔧 Para reassociar ao cliente correto, execute:');
    console.log('   UPDATE linkedin_accounts SET user_id = \'' + userId + '\', account_id = \'' + accountId + '\' WHERE id = \'' + ch.id + '\';');
    process.exit(0);
  }

  // 4. Inserir no banco
  const channelData = {
    user_id: userId,
    account_id: accountId,
    unipile_account_id: unipileAccountId,
    provider_type: 'LINKEDIN',
    status: 'active',
    connected_at: new Date(),
    channel_name: profileData?.name || accountData.name || 'LinkedIn Account',
    channel_identifier: accountData.identifier || accountData.email || null,
    linkedin_username: profileData?.public_identifier || null,
    profile_name: profileData?.name || accountData.name || 'LinkedIn Account',
    profile_url: profileData?.url || profileData?.profile_url || null,
    profile_picture: profileData?.profile_picture || profileData?.profile_picture_url || null,
    public_identifier: profileData?.public_identifier || null,
    channel_settings: JSON.stringify({
      ignore_groups: true,
      auto_read: false,
      ai_enabled: false,
      notify_on_message: true,
      business_hours_only: false
    })
  };

  console.log('💾 Inserindo canal no banco...');
  console.log('Dados:', JSON.stringify(channelData, null, 2));

  const result = await db.query(`
    INSERT INTO linkedin_accounts (
      user_id, account_id, unipile_account_id, provider_type, status, connected_at,
      channel_name, channel_identifier, linkedin_username, profile_name, profile_url,
      profile_picture, public_identifier, channel_settings
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING id
  `, [
    channelData.user_id,
    channelData.account_id,
    channelData.unipile_account_id,
    channelData.provider_type,
    channelData.status,
    channelData.connected_at,
    channelData.channel_name,
    channelData.channel_identifier,
    channelData.linkedin_username,
    channelData.profile_name,
    channelData.profile_url,
    channelData.profile_picture,
    channelData.public_identifier,
    channelData.channel_settings
  ]);

  console.log('');
  console.log('✅ Canal inserido com sucesso! ID:', result.rows[0].id);

  // 5. Verificar billing
  const billingResult = await db.query(
    'SELECT max_channels, current_channels FROM account_billing_summary WHERE account_id = $1',
    [accountId]
  );

  if (billingResult.rows.length > 0) {
    const billing = billingResult.rows[0];
    console.log('');
    console.log('💳 Billing atualizado:');
    console.log('   - Canais em uso:', billing.current_channels);
    console.log('   - Limite:', billing.max_channels);
  }

  process.exit(0);
}

addUnipileChannel().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
