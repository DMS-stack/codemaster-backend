const express  = require('express');
const router   = express.Router();
const pool     = require('../db');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const auth     = require('../middleware/auth');

// POST /api/auth/login
router.post('/login',
  [
    body('email').isEmail().withMessage('Email inválido'),
    body('senha').notEmpty().withMessage('Senha obrigatória')
  ],
  async (req, res) => {
    const erros = validationResult(req);
    if (!erros.isEmpty()) return res.status(400).json({ error: erros.array()[0].msg });

    const { email, senha } = req.body;
    try {
      const { rows } = await pool.query('SELECT * FROM usuarios WHERE email=$1', [email]);
      const user = rows[0];

      if (!user) return res.status(401).json({ error: 'Credenciais inválidas.' });

      if (user.status === 'pendente') {
        return res.status(403).json({ error: 'Conta pendente. Aguarde confirmação do pagamento.' });
      }
      if (user.status === 'inativo') {
        return res.status(403).json({ error: 'Conta inativa. Contacte o suporte.' });
      }

      const senhaValida = await bcrypt.compare(senha, user.senha_hash);
      if (!senhaValida) return res.status(401).json({ error: 'Credenciais inválidas.' });

      const token = jwt.sign(
        { id: user.id, nome: user.nome, email: user.email, tipo: user.tipo },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      res.json({
        token,
        user: { id: user.id, nome: user.nome, email: user.email, tipo: user.tipo }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro no servidor.' });
    }
  }
);

// GET /api/auth/me — retorna dados do utilizador autenticado
router.get('/me', auth(), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, nome, email, tipo, status FROM usuarios WHERE id=$1',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Utilizador não encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

module.exports = router;
