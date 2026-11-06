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
const { validarRetirada, horariosDaFeira, validarFormaPagamento } = require('../config');
const { salvarBackupPedidos, gerarDadosBackup } = require('../backup');

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

// ---------- PRODUTOS (para o formulário de novo pedido) ----------
router.get('/produtos', (_req, res) => {
  const produtos = db
    .prepare(`
      SELECT p.id, p.codigo, p.nome, p.preco, c.nome AS categoria
      FROM produtos p JOIN categorias c ON c.id = p.categoria_id
      WHERE p.ativo = 1
      ORDER BY c.id, p.nome
    `)
    .all();
  res.json(produtos);
});

// ---------- HORÁRIOS DE RETIRADA DA FEIRA ----------
router.get('/horarios', (_req, res) => {
  res.json(horariosDaFeira());
});

// ---------- BACKUP EM JSON (todos os pedidos) ----------
router.get('/pedidos/backup', (_req, res) => {
  res.json(gerarDadosBackup());
});

// ---------- CADASTRAR PEDIDO MANUAL (só nome, sem cliente) ----------
router.post('/pedidos', (req, res) => {
  const { nome, retiradaEm, observacao, itens, formaPagamento } = req.body || {};

  const nomeFinal = String(nome || '').trim();
  if (!nomeFinal || nomeFinal.length > 80) {
    return res.status(400).json({ erro: 'Informe o nome (até 80 caracteres).' });
  }

  // retirada é opcional; se enviada, precisa ser um horário da feira
  let retirada = null;
  let tipo = 'carrinho';
  if (retiradaEm) {
    const checa = validarRetirada(retiradaEm);
    if (!checa.ok) return res.status(400).json({ erro: checa.motivo });
    retirada = checa.retirada;
    tipo = 'agendado';
  }

  const obsFinal = observacao ? String(observacao).trim().slice(0, 500) || null : null;

  const pagamento = validarFormaPagamento(formaPagamento);
  if (!pagamento.ok) return res.status(400).json({ erro: pagamento.motivo });

  if (!Array.isArray(itens) || !itens.length) {
    return res.status(400).json({ erro: 'Adicione pelo menos um produto.' });
  }

  // resolve produtos no banco, junta repetidos e congela o preço atual
  const resolvidos = new Map(); // produto_id -> { produto_id, quantidade, preco_unitario }
  for (const item of itens) {
    const produtoId = Number(item?.produtoId ?? item?.produto_id);
    const qtd = Number(item?.quantidade);
    if (!Number.isInteger(produtoId) || produtoId <= 0) {
      return res.status(400).json({ erro: 'Produto inválido.' });
    }
    if (!Number.isInteger(qtd) || qtd < 1 || qtd > 999) {
      return res.status(400).json({ erro: 'Quantidade de cada produto: de 1 a 999.' });
    }
    const produto = db
      .prepare('SELECT id, codigo, nome, preco FROM produtos WHERE id = ? AND ativo = 1')
      .get(produtoId);
    if (!produto) {
      return res.status(404).json({ erro: `Produto ${produtoId} não encontrado ou inativo.` });
    }
    const atual = resolvidos.get(produto.id) || {
      produto_id: produto.id, quantidade: 0, preco_unitario: produto.preco,
      codigo: produto.codigo, nome: produto.nome,
    };
    atual.quantidade += qtd;
    resolvidos.set(produto.id, atual);
  }

  const itensResolvidos = [...resolvidos.values()];
  const total = itensResolvidos.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);

  const ano = new Date().getFullYear();
  const n = db.prepare('SELECT COUNT(*) AS n FROM pedidos').get().n + 1;
  const codigo = `OC-${ano}-${String(n).padStart(4, '0')}`;

  const tx = db.transaction(() => {
    const info = db
      .prepare(`
        INSERT INTO pedidos (codigo, cliente_id, cliente_nome, tipo, retirada_em, observacao, forma_pagamento, total)
        VALUES (?, NULL, ?, ?, ?, ?, ?, ?)
      `)
      .run(codigo, nomeFinal, tipo, retirada, obsFinal, pagamento.forma, total);

    const insItem = db.prepare(`
      INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unitario)
      VALUES (?, ?, ?, ?)
    `);
    for (const i of itensResolvidos) {
      insItem.run(info.lastInsertRowid, i.produto_id, i.quantidade, i.preco_unitario);
    }
    db.prepare("INSERT INTO pedido_status_log (pedido_id, status) VALUES (?, 'aberto')")
      .run(info.lastInsertRowid);

    return info.lastInsertRowid;
  });

  const pedidoId = tx();
  salvarBackupPedidos(); // backup automático (não derruba a resposta se falhar)

  const pedidoCriado = db
    .prepare('SELECT id, codigo, tipo, status, retirada_em, observacao, forma_pagamento, total, criado_em, cliente_nome FROM pedidos WHERE id = ?')
    .get(pedidoId);

  res.status(201).json({
    ...pedidoCriado,
    itens: itensResolvidos.map((i) => ({
      produto_id: i.produto_id, quantidade: i.quantidade,
      preco_unitario: i.preco_unitario, codigo: i.codigo, nome: i.nome,
    })),
  });
});

// ---------- LISTAR PEDIDOS ----------
router.get('/pedidos', (req, res) => {
  const status = req.query.status;
  let pedidos;

  if (status && STATUS_VALIDOS.includes(status)) {
    pedidos = db
      .prepare(`
        SELECT p.id, p.codigo, p.tipo, p.status, p.retirada_em, p.observacao, p.forma_pagamento, p.total,
               p.criado_em, p.cliente_nome, c.nome AS cliente, c.telefone
        FROM pedidos p LEFT JOIN clientes c ON c.id = p.cliente_id
        WHERE p.status = ?
        ORDER BY p.retirada_em IS NULL, p.retirada_em, p.id DESC
      `)
      .all(status);
  } else {
    pedidos = db
      .prepare(`
        SELECT p.id, p.codigo, p.tipo, p.status, p.retirada_em, p.observacao, p.forma_pagamento, p.total,
               p.criado_em, p.cliente_nome, c.nome AS cliente, c.telefone
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
  salvarBackupPedidos(); // backup automático (não derruba a resposta se falhar)

  res.json({ ok: true, status });
});

module.exports = router;
