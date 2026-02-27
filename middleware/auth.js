const jwt = require('jsonwebtoken');

// auth()           → qualquer utilizador autenticado
// auth(['admin'])  → só admins
const auth = (roles = []) => (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido.' });
  }

  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    req.user = decoded;

    if (roles.length && !roles.includes(decoded.tipo)) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
};

module.exports = auth;
