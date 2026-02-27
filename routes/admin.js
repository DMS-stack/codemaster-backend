const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const bcrypt  = require('bcryptjs');
const auth    = require('../middleware/auth');
const { enviarEmailCredenciais } = require('../utils/email');

// Todas as rotas exigem admin
router.use(auth(['admin']));

// ========== ROTAS EXISTENTES (MANTIDAS) ==========

// GET /api/admin/metricas
router.get('/metricas', async (req, res) => {
  try {
    const [ativos, pendentes, inscricoes, inscHoje] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM usuarios WHERE tipo='aluno' AND status='ativo'"),
      pool.query("SELECT COUNT(*) FROM inscricoes WHERE status='pendente'"),
      pool.query("SELECT COUNT(*) FROM inscricoes"),
      pool.query("SELECT COUNT(*) FROM inscricoes WHERE data_inscricao::date = CURRENT_DATE"),
    ]);
    res.json({
      alunosAtivos:         parseInt(ativos.rows[0].count),
      inscricoesPendentes:  parseInt(pendentes.rows[0].count),
      totalInscricoes:      parseInt(inscricoes.rows[0].count),
      inscricoesHoje:       parseInt(inscHoje.rows[0].count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao carregar métricas.' });
  }
});

// GET /api/admin/inscricoes
router.get('/inscricoes', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM inscricoes ORDER BY data_inscricao DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar inscrições.' });
  }
});

// PATCH /api/admin/inscricoes/:id/confirmar
router.patch('/inscricoes/:id/confirmar', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { rows: inscricao } = await client.query(
      'SELECT * FROM inscricoes WHERE id=$1',
      [req.params.id]
    );
    
    if (!inscricao[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Inscrição não encontrada.' });
    }

    const i = inscricao[0];
    const { enviarEmail } = req.body;

    // Gera senha temporária
    const senhaTemp = Math.random().toString(36).slice(-8).toUpperCase();
    const hash = await bcrypt.hash(senhaTemp, 10);

    // Cria ou atualiza usuário
    const { rows: user } = await client.query(
      `INSERT INTO usuarios (nome, email, whatsapp, senha_hash, situacao_atual, tipo, status)
       VALUES ($1,$2,$3,$4,$5,'aluno','ativo')
       ON CONFLICT (email) DO UPDATE SET
         nome = $1, whatsapp = $3, senha_hash = $4, situacao_atual = $5, status = 'ativo'
       RETURNING id, nome, email, whatsapp`,
      [i.nome, i.email, i.whatsapp, hash, i.situacao_atual]
    );

    // Atualiza inscrição
    await client.query(
      `UPDATE inscricoes SET status='pago' WHERE id=$1`,
      [req.params.id]
    );

    await client.query('COMMIT');

    // Envio automático de email (opcional)
    let emailEnviado = false;
    if (enviarEmail === true) {
      const resultado = await enviarEmailCredenciais({
        para: i.email,
        nome: i.nome,
        senha: senhaTemp,
        link: process.env.FRONTEND_URL || 'https://codemaster.ao'
      });
      emailEnviado = resultado.success;
    }

    res.json({
      success: true,
      user: user[0],
      senhaTemp,
      message: `Conta criada/ativada.`,
      emailEnviado,
      whatsappMsg: `🎉 *Bem-vindo à CodeMaster!*\n\nOlá ${i.nome}, seu acesso foi ativado!\n\n📧 *Email:* ${i.email}\n🔑 *Senha:* ${senhaTemp}\n\n⚠️ Altere sua senha no primeiro login!\n\n🚀 Acesse: ${process.env.FRONTEND_URL}`
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Erro ao confirmar inscrição.' });
  } finally {
    client.release();
  }
});

// GET /api/admin/alunos — lista alunos com progresso (versão simplificada)
router.get('/alunos', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        u.id, 
        u.nome, 
        u.email, 
        u.whatsapp, 
        u.status, 
        u.data_criacao,
        COALESCE((
          SELECT COUNT(*) 
          FROM progresso_aluno 
          WHERE usuario_id = u.id AND concluido = true
        ), 0) AS topicos_concluidos,
        (SELECT COUNT(*) FROM topicos) AS total_topicos
      FROM usuarios u
      WHERE u.tipo = 'aluno'
      ORDER BY u.data_criacao DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar alunos.' });
  }
});

// POST /api/admin/alunos — criar aluno manualmente
router.post('/alunos', async (req, res) => {
  const { nome, email, whatsapp, senha } = req.body;
  if (!nome || !email || !senha) {
    return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
  }
  try {
    const hash = await bcrypt.hash(senha, 10);
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nome, email, senha_hash, whatsapp, tipo, status)
       VALUES ($1,$2,$3,$4,'aluno','ativo') RETURNING id, nome, email`,
      [nome, email, hash, whatsapp || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email já registado.' });
    res.status(500).json({ error: 'Erro ao criar aluno.' });
  }
});

// GET /api/admin/pagamentos
router.get('/pagamentos', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        id,
        nome,
        email,
        whatsapp,
        plano,
        metodo_pagamento AS metodo,
        status,
        data_inscricao AS data,
        observacoes
      FROM inscricoes
      WHERE status IN ('pendente', 'pago', 'confirmado', 'cancelado')
      ORDER BY data_inscricao DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error('Erro ao listar pagamentos:', err);
    res.status(500).json({ error: 'Erro ao carregar lista de pagamentos' });
  }
});

// PATCH /api/admin/pagamentos/:id/confirmar
router.patch('/pagamentos/:id/confirmar', async (req, res) => {
  const { id } = req.params;
  const { observacao } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: updated } = await client.query(
      `UPDATE inscricoes 
       SET status = 'pago', 
           observacoes = COALESCE(observacoes || '\n' || $1, $1)
       WHERE id = $2
       RETURNING *`,
      [observacao || 'Confirmado via painel admin', id]
    );

    if (!updated[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Inscrição não encontrada' });
    }

    await client.query('COMMIT');
    res.json({ success: true, inscricao: updated[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Erro ao confirmar pagamento' });
  } finally {
    client.release();
  }
});

// ========== NOVAS ROTAS SIMPLIFICADAS ==========

// GET /api/admin/alunos-completo - Lista alunos com dados básicos
router.get('/alunos-completo', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        u.id,
        u.nome,
        u.email,
        u.whatsapp,
        u.status,
        u.data_criacao,
        COALESCE((
          SELECT COUNT(*) 
          FROM progresso_aluno 
          WHERE usuario_id = u.id AND concluido = true
        ), 0) AS topicos_concluidos,
        (SELECT COUNT(*) FROM topicos) AS total_topicos,
        COALESCE((
          SELECT COUNT(DISTINCT t.modulo_id)
          FROM progresso_aluno pa
          JOIN topicos t ON t.id = pa.topico_id
          WHERE pa.usuario_id = u.id AND pa.concluido = true
        ), 0) AS modulos_completos,
        COALESCE((
          SELECT COUNT(*) 
          FROM conquistas_usuario 
          WHERE usuario_id = u.id
        ), 0) AS conquistas,
        (
          SELECT MAX(data_conclusao)
          FROM progresso_aluno 
          WHERE usuario_id = u.id AND concluido = true
        ) AS ultima_atividade
      FROM usuarios u
      WHERE u.tipo = 'aluno'
      ORDER BY u.data_criacao DESC
    `);

    // Calcular percentual de progresso
    const alunosComProgresso = rows.map(aluno => {
      const topicosConcluidos = parseInt(aluno.topicos_concluidos) || 0;
      const totalTopicos = parseInt(aluno.total_topicos) || 1;
      
      return {
        id: aluno.id,
        nome: aluno.nome,
        email: aluno.email,
        whatsapp: aluno.whatsapp,
        status: aluno.status,
        data_criacao: aluno.data_criacao,
        topicos_concluidos: topicosConcluidos,
        total_topicos: totalTopicos,
        modulos_completos: parseInt(aluno.modulos_completos) || 0,
        conquistas: parseInt(aluno.conquistas) || 0,
        ultima_atividade: aluno.ultima_atividade,
        progresso_percentual: Math.round((topicosConcluidos / totalTopicos) * 100),
        streak: 0,
        media_diaria: 0,
        tempo_medio: 0,
        ranking: 0
      };
    });

    // Calcular ranking
    const alunosOrdenados = [...alunosComProgresso].sort((a, b) => 
      b.progresso_percentual - a.progresso_percentual
    );
    
    const alunosComRanking = alunosOrdenados.map((aluno, index) => ({
      ...aluno,
      ranking: index + 1
    }));

    res.json(alunosComRanking);
  } catch (err) {
    console.error('Erro ao listar alunos completos:', err);
    res.status(500).json({ error: 'Erro ao listar alunos.' });
  }
});

// GET /api/admin/estatisticas-globais - Estatísticas básicas
router.get('/estatisticas-globais', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        COUNT(DISTINCT u.id) as total_alunos,
        COUNT(DISTINCT u.id) FILTER (WHERE u.status = 'ativo') as alunos_ativos,
        COALESCE(SUM(
          (SELECT COUNT(*) FROM progresso_aluno WHERE usuario_id = u.id AND concluido = true)
        ), 0) as total_topicos
      FROM usuarios u
      WHERE u.tipo = 'aluno'
    `);

    const totalAlunos = parseInt(rows[0].total_alunos) || 0;
    const alunosAtivos = parseInt(rows[0].alunos_ativos) || 0;
    const totalTopicos = parseInt(rows[0].total_topicos) || 0;

    res.json({
      totalAlunos: totalAlunos,
      alunosAtivos: alunosAtivos,
      totalTopicos: totalTopicos,
      mediaTurma: totalAlunos > 0 ? Math.round((alunosAtivos / totalAlunos) * 100) : 0,
      engajamento: totalAlunos > 0 ? Math.round((alunosAtivos / totalAlunos) * 100) : 0,
      taxaAtivos: totalAlunos > 0 ? Math.round((alunosAtivos / totalAlunos) * 100) : 0
    });
    
  } catch (err) {
    console.error('Erro estatísticas:', err);
    res.json({
      totalAlunos: 0,
      alunosAtivos: 0,
      totalTopicos: 0,
      mediaTurma: 0,
      engajamento: 0,
      taxaAtivos: 0
    });
  }
});

// GET /api/admin/alunos/:id/detalhes - Detalhes de um aluno (simplificado)
router.get('/alunos/:id/detalhes', async (req, res) => {
  try {
    // ── 1. Query principal do aluno ──────────────────────────────────────────
    const { rows } = await pool.query(`
      SELECT 
        u.id,
        u.nome,
        u.email,
        u.whatsapp,
        u.status,
        u.data_criacao,
        COALESCE((
          SELECT COUNT(*) 
          FROM progresso_aluno 
          WHERE usuario_id = u.id AND concluido = true
        ), 0) AS topicos_concluidos,
        (SELECT COUNT(*) FROM topicos) AS total_topicos,
        COALESCE((
          SELECT COUNT(*) 
          FROM conquistas_usuario 
          WHERE usuario_id = u.id
        ), 0) AS conquistas
      FROM usuarios u
      WHERE u.id = $1 AND u.tipo = 'aluno'
    `, [req.params.id]);

    if (!rows[0]) {
      return res.status(404).json({ error: 'Aluno não encontrado' });
    }

    // ── 2. Query separada: módulos + tópicos ─────────────────────────────────
    // Separar evita o json_agg aninhado com ORDER BY que falha em certas
    // versões do PostgreSQL quando usado dentro de subquery correlacionada.
    const { rows: modulos } = await pool.query(`
      SELECT 
        m.id,
        m.nome,
        m.icone,
        m.ordem,
        json_agg(
          json_build_object(
            'id',        t.id,
            'titulo',    t.titulo,
            'concluido', COALESCE(pa.concluido, false)
          ) ORDER BY t.ordem
        ) AS topicos
      FROM modulos m
      JOIN topicos t ON t.modulo_id = m.id
      LEFT JOIN progresso_aluno pa 
        ON pa.topico_id = t.id 
       AND pa.usuario_id = $1
      WHERE m.ativo = true
      GROUP BY m.id, m.nome, m.icone, m.ordem
      ORDER BY m.ordem
    `, [req.params.id]);

    // ── 3. Query separada: conquistas ────────────────────────────────────────
    const { rows: conquistasLista } = await pool.query(`
      SELECT 
        c.nome,
        c.icone,
        cu.data_obtencao AS data
      FROM conquistas_usuario cu
      JOIN conquistas c ON c.id = cu.conquista_id
      WHERE cu.usuario_id = $1
      ORDER BY cu.data_obtencao DESC
    `, [req.params.id]);

    // ── 4. Montar resposta ───────────────────────────────────────────────────
    const aluno            = rows[0];
    const topicosConcluidos = parseInt(aluno.topicos_concluidos) || 0;
    const totalTopicos      = parseInt(aluno.total_topicos) || 1;

    res.json({
      ...aluno,
      topicos_concluidos: topicosConcluidos,
      total_topicos:      totalTopicos,
      conquistas:         parseInt(aluno.conquistas) || 0,
      modulos:            modulos,
      conquistas_lista:   conquistasLista,
      progresso_geral:    Math.round((topicosConcluidos / totalTopicos) * 100),
    });

  } catch (err) {
    // Log detalhado para diagnóstico futuro
    console.error('ERRO DETALHADO /alunos/:id/detalhes:', {
      message: err.message,
      detail:  err.detail,
      code:    err.code,
      hint:    err.hint,
      where:   err.where,
    });
    res.status(500).json({
      error:   'Erro ao carregar detalhes do aluno',
      message: err.message,
      detail:  err.detail,
      hint:    err.hint,
    });
  }
});

// PATCH /api/admin/alunos/:id/status - Alterar status do aluno
router.patch('/alunos/:id/status', async (req, res) => {
  const { status } = req.body;
  
  if (!['ativo', 'inativo', 'pendente'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE usuarios 
       SET status = $1
       WHERE id = $2 AND tipo = 'aluno'
       RETURNING id, nome, email, status`,
      [status, req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Aluno não encontrado' });
    }

    res.json({ 
      success: true, 
      aluno: rows[0],
      message: `Aluno ${status === 'ativo' ? 'ativado' : 'desativado'} com sucesso`
    });
  } catch (err) {
    console.error('Erro ao alterar status:', err);
    res.status(500).json({ error: 'Erro ao alterar status do aluno' });
  }
});

// GET /api/admin/ranking - Ranking simplificado
router.get('/ranking', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        u.id,
        u.nome,
        COUNT(pa.id) as topicos,
        ROW_NUMBER() OVER (ORDER BY COUNT(pa.id) DESC) as posicao
      FROM usuarios u
      LEFT JOIN progresso_aluno pa ON pa.usuario_id = u.id AND pa.concluido = true
      WHERE u.tipo = 'aluno' AND u.status = 'ativo'
      GROUP BY u.id
      ORDER BY topicos DESC
      LIMIT 20
    `);

    res.json(rows);
  } catch (err) {
    console.error('Erro ao carregar ranking:', err);
    res.status(500).json({ error: 'Erro ao carregar ranking' });
  }
});

module.exports = router;