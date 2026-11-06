// ==================================================================
// 🪶 admin.js — painel exclusivo (pedidos)
// ==================================================================
(async () => {
  // guarda: sem sessão de admin, volta pro login restrito
  const me = await fetch('/api/admin/me');
  if (!me.ok) location.replace('admin-login.html');
  const { admin } = await me.json();
  document.getElementById('saudacao-admin').textContent = `${admin.usuario}`;
})();

function sair() {
  fetch('/api/admin/logout', { method: 'POST' }).finally(() => location.replace('admin-login.html'));
}
document.getElementById('btn-sair').addEventListener('click', sair);

const STATUS_INFO = {
  aberto:     { rotulo: 'Aberto',     classe: 'st-aberto' },
  confirmado: { rotulo: 'Confirmado', classe: 'st-confirmado' },
  pronto:     { rotulo: 'Pronto',     classe: 'st-pronto' },
  retirado:   { rotulo: 'Retirado',   classe: 'st-retirado' },
  cancelado:  { rotulo: 'Cancelado',  classe: 'st-cancelado' },
};

function formatarRetirada(retirada) {
  if (!retirada) return '—';
  const [data, hora] = String(retirada).split(' ');
  return `${data.split('-').reverse().join('/')} às ${hora}`;
}

function moeda(v) {
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',');
}

function itemTexto(i) {
  const sub = i.quantidade * i.preco_unitario;
  return `• ${i.quantidade}x ${i.nome} — ${moeda(sub)}`;
}

async function carregarPedidos() {
  const filtro = document.getElementById('filtro-status').value;
  const resp = await fetch('/api/admin/pedidos' + (filtro ? `?status=${filtro}` : ''));
  if (resp.status === 401) return location.replace('admin-login.html');

  const pedidos = await resp.json();
  const lista = document.getElementById('lista-pedidos');

  if (!pedidos.length) {
    lista.innerHTML = '<p class="vazio">Nenhum pedido por aqui ainda.</p>';
    return;
  }

  lista.innerHTML = pedidos.map((p) => {
    const info = STATUS_INFO[p.status] || { rotulo: p.status, classe: 'st-aberto' };
    return `
      <article class="pedido" data-id="${p.id}">
        <header class="pedido-topo">
          <div>
            <strong class="codigo">#${p.codigo}</strong>
            <span class="status ${info.classe}">${info.rotulo}</span>
          </div>
          <small>${formatarRetirada(p.retirada_em)}</small>
        </header>

        <p class="cliente">${p.cliente || p.cliente_nome || 'Cliente'}${p.telefone ? `, ${p.telefone}` : ''}</p>

        <div class="itens">
          ${p.itens.map(itemTexto).join('<br>')}
        </div>

        ${p.observacao ? `<p class="obs">Observação: ${p.observacao}</p>` : ''}

        <footer class="pedido-base">
          <strong>${moeda(p.total)}</strong>
          <div class="acoes">
            ${['confirmado', 'pronto', 'retirado', 'cancelado'].map((s) => `
              <button class="btn-mini ${s === p.status ? 'atual' : ''}"
                      data-id="${p.id}" data-status="${s}"
                      ${s === p.status ? 'disabled' : ''}>
                ${STATUS_INFO[s].rotulo}
              </button>
            `).join('')}
          </div>
        </footer>
      </article>
    `;
  }).join('');

  document.querySelectorAll('[data-status]').forEach((b) => {
    if (b.disabled) return;
    b.addEventListener('click', async () => {
      b.disabled = true;
      const resp = await fetch(`/api/admin/pedidos/${b.dataset.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: b.dataset.status }),
      });
      if (!resp.ok) {
        const d = await resp.json().catch(() => ({}));
        alert(d.erro || 'Não foi possível atualizar.');
        b.disabled = false;
        return;
      }
      carregarPedidos();
    });
  });
}

document.getElementById('btn-atualizar').addEventListener('click', carregarPedidos);
document.getElementById('filtro-status').addEventListener('change', carregarPedidos);

// ---------- NOVO PEDIDO (cadastro manual pelo admin) ----------
let produtosCache = [];

function criarLinhaItem() {
  const linha = document.createElement('div');
  linha.className = 'item-linha';
  linha.innerHTML = `
    <select class="np-produto" required>
      <option value="">Escolha o produto…</option>
      ${produtosCache.map((p) => `<option value="${p.id}">${p.nome} — ${moeda(p.preco)}</option>`).join('')}
    </select>
    <input class="np-qtd" type="number" min="1" max="999" value="1" required aria-label="Quantidade">
    <button type="button" class="btn-mini np-remover">✕</button>
  `;
  linha.querySelector('.np-remover').addEventListener('click', () => {
    if (document.querySelectorAll('.item-linha').length > 1) linha.remove();
  });
  document.getElementById('np-itens').appendChild(linha);
}

async function carregarProdutos() {
  const resp = await fetch('/api/admin/produtos');
  if (!resp.ok) return;
  produtosCache = await resp.json();
  // repõe as opções das linhas já criadas
  document.querySelectorAll('.item-linha').forEach((linha) => {
    const select = linha.querySelector('.np-produto');
    const atual = select.value;
    select.innerHTML =
      '<option value="">Escolha o produto…</option>' +
      produtosCache.map((p) => `<option value="${p.id}">${p.nome} — ${moeda(p.preco)}</option>`).join('');
    select.value = atual;
  });
}

async function carregarHorarios() {
  const resp = await fetch('/api/admin/horarios');
  if (!resp.ok) return;
  const horarios = await resp.json();
  const select = document.getElementById('np-retirada');
  horarios.forEach((h) => {
    const [data, hora] = h.split(' ');
    const opt = document.createElement('option');
    opt.value = h;
    opt.textContent = `${data.split('-').reverse().join('/')} às ${hora}`;
    select.appendChild(opt);
  });
}

document.getElementById('btn-add-item').addEventListener('click', criarLinhaItem);

document.getElementById('form-novo-pedido').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('np-msg');
  msg.textContent = '';

  const itens = [...document.querySelectorAll('.item-linha')].map((linha) => ({
    produtoId: Number(linha.querySelector('.np-produto').value),
    quantidade: Number(linha.querySelector('.np-qtd').value),
  }));

  const resp = await fetch('/api/admin/pedidos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nome: document.getElementById('np-nome').value,
      retiradaEm: document.getElementById('np-retirada').value || null,
      observacao: document.getElementById('np-obs').value || null,
      itens,
    }),
  });

  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    msg.textContent = dados.erro || 'Não foi possível cadastrar o pedido.';
    return;
  }

  msg.textContent = `Pedido ${dados.codigo} cadastrado! 🎉`;
  e.target.reset();
  document.getElementById('np-itens').innerHTML = '';
  criarLinhaItem();
  carregarPedidos();
});

// ---------- BACKUP EM JSON ----------
document.getElementById('btn-backup').addEventListener('click', async () => {
  const resp = await fetch('/api/admin/pedidos/backup');
  if (!resp.ok) {
    alert('Não foi possível baixar o backup.');
    return;
  }
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pedidos-backup.json';
  a.click();
  URL.revokeObjectURL(url);
});

// auto-atualização a cada 20s
setInterval(() => { if (!document.hidden) carregarPedidos(); }, 20000);
carregarProdutos();
carregarHorarios();
criarLinhaItem();
carregarPedidos();
