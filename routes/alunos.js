const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const auth    = require('../middleware/auth');
const conquistasService = require('../services/conquistasService');

// GET /api/alunos/progresso — progresso do aluno autenticado
router.get('/progresso', auth(['aluno','professor','admin']), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        m.id   AS modulo_id,
        m.nome AS modulo_nome,
        m.icone,
        m.ordem AS modulo_ordem,
        t.id    AS topico_id,
        t.titulo,
        t.ordem AS topico_ordem,
        COALESCE(pa.concluido, false) AS concluido,
        pa.data_conclusao
      FROM modulos m
      JOIN topicos t ON t.modulo_id = m.id
      LEFT JOIN progresso_aluno pa
             ON pa.topico_id = t.id
            AND pa.usuario_id = $1
      WHERE m.ativo = true
      ORDER BY m.ordem, t.ordem
    `, [req.user.id]);

    // Agrupar por módulo
    const map = new Map();
    rows.forEach(r => {
      if (!map.has(r.modulo_id)) {
        map.set(r.modulo_id, {
          id: r.modulo_id, nome: r.modulo_nome, icone: r.icone, topicos: []
        });
      }
      map.get(r.modulo_id).topicos.push({
        id:             r.topico_id,
        titulo:         r.titulo,
        concluido:      r.concluido,
        data_conclusao: r.data_conclusao
      });
    });

    const modulos = Array.from(map.values()).map(m => ({
      ...m,
      total:     m.topicos.length,
      concluidos: m.topicos.filter(t => t.concluido).length,
      pct: m.topicos.length
        ? Math.round(m.topicos.filter(t => t.concluido).length / m.topicos.length * 100)
        : 0
    }));

    res.json(modulos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar progresso.' });
  }
});

// POST /api/alunos/progresso - marcar/desmarcar tópico (ATUALIZADO)
router.post('/progresso', auth(['aluno']), async (req, res) => {
  const { topicoId, concluido } = req.body;
  
  try {
    await pool.query(`
      INSERT INTO progresso_aluno (usuario_id, topico_id, concluido, data_conclusao)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (usuario_id, topico_id)
      DO UPDATE SET concluido=$3, data_conclusao=$4
    `, [req.user.id, topicoId, concluido, concluido ? new Date() : null]);
    
    // 🔥 VERIFICAR CONQUISTAS!
    if (concluido) {
      const novasConquistas = await conquistasService.verificarConquistas(
        req.user.id, 
        'topico_concluido'
      );
      
      // Marcar as novas conquistas como vistas após enviar ao front
      // (evita que apareçam novamente no próximo carregamento)
      if (novasConquistas.length > 0) {
        const ids = novasConquistas.map(c => c.id);
        conquistasService.marcarConquistasVistas(req.user.id, ids).catch(() => {});
      }

      res.json({ 
        success: true,
        novasConquistas 
      });
    } else {
      res.json({ success: true });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao actualizar progresso.' });
  }
});

// GET /api/alunos/dashboard — dashboard do aluno autenticado
router.get('/dashboard', auth(['aluno','professor','admin']), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        m.id   AS modulo_id,
        m.nome AS modulo_nome,
        m.icone,
        m.ordem AS modulo_ordem,
        t.id    AS topico_id,
        t.titulo,
        t.ordem AS topico_ordem,
        COALESCE(pa.concluido, false) AS concluido,
        pa.data_conclusao
      FROM modulos m
      JOIN topicos t ON t.modulo_id = m.id
      LEFT JOIN progresso_aluno pa
             ON pa.topico_id = t.id
            AND pa.usuario_id = $1
      WHERE m.ativo = true
      ORDER BY m.ordem, t.ordem
    `, [req.user.id]);

    // Calcula progresso geral
    const totalTopicos = rows.length;
    const topicosConcluidos = rows.filter(r => r.concluido).length;
    const progressoGeral = totalTopicos > 0 
      ? Math.round((topicosConcluidos / totalTopicos) * 100) 
      : 0;

    // Agrupa por módulo
    const map = new Map();
    rows.forEach(r => {
      if (!map.has(r.modulo_id)) {
        map.set(r.modulo_id, {
          id: r.modulo_id,
          nome: r.modulo_nome,
          icone: r.icone,
          topicos: []
        });
      }
      map.get(r.modulo_id).topicos.push({
        id: r.topico_id,
        titulo: r.titulo,
        concluido: r.concluido,
        data_conclusao: r.data_conclusao
      });
    });

    const modulos = Array.from(map.values()).map(m => ({
      ...m,
      total: m.topicos.length,
      concluidos: m.topicos.filter(t => t.concluido).length,
      pct: m.topicos.length
        ? Math.round((m.topicos.filter(t => t.concluido).length / m.topicos.length) * 100)
        : 0
    }));

    res.json({
      progresso_geral: progressoGeral,
      modulos: modulos
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao carregar dashboard.' });
  }
});

// GET /api/alunos/estatisticas
router.get('/estatisticas', auth(['aluno']), async (req, res) => {
  try {
    const userId = req.user.id;

    // Tópicos concluídos por dia (últimos 30 dias)
    const { rows: atividadeDiaria } = await pool.query(`
      SELECT DATE(data_conclusao) as dia, COUNT(*) as total
      FROM progresso_aluno
      WHERE usuario_id = $1
        AND concluido = true
        AND data_conclusao >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(data_conclusao)
      ORDER BY dia DESC
    `, [userId]);

    const diasAtivos    = atividadeDiaria.length;
    const totalTopicos  = atividadeDiaria.reduce((s, r) => s + parseInt(r.total), 0);
    const mediaDiaria   = diasAtivos > 0 ? Math.round((totalTopicos / diasAtivos) * 10) / 10 : 0;

    // Streak actual (dias consecutivos até hoje ou ontem)
    // A query anterior falhava se não houvesse actividade hoje (subquery retornava NULL)
    const { rows: streakRows } = await pool.query(`
      WITH dias AS (
        SELECT DISTINCT DATE(data_conclusao) as dia
        FROM progresso_aluno
        WHERE usuario_id = $1 AND concluido = true AND data_conclusao IS NOT NULL
      ),
      numerados AS (
        SELECT dia, ROW_NUMBER() OVER (ORDER BY dia DESC)::integer as rn
        FROM dias
        ORDER BY dia DESC
      ),
      referencia AS (
        -- Aceita streak a partir de hoje OU de ontem (não perde streak se ainda não estudou hoje)
        SELECT dia FROM numerados WHERE rn = 1
          AND dia >= CURRENT_DATE - 1
      )
      SELECT COUNT(*) as streak
      FROM numerados
      WHERE EXISTS (SELECT 1 FROM referencia)
        AND dia = (SELECT dia FROM referencia) - (rn - 1)
    `, [userId]);

    const streakAtual = parseInt(streakRows[0]?.streak || 0);

    // Ranking do aluno (por tópicos concluídos)
    const { rows: rankingRows } = await pool.query(`
      SELECT posicao FROM (
        SELECT 
          usuario_id,
          ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) as posicao
        FROM progresso_aluno
        WHERE concluido = true
        GROUP BY usuario_id
      ) ranked
      WHERE usuario_id = $1
    `, [userId]);

    const posicaoRanking = rankingRows[0]?.posicao || '-';

    // Tempo médio entre tópicos (dias)
    const { rows: tempoRows } = await pool.query(`
      SELECT 
        CASE 
          WHEN COUNT(*) > 1 
          THEN ROUND(
            EXTRACT(EPOCH FROM (MAX(data_conclusao) - MIN(data_conclusao))) 
            / 86400 / NULLIF(COUNT(*) - 1, 0)
          )
          ELSE 0 
        END as tempo_medio
      FROM progresso_aluno
      WHERE usuario_id = $1 AND concluido = true AND data_conclusao IS NOT NULL
    `, [userId]);

    const tempoMedio = parseInt(tempoRows[0]?.tempo_medio || 0);

    // Pontuação e nível (via conquistas)
    let pontuacaoTotal = 0;
    try {
      const conquistasService = require('../services/conquistasService');
      pontuacaoTotal = await conquistasService.calcularPontuacaoTotal(userId);
    } catch (_) { /* serviço opcional */ }

    const nivel = Math.floor(pontuacaoTotal / 100) + 1;

    // Frase motivacional baseada no progresso
    const frases = [
      'Cada linha de código te aproxima do teu objectivo. Continue!',
      'Consistência é mais importante que velocidade. Segue em frente!',
      'Os melhores programadores foram um dia iniciantes. Estás no caminho certo.',
      'Cada tópico concluído é uma vitória. Celebra o progresso!',
      'O único mau dia é aquele em que não aprendeste nada. Hoje aprendeste!',
    ];
    const fraseMotivacional = frases[Math.floor(Math.random() * frases.length)];

    res.json({
      mediaDiaria,
      tempoMedio,
      diasAtivos,
      posicaoRanking,
      streakAtual,
      pontuacaoTotal,
      nivel,
      fraseMotivacional,
    });

  } catch (err) {
    console.error('Erro em /estatisticas:', err);
    res.status(500).json({ error: 'Erro ao carregar estatísticas.' });
  }
});

// GET /api/alunos/proximos-topicos
router.get('/proximos-topicos', auth(['aluno']), async (req, res) => {
  try {
    const userId = req.user.id;

    // Busca até 5 tópicos ainda não concluídos, na ordem do curso
    const { rows } = await pool.query(`
      SELECT
        t.id,
        t.titulo,
        t.ordem,
        m.id   AS modulo_id,
        m.nome AS modulo_nome,
        m.icone
      FROM modulos m
      JOIN topicos t ON t.modulo_id = m.id
      LEFT JOIN progresso_aluno pa
             ON pa.topico_id = t.id AND pa.usuario_id = $1
      WHERE m.ativo = true
        AND (pa.concluido IS NULL OR pa.concluido = false)
      ORDER BY m.ordem, t.ordem
      LIMIT 5
    `, [userId]);

    res.json(rows);

  } catch (err) {
    console.error('Erro em /proximos-topicos:', err);
    res.status(500).json({ error: 'Erro ao carregar próximos tópicos.' });
  }
});

module.exports = router;