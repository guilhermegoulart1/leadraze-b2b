/**
 * Script para promover um usuário para Admin
 *
 * Usage:
 *   node backend/scripts/promote-to-admin.js <email>
 *
 * Exemplo:
 *   node backend/scripts/promote-to-admin.js user@example.com
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

// Configuração do banco
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'getraze',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function promoteToAdmin() {
  try {
    const email = process.argv[2];

    if (!email) {
      console.log('❌ Email não fornecido!');
      console.log('\nUsage: node backend/scripts/promote-to-admin.js <email>');
      console.log('Exemplo: node backend/scripts/promote-to-admin.js user@example.com\n');

      // Listar todos os usuários
      console.log('📋 Usuários disponíveis:\n');
      const usersResult = await pool.query(
        'SELECT id, name, email, role FROM users ORDER BY created_at'
      );

      usersResult.rows.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.email}) - Perfil: ${user.role}`);
      });

      console.log('\n');
      process.exit(1);
    }

    // Verificar se existe admin
    const adminCheck = await pool.query(
      "SELECT id, name, email FROM users WHERE role = 'admin'"
    );

    if (adminCheck.rows.length > 0) {
      const currentAdmin = adminCheck.rows[0];
      console.log(`⚠️  Já existe um Admin: ${currentAdmin.name} (${currentAdmin.email})`);
      console.log('Apenas 1 Admin é permitido por conta.');
      console.log('\nRebaixando o Admin atual para Supervisor...\n');

      await pool.query(
        "UPDATE users SET role = 'supervisor' WHERE role = 'admin'"
      );

      console.log(`✅ ${currentAdmin.name} agora é Supervisor`);
    }

    // Buscar usuário pelo email
    const userResult = await pool.query(
      'SELECT id, name, email, role FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      console.log(`❌ Usuário com email "${email}" não encontrado!`);
      process.exit(1);
    }

    const user = userResult.rows[0];

    if (user.role === 'admin') {
      console.log(`✅ ${user.name} (${user.email}) já é Admin!`);
      process.exit(0);
    }

    // Promover para admin
    await pool.query(
      "UPDATE users SET role = 'admin', updated_at = NOW() WHERE id = $1",
      [user.id]
    );

    console.log(`\n🎉 Sucesso!`);
    console.log(`✅ ${user.name} (${user.email}) foi promovido para Admin!\n`);

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

promoteToAdmin();
