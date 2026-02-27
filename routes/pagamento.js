const express = require('express');
const router  = express.Router();

// GET /api/pagamento/info — retorna dados bancários do .env (sem auth, aluno precisa ver)
router.get('/info', (_req, res) => {
  res.json({
    transferencia: {
      banco:   process.env.BANK_NAME           || '[ Configurar BANK_NAME no .env ]',
      titular: process.env.BANK_ACCOUNT_NAME   || '[ Configurar BANK_ACCOUNT_NAME no .env ]',
      conta:   process.env.BANK_ACCOUNT_NUMBER || '[ Configurar BANK_ACCOUNT_NUMBER no .env ]',
      iban:    process.env.BANK_IBAN           || '[ Configurar BANK_IBAN no .env ]',
    },
    multicaixa: {
      telefone: process.env.MULTICAIXA_PHONE || '[ Configurar MULTICAIXA_PHONE no .env ]',
      nome:     process.env.MULTICAIXA_NAME  || '[ Configurar MULTICAIXA_NAME no .env ]',
    },
    whatsapp: process.env.WHATSAPP_NUMBER || '244943526836',
    precos: {
      modulo:        10000,
      cursoCompleto: 18000,
      moeda:         'Kz'
    }
  });
});

module.exports = router;
