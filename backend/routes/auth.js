// ============================================================
// 🪶 Rota autenticação (login, cadastro, logout, quem sou eu)
// ============================================================
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');

const COOKIE = {
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
  secure: process.env.NODE_ENV === 'production',
};

function limpaTelefone(tel) {
  // mantém só dígitos: (42) 99999-9999 -> 42999999999
  return String(tel || '').replace(/\D/g, '');
}

// ---------- CADASTRO ----------
router.post('/register', (req, res) => {
  const { nome, telefone, senha } = req.body || {};

  if (!nome || String(nome).trim().length < 3) {
    return res.status(400).json({ erro: 'Informe seu nome completo (mín. 3 letras).' });
  }
  const tel = limpaTelefone(telefone);
  if (tel.length < 10 || tel.length > 13) {
    return res.status(400).json({ erro: 'Informe um telefone válido, ex: (42) 99999-9999.' });
  }
  if (!senha || String(senha).length < 6) {
    return res.status(400).json({ erro: 'A senha precisa ter no mínimo 6 caracteres.' });
  }

  const existe = db.prepare('SELECT 1 FROM clientes WHERE telefone = ?').get(tel);
  if (existe) {
    return res.status(409).json({ erro: 'Este telefone já está cadastrado. Faça login.' });
  }

  // encerra sessão anterior do navegador (para quem troca de conta na hora do cadastro)
  const sidAntigo = req.cookies.sid;
  if (sidAntigo) db.prepare('DELETE FROM sessoes WHERE token = ?').run(sidAntigo);

  const hash = bcrypt.hashSync(String(senha), 10);
  db
    .prepare('INSERT INTO clientes (nome, telefone, senha_hash) VALUES (?, ?, ?)')
    .run(String(nome).trim(), tel, hash);

  // cadastro NÃO loga: o cliente é levado para a tela de login
  if (sidAntigo) res.clearCookie('sid');
  res.status(201).json({ criado: true, cliente: { nome: String(nome).trim(), telefone: tel } });
});

// ---------- LOGIN ----------
router.post('/login', (req, res) => {
  const { telefone, senha } = req.body || {};
  const tel = limpaTelefone(telefone);

  const cliente = db.prepare('SELECT * FROM clientes WHERE telefone = ?').get(tel);
  if (!cliente || !cliente.senha_hash || !bcrypt.compareSync(String(senha || ''), cliente.senha_hash)) {
    return res.status(401).json({ erro: 'Telefone ou senha incorretos.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  db.prepare("INSERT INTO sessoes (token, cliente_id, expira_em) VALUES (?, ?, datetime('now','+7 days'))")
    .run(token, cliente.id);

  res.cookie('sid', token, COOKIE);
  res.json({ cliente: { id: cliente.id, nome: cliente.nome, telefone: cliente.telefone } });
});

// ---------- QUEM SOU EU (usado pra proteger as páginas) ----------
router.get('/me', (req, res) => {
  const sid = req.cookies.sid;
  if (!sid) {
    return res.status(401).json({ logado: false });
  }
  const linha = db
    .prepare(`
      SELECT c.id, c.nome, c.telefone
      FROM sessoes s JOIN clientes c ON c.id = s.cliente_id
      WHERE s.token = ? AND s.expira_em > datetime('now')
    `)
    .get(sid);
  if (!linha) return res.status(401).json({ logado: false });
  res.json({ logado: true, cliente: linha });
});

// ---------- LOGOUT ----------
router.post('/logout', (req, res) => {
  const sid = req.cookies.sid;
  if (sid) db.prepare('DELETE FROM sessoes WHERE token = ?').run(sid);
  res.clearCookie('sid');
  res.json({ ok: true });
});

module.exports = router;
