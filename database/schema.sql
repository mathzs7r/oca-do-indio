-- ============================================================
-- 🪶 Oca do Índio — Modelagem do banco (SQLite)
-- Conceito: cliente monta o carrinho, escolhe quantidade,
-- adiciona ao carrinho ou agenda retirada informando o código
-- do produto.
-- ============================================================

PRAGMA foreign_keys = ON;

-- ---------- CATEGORIAS (para organizar o cardápio) ----------
CREATE TABLE categorias (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nome      TEXT NOT NULL UNIQUE            -- ex: 'Comidas', 'Doces'
);

-- ---------- PRODUTOS ----------
-- codigo: código curto exibido no site (ex: SHA-01) que a pessoa
-- digita/usa ao agendar a retirada.
CREATE TABLE produtos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo      TEXT    NOT NULL UNIQUE,      -- ex: 'SHA-01', 'AIP-01'
  nome        TEXT    NOT NULL,
  descricao   TEXT    NOT NULL,
  preco       REAL    NOT NULL CHECK (preco >= 0),  -- em R$
  categoria_id INTEGER NOT NULL REFERENCES categorias(id),
  etiqueta    TEXT,                          -- ex: '🔥 Mais pedido!'
  ativo       INTEGER NOT NULL DEFAULT 1,    -- 1 = à venda, 0 = oculto
  criado_em   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- CLIENTES (não obrigatório logar; telefone identifica) ----------
CREATE TABLE clientes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nome       TEXT NOT NULL,
  telefone   TEXT NOT NULL UNIQUE,            -- identificador; ex: '42998169417'
  senha_hash TEXT,                            -- hash bcrypt (login); null = só telefone
  criado_em  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- CARRINHOS (temporários, até virarem pedido ou bprix abandonados) ----------
CREATE TABLE carrinhos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER REFERENCES clientes(id), -- null = visitante não identificado
  criado_em  TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

-- itens do carrinho: cada linha = produto + quantidade escolhida
CREATE TABLE carrinho_itens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  carrinho_id INTEGER NOT NULL REFERENCES carrinhos(id) ON DELETE CASCADE,
  produto_id  INTEGER NOT NULL REFERENCES produtos(id),
  quantidade  INTEGER NOT NULL CHECK (quantidade > 0),
  UNIQUE (carrinho_id, produto_id)            -- mesmo produto soma na quantidade, não duplica
);

-- ---------- PEDIDOS ----------
-- tipo: 'carrinho' (pronto pra retirar em breve) ou 'agendado' (marcou data/hora)
-- status: aberto -> confirmado -> pronto -> retirado (ou cancelado)
CREATE TABLE pedidos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo         TEXT    NOT NULL UNIQUE,    -- código do pedido exibido ao cliente
  cliente_id     INTEGER REFERENCES clientes(id),
  tipo           TEXT    NOT NULL CHECK (tipo IN ('carrinho','agendado')),
  status         TEXT    NOT NULL DEFAULT 'aberto'
                 CHECK (status IN ('aberto','confirmado','pronto','retirado','cancelado')),
  retirada_em    TEXT,                        -- data/hora agendada (tipo='agendado'); ex: '2026-10-31 10:00'
  observacao     TEXT,                        -- observações gerais da pessoa
  total          REAL NOT NULL DEFAULT 0,     -- somatório dos itens
  criado_em      TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- itens do pedido: congela preço e quantidade do momento do pedido
CREATE TABLE pedido_itens (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id      INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id     INTEGER NOT NULL REFERENCES produtos(id),
  quantidade     INTEGER NOT NULL CHECK (quantidade > 0),
  preco_unitario REAL    NOT NULL CHECK (preco_unitario >= 0)
);

-- ---------- SESSÕES (login por cookie; cliente não fica logado no navegador) ----------
CREATE TABLE sessoes (
  token      TEXT PRIMARY KEY,          -- valor aleatório que vai no cookie
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  criado_em  TEXT NOT NULL DEFAULT (datetime('now')),
  expira_em  TEXT NOT NULL
);

-- ---------- HISTÓRICO DE STATUS (auditoria simples) ----------
CREATE TABLE pedido_status_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  status    TEXT NOT NULL,
  momento   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- Índices para as buscas mais comuns
-- ============================================================
CREATE INDEX idx_produtos_categoria ON produtos(categoria_id);
CREATE INDEX idx_pedidos_codigo     ON pedidos(codigo);        -- buscar pedido pelo código
CREATE INDEX idx_pedidos_retirada   ON pedidos(retirada_em);   -- agenda do dia
CREATE INDEX idx_pedidos_cliente    ON pedidos(cliente_id);
