// ============================================================
// 🪶 Rota carrinho — cada cliente logado tem seu carrinho
// GET    /api/carrinho            → itens do carrinho
// POST   /api/carrinho            → { produtoId, quantidade } add
// PUT    /api/carrinho/:itemId    → { quantidade } alterar
// DELETE /api/carrinho/:itemId    → remover item
// DELETE /api/carrinho            → esvaziar
// ============================================================
const router = require('express').Router();
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');

router.use(requireAuth);

// busca ou cria o carrinho do cliente
function carrinhoDoCliente(clienteId) {
  let c = db
    .prepare('SELECT id FROM carrinhos WHERE cliente_id = ? ORDER BY id DESC LIMIT 1')
    .get(clienteId);
  if (!c) {
    const info = db.prepare('INSERT INTO carrinhos (cliente_id) VALUES (?)').run(clienteId);
    c = { id: info.lastInsertRowid };
  }
  return c.id;
}

function totalDoCarrinho(carrinhoId) {
  return db
    .prepare(`
      SELECT SUM(ci.quantidade * p.preco) AS total
      FROM carrinho_itens ci JOIN produtos p ON p.id = ci.produto_id
      WHERE ci.carrinho_id = ?
    `)
    .get(carrinhoId).total ?? 0;
}

router.get('/', (req, res) => {
  const id = carrinhoDoCliente(req.cliente.id);
  const itens = db
    .prepare(`
      SELECT ci.id, ci.quantidade, p.id AS produtoId, p.codigo, p.nome, p.preco
      FROM carrinho_itens ci JOIN produtos p ON p.id = ci.produto_id
      WHERE ci.carrinho_id = ?
      ORDER BY ci.id
    `)
    .all(id);
  res.json({ itens, total: totalDoCarrinho(id) });
});

// adicionar (soma se o produto já está no carrinho)
router.post('/', (req, res) => {
  const produtoId = Number(req.body?.produtoId);
  const quantidade = Math.max(1, Number(req.body?.quantidade) || 1);

  const produto = db
    .prepare('SELECT id FROM produtos WHERE id = ? AND ativo = 1')
    .get(produtoId);
  if (!produto) return res.status(404).json({ erro: 'Produto não encontrado.' });

  const carrinhoId = carrinhoDoCliente(req.cliente.id);
  db.prepare(`
    INSERT INTO carrinho_itens (carrinho_id, produto_id, quantidade)
    VALUES (?, ?, ?)
    ON CONFLICT(carrinho_id, produto_id)
    DO UPDATE SET quantidade = quantidade + excluded.quantidade
  `).run(carrinhoId, produtoId, quantidade);

  db.prepare("UPDATE carrinhos SET atualizado_em = datetime('now') WHERE id = ?").run(carrinhoId);
  res.status(201).json({ ok: true, total: totalDoCarrinho(carrinhoId) });
});

// alterar quantidade
router.put('/:itemId', (req, res) => {
  const quantidade = Number(req.body?.quantidade);
  if (!Number.isInteger(quantidade) || quantidade < 1) {
    return res.status(400).json({ erro: 'Quantidade inválida.' });
  }

  const item = db
    .prepare(`
      SELECT ci.id FROM carrinho_itens ci
      JOIN carrinhos c ON c.id = ci.carrinho_id
      WHERE ci.id = ? AND c.cliente_id = ?
    `)
    .get(req.params.itemId, req.cliente.id);
  if (!item) return res.status(404).json({ erro: 'Item não está no seu carrinho.' });

  db.prepare('UPDATE carrinho_itens SET quantidade = ? WHERE id = ?').run(quantidade, item.id);
  res.json({ ok: true });
});

// remover item
router.delete('/:itemId', (req, res) => {
  const info = db
    .prepare(`
      DELETE FROM carrinho_itens WHERE id = ?
        AND carrinho_id IN (SELECT id FROM carrinhos WHERE cliente_id = ?)
    `)
    .run(req.params.itemId, req.cliente.id);
  if (!info.changes) return res.status(404).json({ erro: 'Item não está no seu carrinho.' });
  res.json({ ok: true });
});

// esvaziar
router.delete('/', (req, res) => {
  db.prepare(`
    DELETE FROM carrinho_itens
    WHERE carrinho_id IN (SELECT id FROM carrinhos WHERE cliente_id = ?)
  `).run(req.cliente.id);
  res.json({ ok: true });
});

module.exports = router;
