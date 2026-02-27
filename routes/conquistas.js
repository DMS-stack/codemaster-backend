// routes/conquistas.js
const express = require('express');
const router = express.Router();
const conquistasService = require('../services/conquistasService');
const auth = require('../middleware/auth');

// GET /api/conquistas/minhas - Minhas conquistas
router.get('/minhas', auth(['aluno', 'professor', 'admin']), async (req, res) => {
  try {
    const conquistas = await conquistasService.buscarConquistasUsuario(req.user.id);
    const pontuacaoTotal = await conquistasService.calcularPontuacaoTotal(req.user.id);
    
    res.json({
      conquistas,
      pontuacaoTotal,
      nivel: Math.floor(pontuacaoTotal / 100) + 1 // Nível baseado em pontos
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar conquistas' });
  }
});

// GET /api/conquistas/novas - Conquistas não vistas
router.get('/novas', auth(['aluno']), async (req, res) => {
  try {
    const novas = await conquistasService.buscarConquistasNovas(req.user.id);
    res.json(novas);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar novas conquistas' });
  }
});

// POST /api/conquistas/vistas - Marcar conquistas como vistas
router.post('/vistas', auth(['aluno']), async (req, res) => {
  try {
    const { conquistaIds } = req.body;
    await conquistasService.marcarConquistasVistas(req.user.id, conquistaIds);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao marcar conquistas' });
  }
});

module.exports = router;