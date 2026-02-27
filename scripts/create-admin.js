/**
 * node scripts/create-admin.js
 *
 * Cria o primeiro utilizador admin.
 * Edita as 3 linhas abaixo antes de correr.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool   = require('../db');
const bcrypt = require('bcryptjs');

// ── EDITA AQUI ─────────────────────────────────────────────
const NOME  = 'Mário';
const EMAIL = 'admin@codemaster.ao';
const SENHA = 'Admin@2026';          // usa uma senha forte em produção
// ──────────────────────────────────────────────────────────

async function run() {
  try {
    const hash = await bcrypt.hash(SENHA, 10);
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nome, email, senha_hash, tipo, status)
       VALUES ($1, $2, $3, 'admin', 'ativo')
       ON CONFLICT (email) DO UPDATE
         SET tipo='admin', status='ativo', senha_hash=EXCLUDED.senha_hash
       RETURNING id, nome, email, tipo`,
      [NOME, EMAIL, hash]
    );
    console.log('');
    console.log('✅ Admin pronto!');
    console.log('   ID:    ', rows[0].id);
    console.log('   Nome:  ', rows[0].nome);
    console.log('   Email: ', rows[0].email);
    console.log('   Senha: ', SENHA);
    console.log('');
    console.log('👉 Entra em http://localhost:5173/login');
  } catch (err) {
    console.error('❌ Erro:', err.message);
  } finally {
    await pool.end();
  }
}

run();
