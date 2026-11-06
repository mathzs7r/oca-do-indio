// ============================================================
// 🪶 Rotas pedidos e agendamento de retirada
// POST   /api/pedidos             → finaliza o carrinho (retirada logo)
// POST   /api/pedidos/agendar     → agenda pelo CÓDIGO do produto
//                                 { codigoProduto, quantidade, retiradaEm, observacao }
// GET    /api/pedidos/me          → meus pedidos
// GET    /api/pedidos/:codigo     → consultar um pedido pelo código
// ============================================================
const router = require('express').Router();
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { validarRetirada } = require('../config');
const { salvarBackupPedidos } = require('../backup');

router.use(requireAuth);

function novoCodigoPedido() {
  const ano = new Date().getFullYear();
  const n = db.prepare('SELECT COUNT(*) AS n FROM pedidos').get().n + 1;
  return `OC-${ano}-${String(n).padStart(4, '0')}`;
}

// cria o pedido + itens + log do status, dentro de uma transação
function finalizaPedido(clienteId, tipo, retiradaEm, observacao, itens, carrinhoId) {
  const codigo = novoCodigoPedido();
  const total = itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);

  const tx = db.transaction(() => {
    const info = db
      .prepare(`
        INSERT INTO pedidos (codigo, cliente_id, tipo, retirada_em, observacao, total)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(codigo, clienteId, tipo, retiradaEm, observacao, total);

    const insItem = db.prepare(`
      INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unitario)
      VALUES (?, ?, ?, ?)
    `);
    const insLog = db
      .prepare("INSERT INTO pedido_status_log (pedido_id, status) VALUES (?, 'aberto')");

    for (const i of itens) {
      insItem.run(info.lastInsertRowid, i.produto_id, i.quantidade, i.preco_unitario);
    }
    insLog.run(info.lastInsertRowid);

    if (carrinhoId) {
      db.prepare('DELETE FROM carrinho_itens WHERE carrinho_id = ?').run(carrinhoId);
    }

    return info.lastInsertRowid;
  });

  const pedidoId = tx();
  salvarBackupPedidos(); // backup automático a cada pedido novo (não derruba a resposta se falhar)
  return detalhesDoPedido(pedidoId);
}

// detalhes completos do pedido (para a tela de confirmação)
function detalhesDoPedido(pedidoId) {
  const pedido = db
    .prepare('SELECT codigo, tipo, status, retirada_em, observacao, total FROM pedidos WHERE id = ?')
    .get(pedidoId);
  pedido.itens = db
    .prepare(`
      SELECT pi.produto_id, pi.quantidade, pi.preco_unitario, pr.codigo, pr.nome
      FROM pedido_itens pi JOIN produtos pr ON pr.id = pi.produto_id
      WHERE pi.pedido_id = ?
      ORDER BY pi.id
    `)
    .all(pedidoId);
  return pedido;
}

// ---------- FINALIZAR O CARRINHO ----------
router.post('/', (req, res) => {
  const carrinho = db
    .prepare('SELECT id FROM carrinhos WHERE cliente_id = ? ORDER BY id DESC LIMIT 1')
    .get(req.cliente.id);

  const itens = carrinho
    ? db
        .prepare(`
          SELECT ci.produto_id, ci.quantidade, p.preco AS preco_unitario
          FROM carrinho_itens ci JOIN produtos p ON p.id = ci.produto_id
          WHERE ci.carrinho_id = ?
        `)
        .all(carrinho.id)
    : [];

  if (!itens.length) return res.status(400).json({ erro: 'Seu carrinho está vazio.' });

  const checa = validarRetirada(req.body?.retiradaEm);
  if (!checa.ok) return res.status(400).json({ erro: checa.motivo });

  const detalhes = finalizaPedido(
    req.cliente.id,
    'agendado',
    checa.retirada,
    req.body?.observacao ?? null,
    itens,
    carrinho.id
  );

  res.status(201).json(detalhes);
});

// ---------- AGENDAR PELO CÓDIGO DO PRODUTO ----------
router.post('/agendar', (req, res) => {
  const { codigoProduto, quantidade, retiradaEm, observacao } = req.body || {};
  const qtd = Math.max(1, Number(quantidade) || 1);

  if (!codigoProduto) {
    return res.status(400).json({ erro: 'Informe o código do produto (ex: SHA-01).' });
  }

  const checa = validarRetirada(retiradaEm);
  if (!checa.ok) return res.status(400).json({ erro: checa.motivo });

  const produto = db
    .prepare('SELECT id, preco FROM produtos WHERE codigo = ? COLLATE NOCASE AND ativo = 1')
    .get(String(codigoProduto).trim());
  if (!produto) return res.status(404).json({ erro: `Produto ${codigoProduto} não encontrado.` });

  const itens = [{ produto_id: produto.id, quantidade: qtd, preco_unitario: produto.preco }];
  const detalhes = finalizaPedido(req.cliente.id, 'agendado', checa.retirada, observacao ?? null, itens);

  res.status(201).json(detalhes);
});

// ---------- MEUS PEDIDOS ----------
router.get('/me', (req, res) => {
  const pedidos = db
    .prepare(`
      SELECT p.id, p.codigo, p.tipo, p.status, p.retirada_em, p.total, p.criado_em,
             (SELECT COUNT(*) FROM pedido_itens pi WHERE pi.pedido_id = p.id) AS itens
      FROM pedidos p
      WHERE p.cliente_id = ?
      ORDER BY p.id DESC
    `)
    .all(req.cliente.id);
  res.json(pedidos);
});

// ---------- CONSULTAR PELO CÓDIGO DO PEDIDO ----------
router.get('/:codigo', (req, res) => {
  const pedido = db
    .prepare(`
      SELECT p.*, c.nome AS cliente
      FROM pedidos p JOIN clientes c ON c.id = p.cliente_id
      WHERE p.codigo = ? COLLATE NOCASE AND p.cliente_id = ?
    `)
    .get(req.params.codigo, req.cliente.id);

  if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado.' });

  pedido.itens = db
    .prepare(`
      SELECT pi.produto_id, pi.quantidade, pi.preco_unitario, pr.codigo, pr.nome
      FROM pedido_itens pi JOIN produtos pr ON pr.id = pi.produto_id
      WHERE pi.pedido_id = ?
    `)
    .all(pedido.id);

  res.json(pedido);
});

module.exports = router;
