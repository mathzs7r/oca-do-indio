// ============================================================
// 🪶 Rotas do administrador (acesso restrito)
// POST   /api/admin/login            → { usuario, senha }
// GET    /api/admin/me               → sessão atual
// POST   /api/admin/logout           → encerra a sessão
// GET    /api/admin/pedidos          → todos os pedidos
// PATCH  /api/admin/pedidos/:id/status → { status }
// ============================================================
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');
const requireAdmin = require('../middleware/requireAdmin');

const COOKIE_ADMIN = {
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 8 * 60 * 60 * 1000, // 8 horas
  secure: process.env.NODE_ENV === 'production',
};

// ---------- limite de tentativas de login (janela de 15 minutos) ----------
const JANELA_MS = 15 * 60 * 1000;
const MAX_TENTATIVAS = 5;
const falhas = new Map(); // ip -> [timestamps]

function ipDoCliente(req) {
  return req.ip || req.socket?.remoteAddress || 'desconhecido';
}

function limpezaDeFalhas() {
  const corte = Date.now() - JANELA_MS;
  for (const [ip, lista] of falhas) {
    const recentes = lista.filter((t) => t > corte);
    if (recentes.length) falhas.set(ip, recentes);
    else falhas.delete(ip);
  }
}

function acimaDoLimite(ip) {
  limpezaDeFalhas();
  return (falhas.get(ip) || []).length >= MAX_TENTATIVAS;
}

function registrarFalha(ip) {
  const lista = falhas.get(ip) || [];
  lista.push(Date.now());
  falhas.set(ip, lista);
}

const STATUS_VALIDOS = ['aberto', 'confirmado', 'pronto', 'retirado', 'cancelado'];

// ---------- LOGIN ----------
router.post('/login', (req, res) => {
  const ip = ipDoCliente(req);
  if (acimaDoLimite(ip)) {
    return res.status(429).json({ erro: 'Muitas tentativas. Tente novamente mais tarde.' });
  }

  const { usuario, senha } = req.body || {};

  const admin = db
    .prepare('SELECT * FROM admins WHERE usuario = ? COLLATE NOCASE')
    .get(String(usuario || '').trim());

  const valido =
    admin && bcrypt.compareSync(String(senha || ''), admin.senha_hash);

  // resposta genérica: não revela se o usuário existe
  if (!valido) {
    registrarFalha(ip);
    return res.status(401).json({ erro: 'Usuário ou senha incorretos.' });
  }

  falhas.delete(ip); // sucesso zera a contagem
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare("INSERT INTO sessoes_admin (token, admin_id, expira_em) VALUES (?, ?, datetime('now','+8 hours'))")
    .run(token, admin.id);

  res.cookie('asid', token, COOKIE_ADMIN);
  res.json({ admin: { id: admin.id, usuario: admin.usuario } });
});

// ---------- SESSÃO ATUAL ----------
router.get('/me', requireAdmin, (req, res) => {
  res.json({ admin: req.admin });
});

// ---------- LOGOUT ----------
router.post('/logout', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM sessoes_admin WHERE token = ?').run(req.cookies.asid);
  res.clearCookie('asid');
  res.json({ ok: true });
});

// protegido daqui para baixo
router.use(requireAdmin);

// ---------- LISTAR PEDIDOS ----------
router.get('/pedidos', (req, res) => {
  const status = req.query.status;
  let pedidos;

  if (status && STATUS_VALIDOS.includes(status)) {
    pedidos = db
      .prepare(`
        SELECT p.id, p.codigo, p.tipo, p.status, p.retirada_em, p.observacao, p.total,
               p.criado_em, c.nome AS cliente, c.telefone
        FROM pedidos p LEFT JOIN clientes c ON c.id = p.cliente_id
        WHERE p.status = ?
        ORDER BY p.retirada_em IS NULL, p.retirada_em, p.id DESC
      `)
      .all(status);
  } else {
    pedidos = db
      .prepare(`
        SELECT p.id, p.codigo, p.tipo, p.status, p.retirada_em, p.observacao, p.total,
               p.criado_em, c.nome AS cliente, c.telefone
        FROM pedidos p LEFT JOIN clientes c ON c.id = p.cliente_id
        ORDER BY p.status <> 'aberto', p.retirada_em IS NULL, p.retirada_em, p.id DESC
      `)
      .all();
  }

  const itens = db
    .prepare(`
      SELECT pi.pedido_id, pi.quantidade, pi.preco_unitario, pr.codigo, pr.nome
      FROM pedido_itens pi JOIN produtos pr ON pr.id = pi.produto_id
    `)
    .all();

  const porPedido = new Map();
  for (const i of itens) {
    if (!porPedido.has(i.pedido_id)) porPedido.set(i.pedido_id, []);
    porPedido.get(i.pedido_id).push({
      quantidade: i.quantidade,
      preco_unitario: i.preco_unitario,
      codigo: i.codigo,
      nome: i.nome,
    });
  }

  res.json(pedidos.map((p) => ({ ...p, itens: porPedido.get(p.id) || [] })));
});

// ---------- MUDAR STATUS ----------
router.patch('/pedidos/:id/status', (req, res) => {
  const status = String(req.body?.status || '');
  if (!STATUS_VALIDOS.includes(status)) {
    return res.status(400).json({ erro: 'Status inválido.' });
  }

  const pedido = db.prepare('SELECT id FROM pedidos WHERE id = ?').get(req.params.id);
  if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado.' });

  const tx = db.transaction(() => {
    db.prepare("UPDATE pedidos SET status = ?, atualizado_em = datetime('now') WHERE id = ?")
      .run(status, pedido.id);
    db.prepare('INSERT INTO pedido_status_log (pedido_id, status) VALUES (?, ?)')
      .run(pedido.id, status);
  });
  tx();

  res.json({ ok: true, status });
});

module.exports = router;
