// Middleware do administrador — cookie asid + sessão em sessoes_admin
const db = require('../db');

module.exports = function requireAdmin(req, res, next) {
  const asid = req.cookies.asid;
  if (!asid) {
    return res.status(401).json({ erro: 'Acesso restrito.' });
  }

  const sessao = db
    .prepare(`
      SELECT s.token, a.id AS admin_id, a.usuario
      FROM sessoes_admin s
      JOIN admins a ON a.id = s.admin_id
      WHERE s.token = ? AND s.expira_em > datetime('now')
    `)
    .get(asid);

  if (!sessao) {
    return res.status(401).json({ erro: 'Sessão expirada. Entre novamente.' });
  }

  // renova por mais 8 horas a cada uso
  db.prepare("UPDATE sessoes_admin SET expira_em = datetime('now', '+8 hours') WHERE token = ?").run(asid);

  req.admin = { id: sessao.admin_id, usuario: sessao.usuario };
  next();
};
