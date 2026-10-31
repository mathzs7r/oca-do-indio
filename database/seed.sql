-- ============================================================
-- 🪶 Oca do Índio — Dados iniciais (seed)
-- Cardápio atual do site + categorias básicas
-- ============================================================

INSERT INTO categorias (id, nome) VALUES
  (1, 'Comidas'),
  (2, 'Doces');

INSERT INTO produtos (codigo, nome, descricao, preco, categoria_id, etiqueta) VALUES
  ('SHA-01', 'Shawarma da Oca',
   'Panquequinha tostada no chapéu de pedra, recheio suculento de carne ou frango com vinagrete da mata.',
   15.00, 1, '🔥 Mais pedido!'),
  ('AIP-01', 'Bolo de Aipim',
   'Da raiz mandioca, assado devagar no fogo da oca. Molhadinho, com coco por cima. Sabor de casa de vó!',
   3.00, 1, '🌾 Raiz da terra'),
  ('DOC-01', 'Docinhos da Tribo',
   'Brigadeiro, beijinho e bolo de colher no cestinho de palha. Feitos no caldeirão de barro!',
   3.00, 2, '🎁 Doces da aldeia');
