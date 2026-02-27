const express  = require('express');
const router   = express.Router();
const pool     = require('../db');
const { body, validationResult } = require('express-validator');

// Lê dados de pagamento do .env (nunca hardcoded)
const getDadosPagamento = () => ({
  transferencia: {
    banco:   process.env.BANK_NAME           || '[ Configurar no .env ]',
    titular: process.env.BANK_ACCOUNT_NAME   || '[ Configurar no .env ]',
    conta:   process.env.BANK_ACCOUNT_NUMBER || '[ Configurar no .env ]',
    iban:    process.env.BANK_IBAN           || '[ Configurar no .env ]',
  },
  multicaixa: {
    telefone: process.env.MULTICAIXA_PHONE || '[ Configurar no .env ]',
    nome:     process.env.MULTICAIXA_NAME  || '[ Configurar no .env ]',
  },
  whatsapp: process.env.WHATSAPP_NUMBER || '244943526836'
});

// POST /api/inscricoes — Formulário público da landing page
router.post('/',
  [
    body('nome').trim().notEmpty().withMessage('Nome é obrigatório'),
    body('email').isEmail().withMessage('Email inválido'),
    body('whatsapp').trim().notEmpty().withMessage('WhatsApp é obrigatório'),
    body('plano').notEmpty().withMessage('Plano é obrigatório'),
    body('metodoPagamento')
      .isIn(['transferencia','multicaixa'])
      .withMessage('Método de pagamento inválido'),
  ],
  async (req, res) => {
    const erros = validationResult(req);
    if (!erros.isEmpty()) return res.status(400).json({ error: erros.array()[0].msg });

    const { nome, email, whatsapp, plano, situacaoAtual, metodoPagamento } = req.body;

    try {
      const { rows } = await pool.query(
        `INSERT INTO inscricoes (nome, email, whatsapp, plano, situacao_atual, metodo_pagamento, status)
         VALUES ($1,$2,$3,$4,$5,$6,'pendente') RETURNING id`,
        [nome, email, whatsapp, plano, situacaoAtual || null, metodoPagamento]
      );

      const inscricaoId = rows[0].id; // UUID
      const dadosPag    = getDadosPagamento();
      const refCurta    = inscricaoId.split('-')[0].toUpperCase(); // ex: A1B2C3D4
      const valor       = plano.toLowerCase().includes('completo') ? '18.000 Kz' : '10.000 Kz';
      const metodoTexto = metodoPagamento === 'transferencia' ? 'Transferência Bancária' : 'Multicaixa Express';

      const msg = encodeURIComponent(
        `Olá! Acabei de me inscrever no curso Dev Pro.\n\n` +
        `👤 Nome: ${nome}\n` +
        `📧 Email: ${email}\n` +
        `📱 WhatsApp: ${whatsapp}\n` +
        `📦 Plano: ${plano}\n` +
        `💳 Pagamento: ${metodoTexto}\n` +
        `💰 Valor: ${valor}\n` +
        `🔑 Referência: INS-${refCurta}\n\n` +
        `Segue em anexo o comprovativo.`
      );

      res.status(201).json({
        success:        true,
        inscricaoId,
        referencia:     `INS-${refCurta}`,
        whatsappLink:   `https://wa.me/${dadosPag.whatsapp}?text=${msg}`,
        dadosPagamento: dadosPag[metodoPagamento],
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao guardar inscrição.' });
    }
  }
);

// GET /api/inscricoes — Lista (só admin, protegido no admin router)
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM inscricoes ORDER BY data_inscricao DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar inscrições.' });
  }
});

module.exports = router;
