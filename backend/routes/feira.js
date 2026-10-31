// ============================================================
// 🪶 Rota pública com os dados da feira (usada pelo site)
// GET /api/feira → { data, inicio, fim, slots, zap }
// ============================================================
const router = require('express').Router();
const { FEIRA, WHATSAPP, horariosDaFeira } = require('../config');

router.get('/', (_req, res) => {
  res.json({
    data: FEIRA.data,
    inicio: FEIRA.inicio,
    fim: FEIRA.fim,
    slots: horariosDaFeira(),
    zap: WHATSAPP,
  });
});

module.exports = router;
