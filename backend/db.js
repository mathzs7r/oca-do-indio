// ============================================================
// Oca do Índio — conexão/criação do banco (SQLite)
// Usa o schema e o seed da pasta ../database (mesma modelagem).
// Credenciais do administrador vêm SEMPRE de variáveis de ambiente:
//   ADMIN_USUARIO, ADMIN_SENHA (e, opcionalmente, DB_PATH)
// Nada de credenciais fica no código ou no repositório.
// ============================================================
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const PRODUCAO = process.env.NODE_ENV === 'production';

// caminho do banco: pode ser trocado por DB_PATH (ex.: disco persistente no deploy)
const DB_DIR_PADRAO = path.join(__dirname, '..', 'database');
const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(DB_DIR_PADRAO, 'oca-do-indio.db');
const DB_DIR = path.dirname(DB_PATH);

fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// aplica schema.sql e seed.sql na primeira execução
function init() {
  const temTabelas = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='produtos'")
    .get();

  if (!temTabelas) {
    const schema = fs.readFileSync(path.join(DB_DIR_PADRAO, 'schema.sql'), 'utf-8');
    db.exec(schema);

    const seed = fs.readFileSync(path.join(DB_DIR_PADRAO, 'seed.sql'), 'utf-8');
    db.exec(seed);
    console.log('Banco criado com schema + seed do cardápio.');
  } else {
    // migração: garantir colunas novas em bancos antigos
    const colunasClientes = db.prepare('PRAGMA table_info(clientes)').all().map(c => c.name);
    if (!colunasClientes.includes('senha_hash')) {
      db.exec("ALTER TABLE clientes ADD COLUMN senha_hash TEXT");
      console.log('Coluna senha_hash adicionada em clientes.');
    }
    const colunasPedidos = db.prepare('PRAGMA table_info(pedidos)').all().map(c => c.name);
    if (!colunasPedidos.includes('cliente_nome')) {
      db.exec("ALTER TABLE pedidos ADD COLUMN cliente_nome TEXT");
      console.log('Coluna cliente_nome adicionada em pedidos.');
    }
    if (!colunasPedidos.includes('forma_pagamento')) {
      db.exec("ALTER TABLE pedidos ADD COLUMN forma_pagamento TEXT");
      console.log('Coluna forma_pagamento adicionada em pedidos.');
    }
    const temSessoes = db
      .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='sessoes'")
      .get();
    if (!temSessoes) {
      db.exec(`
        CREATE TABLE sessoes (
          token      TEXT PRIMARY KEY,
          cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
          criado_em  TEXT NOT NULL DEFAULT (datetime('now')),
          expira_em  TEXT NOT NULL
        )
      `);
      console.log('Tabela sessoes criada.');
    }
  }
}

init();

// ---------- limpeza de sessões expiradas na inicialização ----------
function limparSessoesExpiradas() {
  db.prepare("DELETE FROM sessoes WHERE expira_em <= datetime('now')").run();
  db.prepare("DELETE FROM sessoes_admin WHERE expira_em <= datetime('now')").run();
}

// ---------- tabelas + administrador (vindos do ambiente) ----------
(function garantirAdmin() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario    TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      criado_em  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessoes_admin (
      token      TEXT PRIMARY KEY,
      admin_id   INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
      criado_em  TEXT NOT NULL DEFAULT (datetime('now')),
      expira_em  TEXT NOT NULL
    );
  `);

  const usuario = process.env.ADMIN_USUARIO;
  const senha = process.env.ADMIN_SENHA;

  if (!usuario || !senha) {
    if (PRODUCAO) {
      throw new Error('Variáveis ADMIN_USUARIO e ADMIN_SENHA são obrigatórias em produção.');
    }
    console.warn('Aviso: ADMIN_USUARIO/ADMIN_SENHA não definidos. Login administrativo desativado.');
    return;
  }

  // garante que o usuário exista e que a senha do ambiente esteja em vigor
  db.prepare(`
    INSERT INTO admins (usuario, senha_hash) VALUES (?, ?)
    ON CONFLICT(usuario) DO UPDATE SET senha_hash = excluded.senha_hash
  `).run(String(usuario).trim(), bcrypt.hashSync(String(senha), 10));
})();

limparSessoesExpiradas();

module.exports = db;
