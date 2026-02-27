/**
 * node scripts/setup.js
 * Cria tabelas, insere dados iniciais e aplica migrations (idempotente).
 */
require('dotenv').config();
const pool = require('../db');
const fs   = require('fs');
const path = require('path');

async function setup() {
  const client = await pool.connect();
  try {

    // ── 1. EXTENSÕES ─────────────────────────────────────────
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    // ── 2. TABELAS PRINCIPAIS ────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        nome          VARCHAR(150) NOT NULL,
        email         VARCHAR(200) UNIQUE NOT NULL,
        senha_hash    VARCHAR(255),
        whatsapp      VARCHAR(30),
        situacao_atual TEXT,
        tipo          VARCHAR(20) DEFAULT 'aluno'
                        CHECK (tipo IN ('aluno','professor','admin')),
        status        VARCHAR(20) DEFAULT 'pendente'
                        CHECK (status IN ('pendente','ativo','inativo')),
        data_criacao  TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ tabela: usuarios');

    await client.query(`
      CREATE TABLE IF NOT EXISTS inscricoes (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        nome             VARCHAR(150) NOT NULL,
        email            VARCHAR(200) NOT NULL,
        whatsapp         VARCHAR(30) NOT NULL,
        plano            VARCHAR(100) NOT NULL,
        situacao_atual   VARCHAR(100),
        metodo_pagamento VARCHAR(50) NOT NULL,
        status           VARCHAR(30) DEFAULT 'pendente'
                           CHECK (status IN ('pendente','aguardando_comprovativo','pago','cancelado')),
        observacoes      TEXT,
        data_inscricao   TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ tabela: inscricoes');

    await client.query(`
      CREATE TABLE IF NOT EXISTS modulos (
        id        SERIAL PRIMARY KEY,
        nome      VARCHAR(100) NOT NULL,
        descricao TEXT,
        icone     VARCHAR(10),
        ordem     INT NOT NULL,
        ativo     BOOLEAN DEFAULT true
      );
    `);
    console.log('✅ tabela: modulos');

    await client.query(`
      CREATE TABLE IF NOT EXISTS topicos (
        id        SERIAL PRIMARY KEY,
        modulo_id INT REFERENCES modulos(id) ON DELETE CASCADE,
        titulo    VARCHAR(200) NOT NULL,
        descricao TEXT,
        ordem     INT NOT NULL,
        UNIQUE (modulo_id, ordem)
      );
    `);
    console.log('✅ tabela: topicos');

    await client.query(`
      CREATE TABLE IF NOT EXISTS progresso_aluno (
        id             SERIAL PRIMARY KEY,
        usuario_id     UUID REFERENCES usuarios(id) ON DELETE CASCADE,
        topico_id      INT REFERENCES topicos(id) ON DELETE CASCADE,
        concluido      BOOLEAN DEFAULT false,
        data_conclusao TIMESTAMP,
        UNIQUE (usuario_id, topico_id)
      );
    `);
    console.log('✅ tabela: progresso_aluno');

    await client.query(`
      CREATE TABLE IF NOT EXISTS anotacoes_professor (
        id           SERIAL PRIMARY KEY,
        usuario_id   UUID REFERENCES usuarios(id) ON DELETE CASCADE,
        professor_id UUID REFERENCES usuarios(id),
        conteudo     TEXT NOT NULL,
        data_criacao TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ tabela: anotacoes_professor');

    // ── 3. SEED: MÓDULOS ─────────────────────────────────────
    console.log('\n🌱 A inserir módulos...');
    const modulos = [
      { nome: 'Lógica & Algoritmos',      desc: 'Desenvolver raciocínio lógico sólido', icone: '🧠', ordem: 1 },
      { nome: 'C++ — Fundamentos Fortes', desc: 'Entender como a programação funciona por baixo', icone: '⚙️', ordem: 2 },
      { nome: 'Python Aplicado',          desc: 'Aplicar lógica em linguagem moderna e versátil', icone: '🐍', ordem: 3 },
      { nome: 'Projetos Práticos',        desc: 'Aprender fazendo com projetos reais', icone: '🛠️', ordem: 4 },
    ];
    for (const m of modulos) {
      await client.query(
        `INSERT INTO modulos (nome, descricao, icone, ordem)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT DO NOTHING`,
        [m.nome, m.desc, m.icone, m.ordem]
      );
    }

    // ── 4. SEED: TÓPICOS ─────────────────────────────────────
    console.log('🌱 A inserir tópicos...');
    const topicos = {
      1: [
        'O que é um algoritmo','Fluxogramas','Variáveis e tipos de dados','Operadores',
        'Estruturas condicionais','Estruturas de repetição','Vetores e matrizes',
        'Introdução à resolução de problemas'
      ],
      2: [
        'Sintaxe básica','Entrada e saída de dados','Condições e loops','Funções',
        'Vetores e matrizes','Introdução a ponteiros','Estruturação de código'
      ],
      3: [
        'Sintaxe moderna','Estruturas de dados','Funções','Manipulação de listas',
        'Pequenos projetos práticos','Introdução a scripts automatizados'
      ],
      4: [
        'Exercícios semanais','Desafios progressivos','Mini-projetos guiados','Projeto final integrado',
        'Code review individual','Apresentação de resultados'
      ],
    };
    for (const [ordemModulo, titulos] of Object.entries(topicos)) {
      const { rows } = await client.query('SELECT id FROM modulos WHERE ordem=$1', [ordemModulo]);
      if (!rows[0]) continue;
      const moduloId = rows[0].id;
      for (let i = 0; i < titulos.length; i++) {
        await client.query(
          `INSERT INTO topicos (modulo_id, titulo, ordem)
           VALUES ($1,$2,$3)
           ON CONFLICT (modulo_id, ordem) DO NOTHING`,
          [moduloId, titulos[i], i + 1]
        );
      }
    }

    // ── 5. MIGRATIONS ─────────────────────────────────────────
    console.log('\n🌱 Rodando migrations...');
    const migrationsPath = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsPath).sort();
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsPath, file), 'utf8');
      await client.query(sql);
      console.log(`✅ Migration aplicada: ${file}`);
    }

    console.log('\n✅ Setup completo!');
    console.log('👑 Próximo passo — criar admin: node scripts/create-admin.js');

  } catch (err) {
    console.error('\n❌ Erro no setup:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

setup();