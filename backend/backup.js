// ============================================================
// 🪶 Backup em JSON de todos os pedidos
// Salva database/pedidos-backup.json (ou BACKUP_PATH) com todos
// os pedidos + itens. Escrita atômica (tmp + rename) e nunca
// derruba a requisição: em caso de erro, só registra no console.
// ============================================================
const fs = require('fs');
const path = require('path');
const db = require('./db');

const BACKUP_PATH = process.env.BACKUP_PATH
  ? path.resolve(process.env.BACKUP_PATH)
  : path.join(__dirname, '..', 'database', 'pedidos-backup.json');

// todos os pedidos com itens (mesma base da listagem do admin)
function gerarDadosBackup() {
  const pedidos = db
    .prepare(`
      SELECT p.id, p.codigo, p.tipo, p.status, p.retirada_em, p.observacao,
             p.forma_pagamento,
             p.total, p.criado_em, p.atualizado_em, p.cliente_nome,
             c.nome AS cliente, c.telefone
      FROM pedidos p LEFT JOIN clientes c ON c.id = p.cliente_id
      ORDER BY p.id
    `)
    .all();

  const itens = db
    .prepare(`
      SELECT pi.pedido_id, pi.quantidade, pi.preco_unitario, pr.codigo, pr.nome
      FROM pedido_itens pi JOIN produtos pr ON pr.id = pi.produto_id
      ORDER BY pi.id
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

  return {
    gerado_em: new Date().toISOString(),
    total_pedidos: pedidos.length,
    pedidos: pedidos.map((p) => ({ ...p, itens: porPedido.get(p.id) || [] })),
  };
}

function salvarBackupPedidos() {
  try {
    const dados = gerarDadosBackup();
    fs.mkdirSync(path.dirname(BACKUP_PATH), { recursive: true });
    const temporario = `${BACKUP_PATH}.tmp-${process.pid}`;
    fs.writeFileSync(temporario, JSON.stringify(dados, null, 2), 'utf-8');
    fs.renameSync(temporario, BACKUP_PATH);
    return BACKUP_PATH;
  } catch (err) {
    console.error('⚠️ Não foi possível salvar o backup de pedidos:', err.message);
    // remove o temporário, se ficou, sem mascarar o erro original
    try { fs.unlinkSync(`${BACKUP_PATH}.tmp-${process.pid}`); } catch {}
    return null;
  }
}

module.exports = { salvarBackupPedidos, gerarDadosBackup, BACKUP_PATH };
