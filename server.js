require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const app     = express();

// ─── MIDDLEWARES ──────────────────────────────────────────
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Log simples sem morgan
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ─── ROTAS ────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/inscricoes',require('./routes/inscricoes'));
app.use('/api/alunos',    require('./routes/alunos'));
app.use('/api/admin',     require('./routes/admin'));
app.use('/api/pagamento', require('./routes/pagamento'));
app.use('/api/conquistas', require('./routes/conquistas'));

// ─── HEALTH CHECK ─────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'CodeMaster API', version: '1.0.0' });
});

// ─── ERRO GLOBAL ──────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('❌ Erro:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Erro interno.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 CodeMaster API → http://localhost:${PORT}`);
});
