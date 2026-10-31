// Teste de fumaça: fluxo completo cliente + admin + limpeza
const BASE = 'http://localhost:3000';
const assert = (cond, msg) => {
  console.log((cond ? '✅' : '❌') + ' ' + msg);
  if (!cond) process.exitCode = 1;
};

async function req(caminho, { metodo = 'GET', corpo, cookie } = {}) {
  const r = await fetch(BASE + caminho, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  let dados = null;
  try { dados = await r.clone().json(); } catch {}
  const setCookie = r.headers.get('set-cookie');
  return { status: r.status, dados, cookie: setCookie ? setCookie.split(';')[0] : null };
}

(async () => {
  // credenciais do admin vêm do ambiente; sem elas o teste não roda
  const ADMIN_USUARIO = process.env.ADMIN_USUARIO;
  const ADMIN_SENHA = process.env.ADMIN_SENHA;
  if (!ADMIN_USUARIO || !ADMIN_SENHA) {
    console.error('❌ Defina ADMIN_USUARIO e ADMIN_SENHA para rodar o teste.');
    process.exit(1);
  }

  // feira
  const feira = await req('/api/feira');
  assert(feira.status === 200, `GET /api/feira → ${feira.status}`);
  const slot = feira.dados.slots[1];
  console.log('   slot escolhido:', slot);

  // cadastro NÃO deve logar (sem cookie), só criar a conta
  const tel = '42999999999';
  let r = await req('/api/auth/register', { metodo: 'POST', corpo: { nome: 'Cliente Teste da Tribo', telefone: tel, senha: 'senhateste123' } });
  assert(r.status === 201 && !r.cookie, `cadastro sem sessão → ${r.status} (cookie: ${r.cookie || 'nenhum'})`);

  // agora loga de verdade
  r = await req('/api/auth/login', { metodo: 'POST', corpo: { telefone: tel, senha: 'senhateste123' } });
  assert(r.status === 200 && r.cookie, `login do cliente → ${r.status}`);
  const cookieCliente = r.cookie;

  // produtos
  const prods = await req('/api/produtos', { cookie: cookieCliente });
  assert(prods.status === 200 && prods.dados.length >= 3, `GET /api/produtos → ${prods.dados.length} itens`);
  const produto = prods.dados[0];

  // adicionar ao carrinho
  r = await req('/api/carrinho', { metodo: 'POST', corpo: { produtoId: produto.id, quantidade: 2 }, cookie: cookieCliente });
  assert(r.status === 201, `POST /api/carrinho → ${r.status}`);

  // horário inválido deve ser recusado
  r = await req('/api/pedidos', { metodo: 'POST', corpo: { retiradaEm: '2026-12-25 09:00' }, cookie: cookieCliente });
  assert(r.status === 400, `horário fora da feira recusado → ${r.status} (${r.dados?.erro})`);

  // pedido válido
  r = await req('/api/pedidos', { metod: 'POST', metodo: 'POST', corpo: { retiradaEm: slot, observacao: 'teste sem cebola' }, cookie: cookieCliente });
  assert(r.status === 201, `POST /api/pedidos → ${r.status} código=${r.dados?.codigo} total=${r.dados?.total}`);
  const pedidoId = r.dados?.id;

  // meus pedidos
  r = await req('/api/pedidos/me', { cookie: cookieCliente });
  assert(r.status === 200 && r.dados.length >= 1, `GET /api/pedidos/me → ${r.dados.length} pedido(s)`);

  // cliente NÃO pode usar área admin
  r = await req('/api/admin/pedidos', { cookie: cookieCliente });
  assert(r.status === 401, `cliente bloqueado no painel → ${r.status}`);

  // login admin errado
  r = await req('/api/admin/login', { metodo: 'POST', corpo: { usuario: ADMIN_USUARIO, senha: 'errado' } });
  assert(r.status === 401, `senha errada do admin recusada → ${r.status}`);

  // login admin correto
  r = await req('/api/admin/login', { metodo: 'POST', corpo: { usuario: ADMIN_USUARIO, senha: ADMIN_SENHA } });
  assert(r.status === 200, `login do admin → ${r.status}`);
  const cookieAdmin = r.cookie;

  // listar pedidos
  r = await req('/api/admin/pedidos', { cookie: cookieAdmin });
  assert(r.status === 200 && r.dados.some((p) => p.codigo), `GET /api/admin/pedidos → ${r.dados.length} pedido(s)`);
  const pedidoAdmin = r.dados.find((p) => p.retirada_em === slot);

  // mudar status
  if (pedidoAdmin) {
    r = await req(`/api/admin/pedidos/${pedidoAdmin.id}/status`, { metodo: 'PATCH', corpo: { status: 'confirmado' }, cookie: cookieAdmin });
    assert(r.status === 200 && r.dados.status === 'confirmado', `PATCH status → ${r.status}`);
  }

  // logout admin
  r = await req('/api/admin/logout', { metodo: 'POST', cookie: cookieAdmin });
  assert(r.status === 200, `logout admin → ${r.status}`);

  // limpeza dos dados de teste
  const db = require('../db');
  const cliente = db.prepare('SELECT id FROM clientes WHERE telefone = ?').get(tel);
  if (cliente) {
    db.prepare('DELETE FROM pedido_status_log WHERE pedido_id IN (SELECT id FROM pedidos WHERE cliente_id = ?)').run(cliente.id);
    db.prepare('DELETE FROM pedido_itens WHERE pedido_id IN (SELECT id FROM pedidos WHERE cliente_id = ?)').run(cliente.id);
    db.prepare('DELETE FROM pedidos WHERE cliente_id = ?').run(cliente.id);
    db.prepare('DELETE FROM carrinho_itens WHERE carrinho_id IN (SELECT id FROM carrinhos WHERE cliente_id = ?)').run(cliente.id);
    db.prepare('DELETE FROM carrinhos WHERE cliente_id = ?').run(cliente.id);
    db.prepare('DELETE FROM sessoes WHERE cliente_id = ?').run(cliente.id);
    db.prepare('DELETE FROM clientes WHERE id = ?').run(cliente.id);
    console.log('🧹 dados de teste removidos do banco');
  }
})();
