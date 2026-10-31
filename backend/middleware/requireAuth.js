// Middleware de autenticação — exige um cookie de sessão válido
const db = require('../db');

module.exports = function requireAuth(req, res, next) {
  const sid = req.cookies.sid;
  if (!sid) {
    return res.status(401).json({ erro: 'Faça login para continuar.' });
  }

  const sessao = db
    .prepare(`
      SELECT s.token, s.expira_em, c.id AS cliente_id, c.nome, c.telefone
      FROM sessoes s
      JOIN clientes c ON c.id = s.cliente_id
      WHERE s.token = ? AND s.expira_em > datetime('now')
    `)
    .get(sid);

  if (!sessao) {
    return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
  }

  // renova a sessão para mais 7 dias a cada uso
  db.prepare("UPDATE sessoes SET expira_em = datetime('now', '+7 days') WHERE token = ?").run(sid);

  req.cliente = {
    id: sessao.cliente_id,
    nome: sessao.nome,
    telefone: sessao.telefone,
  };
  next();
};
