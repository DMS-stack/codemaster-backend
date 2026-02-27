/**
 * node scripts/setup.js
 * Setup completo do banco de dados (idempotente — pode rodar várias vezes).
 */
require('dotenv').config();
const pool = require('../db');
const fs   = require('fs');
const path = require('path');

async function setup() {
  const client = await pool.connect();
  try {
    console.log('🚀 Iniciando setup do banco de dados...\n');

    // ── 1. EXTENSÕES ─────────────────────────────────────────
    console.log('📦 Criando extensões...');
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    console.log('✅ Extensões criadas/verificadas\n');

    // ── 2. TABELAS PRINCIPAIS ────────────────────────────────
    console.log('📦 Criando tabelas principais...');

    // usuarios
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        nome VARCHAR(150) NOT NULL,
        email VARCHAR(200) UNIQUE NOT NULL,
        senha_hash VARCHAR(255),
        whatsapp VARCHAR(30),
        situacao_atual TEXT,
        tipo VARCHAR(20) DEFAULT 'aluno' CHECK (tipo IN ('aluno','professor','admin')),
        status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente','ativo','inativo')),
        data_criacao TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ tabela: usuarios');

    // inscricoes
    await client.query(`
      CREATE TABLE IF NOT EXISTS inscricoes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        nome VARCHAR(150) NOT NULL,
        email VARCHAR(200) NOT NULL,
        whatsapp VARCHAR(30) NOT NULL,
        plano VARCHAR(100) NOT NULL,
        situacao_atual VARCHAR(100),
        metodo_pagamento VARCHAR(50) NOT NULL,
        status VARCHAR(30) DEFAULT 'pendente' CHECK (status IN ('pendente','aguardando_comprovativo','pago','cancelado')),
        observacoes TEXT,
        data_inscricao TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ tabela: inscricoes');

    // modulos
    await client.query(`
      CREATE TABLE IF NOT EXISTS modulos (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        descricao TEXT,
        icone VARCHAR(10),
        ordem INT NOT NULL,
        ativo BOOLEAN DEFAULT true
      );
    `);

    // remover duplicados temporariamente para não quebrar UNIQUE
    await client.query(`
      DELETE FROM modulos
      WHERE id NOT IN (
        SELECT MIN(id) FROM modulos GROUP BY ordem
      );
    `);

    // criar constraint UNIQUE se não existir
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'modulos_ordem_key' 
          AND conrelid = 'modulos'::regclass
        ) THEN
          ALTER TABLE modulos ADD CONSTRAINT modulos_ordem_key UNIQUE (ordem);
        END IF;
      END $$;
    `);
    console.log('✅ tabela: modulos (com unique em ordem)');

    // topicos
    await client.query(`
      CREATE TABLE IF NOT EXISTS topicos (
        id SERIAL PRIMARY KEY,
        modulo_id INT REFERENCES modulos(id) ON DELETE CASCADE,
        titulo VARCHAR(200) NOT NULL,
        descricao TEXT,
        ordem INT NOT NULL,
        UNIQUE (modulo_id, ordem)
      );
    `);
    console.log('✅ tabela: topicos');

    // progresso_aluno
    await client.query(`
      CREATE TABLE IF NOT EXISTS progresso_aluno (
        id SERIAL PRIMARY KEY,
        usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
        topico_id INT REFERENCES topicos(id) ON DELETE CASCADE,
        concluido BOOLEAN DEFAULT false,
        data_conclusao TIMESTAMP,
        UNIQUE (usuario_id, topico_id)
      );
    `);
    console.log('✅ tabela: progresso_aluno');

    // anotacoes_professor
    await client.query(`
      CREATE TABLE IF NOT EXISTS anotacoes_professor (
        id SERIAL PRIMARY KEY,
        usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
        professor_id UUID REFERENCES usuarios(id),
        conteudo TEXT NOT NULL,
        data_criacao TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ tabela: anotacoes_professor\n');

    // ── 3. SEED: MÓDULOS ─────────────────────────────────────
    console.log('🌱 Inserindo módulos...');
    const modulos = [
      { nome: 'Lógica & Algoritmos', desc: 'Desenvolver raciocínio lógico sólido', icone: '🧠', ordem: 1 },
      { nome: 'C++ — Fundamentos Fortes', desc: 'Entender como a programação funciona por baixo', icone: '⚙️', ordem: 2 },
      { nome: 'Python Aplicado', desc: 'Aplicar lógica em linguagem moderna e versátil', icone: '🐍', ordem: 3 },
      { nome: 'Projetos Práticos', desc: 'Aprender fazendo com projetos reais', icone: '🛠️', ordem: 4 },
    ];

    for (const m of modulos) {
      await client.query(`
        INSERT INTO modulos (nome, descricao, icone, ordem)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT (ordem) DO UPDATE SET
          nome = EXCLUDED.nome,
          descricao = EXCLUDED.descricao,
          icone = EXCLUDED.icone
      `, [m.nome, m.desc, m.icone, m.ordem]);
    }
    console.log('✅ Módulos inseridos/atualizados');

    // ── 4. SEED: TÓPICOS ─────────────────────────────────────
    console.log('🌱 Inserindo tópicos...');
    const topicos = {
      1: ['O que é um algoritmo','Fluxogramas','Variáveis e tipos de dados','Operadores','Estruturas condicionais','Estruturas de repetição','Vetores e matrizes','Introdução à resolução de problemas'],
      2: ['Sintaxe básica','Entrada e saída de dados','Condições e loops','Funções','Vetores e matrizes','Introdução a ponteiros','Estruturação de código'],
      3: ['Sintaxe moderna','Estruturas de dados','Funções','Manipulação de listas','Pequenos projetos práticos','Introdução a scripts automatizados'],
      4: ['Exercícios semanais','Desafios progressivos','Mini-projetos guiados','Projeto final integrado','Code review individual','Apresentação de resultados'],
    };

    for (const [ordemModulo, titulos] of Object.entries(topicos)) {
      const { rows } = await client.query('SELECT id FROM modulos WHERE ordem = $1', [ordemModulo]);
      if (!rows[0]) continue;
      const moduloId = rows[0].id;
      for (let i = 0; i < titulos.length; i++) {
        await client.query(`
          INSERT INTO topicos (modulo_id, titulo, ordem)
          VALUES ($1,$2,$3)
          ON CONFLICT (modulo_id, ordem) DO UPDATE SET titulo = EXCLUDED.titulo
        `, [moduloId, titulos[i], i + 1]);
      }
    }
    console.log('✅ Tópicos inseridos/atualizados\n');

    // ── 5. MIGRATIONS ─────────────────────────────────────────
    console.log('📦 Aplicando migrations...');
    const migrationsPath = path.join(__dirname, '../migrations');
    if (fs.existsSync(migrationsPath)) {
      const files = fs.readdirSync(migrationsPath).filter(f => f.endsWith('.sql')).sort();
      for (const file of files) {
        try {
          const sql = fs.readFileSync(path.join(migrationsPath, file), 'utf8');
          await client.query('BEGIN');
          try {
            await client.query(sql);
            await client.query('COMMIT');
            console.log(`✅ Migration aplicada: ${file}`);
          } catch (err) {
            await client.query('ROLLBACK');
            if (err.message.includes('already exists') || err.message.includes('duplicate key')) {
              console.log(`⚠️ Migration ignorada (tabelas ou índices já existem): ${file}`);
            } else {
              throw err;
            }
          }
        } catch (err) {
          console.error(`❌ Erro ao processar migration ${file}:`, err.message);
          throw err;
        }
      }
    } else {
      console.log('⚠️ Pasta de migrations não encontrada');
    }

    console.log('\n✨ Setup completo e idempotente!');
    console.log('👑 Próximo passo — criar admin: node scripts/create-admin.js\n');

  } catch (err) {
    console.error('\n❌ Erro no setup:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

setup();