// ============================================================
// 🪶 Rota cardápio — produtos (exige estar logado)
// GET /api/produtos            → lista todos os à venda
// GET /api/produtos/:codigo    → busca por código (SHA-01...)
// ============================================================
const router = require('express').Router();
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');

router.use(requireAuth);

router.get('/', (_req, res) => {
  const produtos = db
    .prepare(`
      SELECT p.*, c.nome AS categoria
      FROM produtos p JOIN categorias c ON c.id = p.categoria_id
      WHERE p.ativo = 1
      ORDER BY c.id, p.nome
    `)
    .all();
  res.json(produtos);
});

router.get('/:codigo', (req, res) => {
  const produto = db
    .prepare('SELECT * FROM produtos WHERE codigo = ? COLLATE NOCASE AND ativo = 1')
    .get(req.params.codigo);

  if (!produto) return res.status(404).json({ erro: 'Produto não encontrado.' });
  res.json(produto);
});

module.exports = router;
