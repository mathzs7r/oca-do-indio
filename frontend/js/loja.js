// ==================================================================
// loja.js: cardápio dinâmico, sacola, agendamento e confirmação.
// Login do cliente é garantido no head do index.html.
// ==================================================================

// ---------- artes do cardápio (por código do produto) ----------
const ARTES = {
  SHA: `<svg class="arte" viewBox="0 0 150 150" aria-hidden="true">
    <ellipse cx="75" cy="128" rx="52" ry="9" fill="#241a10" opacity=".18"/>
    <path d="M35 55 Q75 30 115 55 L112 110 Q75 130 38 110 Z" fill="#e9d8a6" stroke="#241a10" stroke-width="4"/>
    <path d="M35 55 Q75 78 115 55" fill="none" stroke="#a8895a" stroke-width="3"/>
    <path d="M40 68 Q75 90 110 68 M42 82 Q75 102 108 82" fill="none" stroke="#a8895a" stroke-width="3"/>
    <path d="M45 55 q10 -14 22 -6 q10 -12 22 -2 q12 -8 18 6" fill="#c23b22" stroke="#241a10" stroke-width="3"/>
    <circle cx="63" cy="44" r="5" fill="#3e6b35" stroke="#241a10" stroke-width="2"/>
    <circle cx="88" cy="42" r="5" fill="#3e6b35" stroke="#241a10" stroke-width="2"/>
    <path d="M60 108 l-14 14 M90 108 l14 14" stroke="#7c5a33" stroke-width="5" stroke-linecap="round"/>
    <rect x="66" y="103" width="16" height="10" rx="4" fill="#c23b22" stroke="#241a10" stroke-width="3"/>
  </svg>`,
  AIP: `<svg class="arte" viewBox="0 0 150 150" aria-hidden="true">
    <ellipse cx="75" cy="130" rx="50" ry="9" fill="#241a10" opacity=".18"/>
    <path d="M35 50 L110 42 L112 112 L38 118 Z" fill="#f0d9a0" stroke="#241a10" stroke-width="4"/>
    <path d="M35 50 L110 42 L113 58 L38 65 Z" fill="#c9922f" stroke="#241a10" stroke-width="4"/>
    <circle cx="63" cy="84" r="5" fill="#d9b96e" stroke="#a8895a" stroke-width="2"/>
    <circle cx="86" cy="76" r="4" fill="#d9b96e" stroke="#a8895a" stroke-width="2"/>
    <circle cx="76" cy="98" r="4" fill="#d9b96e" stroke="#a8895a" stroke-width="2"/>
    <g fill="#f5ead0" stroke="#241a10" stroke-width="2">
      <path d="M50 46 l6 -10 l6 8 Z"/><path d="M68 42 l6 -10 l6 8 Z"/><path d="M88 38 l6 -9 l6 8 Z"/>
    </g>
    <g stroke="#241a10" stroke-width="3">
      <path d="M18 122 q22 -10 40 2 q-20 8 -40 -2 Z" fill="#c8a15c"/>
      <path d="M132 122 q-22 -10 -40 2 q20 8 40 -2 Z" fill="#c8a15c"/>
    </g>
  </svg>`,
  DOC: `<svg class="arte" viewBox="0 0 150 150" aria-hidden="true">
    <ellipse cx="75" cy="130" rx="50" ry="9" fill="#241a10" opacity=".18"/>
    <path d="M38 78 L112 78 L104 126 L46 126 Z" fill="#c8a15c" stroke="#241a10" stroke-width="4"/>
    <g stroke="#8a6a34" stroke-width="3"><path d="M40 92 h70 M42 106 h66 M44 118 h62"/></g>
    <path d="M38 78 q37 -26 74 0" fill="none" stroke="#241a10" stroke-width="4"/>
    <path d="M40 92 q35 -14 70 0" fill="none" stroke="#c23b22" stroke-width="3"/>
    <g stroke="#241a10" stroke-width="3">
      <circle cx="56" cy="66" r="10" fill="#7c5a33"/>
      <circle cx="78" cy="60" r="10" fill="#e8a33d"/>
      <circle cx="99" cy="66" r="10" fill="#f5ead0"/>
      <path d="M46 50 q8 -14 18 0" fill="#f5ead0" stroke-width="3"/>
    </g>
    <g stroke="#241a10" stroke-width="2.5">
      <circle cx="56" cy="66" r="3" fill="#c23b22"/><circle cx="78" cy="60" r="3" fill="#c23b22"/><circle cx="99" cy="66" r="3" fill="#c23b22"/>
    </g>
  </svg>`,
};
const ARTE_GENERICA = `<svg class="arte" viewBox="0 0 150 150" aria-hidden="true">
  <ellipse cx="75" cy="128" rx="50" ry="9" fill="#241a10" opacity=".18"/>
  <circle cx="75" cy="72" r="38" fill="#e8a33d" stroke="#241a10" stroke-width="4"/>
  <path d="M60 72 h30 M75 57 v30" stroke="#c23b22" stroke-width="5" stroke-linecap="round"/>
</svg>`;

function arteDoProduto(codigo) {
  const prefixo = String(codigo || '').split('-')[0].toUpperCase();
  return ARTES[prefixo] || ARTE_GENERICA;
}

// ---------- utilidades ----------
function moeda(v) {
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',');
}

function dataBR(dataISO) {
  return dataISO.split('-').reverse().join('/');
}

function abre(overlayId) {
  document.getElementById(overlayId).hidden = false;
  document.body.style.overflow = 'hidden';
}

function fecha(overlayId) {
  document.getElementById(overlayId).hidden = true;
  document.body.style.overflow = '';
}

document.querySelectorAll('[data-fecha]').forEach((b) => {
  b.addEventListener('click', () => fecha(b.dataset.fecha));
});

document.getElementById('btn-sair').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  location.href = 'login.html';
});

// ---------- boas-vindas do índio (só logo após o login) ----------
function fecharBemVindo() {
  const div = document.getElementById('bem-vindo');
  div.classList.add('saindo');
  setTimeout(() => {
    div.hidden = true;
    div.classList.remove('saindo');
  }, 300);
}

async function mostrarBemVindo() {
  const div = document.getElementById('bem-vindo');
  const cliente = await clienteLogado();
  const primeiroNome = (cliente && cliente.nome ? cliente.nome.trim().split(' ')[0] : 'cacique');
  document.getElementById('bv-nome').textContent = primeiroNome;

  div.hidden = false;
  const tempo = setTimeout(fecharBemVindo, 2000);
  document.getElementById('bv-fechar').addEventListener('click', () => {
    clearTimeout(tempo);
    fecharBemVindo();
  }, { once: true });
}

// ---------- animação de aparição ----------
function configurarRevelar() {
  const alvos = document.querySelectorAll('[data-revelar]:not([data-revelado])');
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    alvos.forEach((a) => a.classList.add('visivel'));
    return;
  }
  const obs = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('visivel');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.16 });
  alvos.forEach((a, i) => {
    a.style.transitionDelay = `${(i % 3) * 90}ms`;
    obs.observe(a);
  });
}

// ---------- estado global ----------
let FEIRA = null;   // { data, inicio, fim, slots, zap }
let ITENS = [];     // itens da sacola (vindos do banco)

// ==================================================================
// CARDÁPIO
// ==================================================================
function clienteNome() {
  // helper usado pelo link de confirmação
  return clienteLogado().then((c) => (c && c.nome) || 'Cliente');
}

async function carregarFeira() {
  const resp = await fetch('/api/feira');
  FEIRA = await resp.json();

  const info = document.getElementById('feira-info');
  info.textContent = `Retirada na feira: ${dataBR(FEIRA.data)}, das ${FEIRA.inicio} às ${FEIRA.fim}.`;

  document.getElementById('zap-flutuante').href = `https://wa.me/${FEIRA.zap}`;

  const tel = FEIRA.zap.replace(/^55/, '');
  document.getElementById('zap-contato').textContent =
    tel.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');

  const select = document.getElementById('slot-retirada');
  select.innerHTML =
    `<option value="">Escolha o horário...</option>` +
    FEIRA.slots
      .filter((s) => s.startsWith(FEIRA.data))
      .map((s) => `<option value="${s}">${s.split(' ')[1]}</option>`)
      .join('');
}

async function carregarCardapio() {
  const resp = await fetch('/api/produtos');
  if (resp.status === 401) {
    location.replace('login.html');
    return;
  }
  const produtos = await resp.json();
  const grid = document.getElementById('grid-produtos');

  if (!produtos.length) {
    grid.innerHTML = '<p class="carregando-pedidos">Nenhum produto à venda hoje.</p>';
    return;
  }

  grid.innerHTML = produtos
    .map(
      (p) => `
    <article class="produto" data-revelar>
      ${arteDoProduto(p.codigo)}
      <h3>${p.nome}</h3>
      <p>${p.descricao}</p>
      <span class="preco">${moeda(p.preco)}</span><br>
      <button type="button" class="btn-add" data-add="${p.id}">Adicionar à sacola</button>
    </article>
  `
    )
    .join('');

  grid.querySelectorAll('[data-add]').forEach((b) => {
    b.addEventListener('click', async () => {
      b.disabled = true;
      const r = await fetch('/api/carrinho', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ produtoId: Number(b.dataset.add), quantidade: 1 }),
      });
      if (r.status === 401) return location.replace('login.html');
      b.disabled = false;
      if (r.ok) await carregarSacola();
    });
  });

  configurarRevelar();
}

// ==================================================================
// SACOLA
// ==================================================================
function renderSacola() {
  const caixa = document.getElementById('sacola-itens');
  const badge = document.getElementById('badge-sacola');
  const qtdTotal = ITENS.reduce((s, i) => s + i.quantidade, 0);

  badge.hidden = qtdTotal === 0;
  badge.textContent = qtdTotal > 9 ? '9+' : qtdTotal;

  if (!ITENS.length) {
    caixa.innerHTML = '<p class="vazio-sacola">Sua sacola está vazia.<br>Escolha algo no cardápio!</p>';
  } else {
    caixa.innerHTML = ITENS
      .map(
        (i) => `
      <div class="item-sacola">
        <div class="item-info">
          <strong>${i.nome}</strong>
          <small>${moeda(i.preco)} cada: código ${i.codigo}</small>
        </div>
        <div class="item-qtd">
          <button type="button" data-minus="${i.id}" aria-label="Diminuir">−</button>
          <span>${i.quantidade}</span>
          <button type="button" data-plus="${i.id}" aria-label="Aumentar">+</button>
        </div>
        <button type="button" class="remover" data-del="${i.id}" aria-label="Remover do carrinho" title="Remover do carrinho">✕</button>
      </div>
    `
      )
      .join('');
  }

  document.getElementById('sacola-total').textContent = moeda(
    ITENS.reduce((s, i) => s + i.quantidade * i.preco, 0)
  );

  caixa.querySelectorAll('[data-plus]').forEach((b) =>
    b.addEventListener('click', () => {
      const item = ITENS.find((x) => String(x.id) === b.dataset.plus);
      if (item) mudarQtd(item.id, item.quantidade + 1);
    })
  );
  caixa.querySelectorAll('[data-minus]').forEach((b) =>
    b.addEventListener('click', () => {
      const item = ITENS.find((x) => String(x.id) === b.dataset.minus);
      if (item) mudarQtd(item.id, item.quantidade - 1);
    })
  );
  caixa.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', () => removeItem(b.dataset.del))
  );
}

async function mudarQtd(itemId, qtd) {
  if (qtd < 1) return removeItem(itemId);
  const r = await fetch(`/api/carrinho/${itemId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantidade: qtd }),
  });
  if (r.status === 401) return location.replace('login.html');
  await carregarSacola();
}

async function removeItem(itemId) {
  const r = await fetch(`/api/carrinho/${itemId}`, { method: 'DELETE' });
  if (r.status === 401) return location.replace('login.html');
  await carregarSacola();
}

async function carregarSacola() {
  const r = await fetch('/api/carrinho');
  if (r.status === 401) {
    location.replace('login.html');
    return;
  }
  const dados = await r.json();
  ITENS = dados.itens;
  renderSacola();
}

// ==================================================================
// AGENDAR
// ==================================================================
document.getElementById('btn-abrir-sacola').addEventListener('click', async () => {
  await carregarSacola();
  abre('overlay-sacola');
});

document.getElementById('btn-confirmar').addEventListener('click', confirmarPedido);

async function confirmarPedido() {
  const msg = document.getElementById('msg-sacola');
  msg.hidden = true;

  const slot = document.getElementById('slot-retirada').value;
  if (!slot) {
    msg.textContent = 'Escolha o horário de retirada.';
    msg.hidden = false;
    return;
  }
  if (!ITENS.length) {
    msg.textContent = 'Sua sacola está vazia.';
    msg.hidden = false;
    return;
  }
  const formaPagamento = document.getElementById('forma-pagamento').value;
  if (!formaPagamento) {
    msg.textContent = 'Escolha a forma de pagamento.';
    msg.hidden = false;
    return;
  }

  const btn = document.getElementById('btn-confirmar');
  btn.disabled = true;
  try {
    const r = await fetch('/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        retiradaEm: slot,
        observacao: document.getElementById('obs-pedido').value.trim() || null,
        formaPagamento,
      }),
    });
    const dados = await r.json();
    if (r.status === 401) return location.replace('login.html');
    if (!r.ok) throw new Error(dados.erro || 'Falha ao agendar.');

    fecha('overlay-sacola');
    mostrarConfirmacao(dados);
    await carregarSacola();
  } catch (err) {
    msg.textContent = err.message;
    msg.hidden = false;
  } finally {
    btn.disabled = false;
  }
}

function mostrarConfirmacao(pedido) {
  document.getElementById('conf-codigo').textContent = pedido.codigo;
  document.getElementById('conf-retirada').textContent =
    `Retirada: ${dataBR(String(pedido.retirada_em).split(' ')[0])} às ${String(pedido.retirada_em).split(' ')[1]}`;

  const linhas = pedido.itens
    .map((i) => `• ${i.quantidade}x ${i.nome} (${moeda(i.quantidade * i.preco_unitario)})`)
    .join('\n');

  const caixa = document.getElementById('conf-itens');
  caixa.innerHTML = pedido.itens
    .map(
      (i) =>
        `<div class="linha-confirm"><span>${i.quantidade}x ${i.nome}</span><span>${moeda(i.quantidade * i.preco_unitario)}</span></div>`
    )
    .join('');

  document.getElementById('conf-total').textContent =
    `Total: ${moeda(pedido.total)}${pedido.forma_pagamento ? ` • Pagamento: ${pedido.forma_pagamento}` : ''}`;

  construirLinkZap(pedido, linhas);
  abre('overlay-confirm');
}

async function construirLinkZap(pedido, linhas) {
  const obs = pedido.observacao ? `\n\nObservação: ${pedido.observacao}` : '';
  const nome = await clienteNome();

  const msg =
    `Novo pedido na Oca do Índio\n\n` +
    `Código: ${pedido.codigo}\n` +
    `Cliente: ${nome}\n` +
    `Retirada: ${dataBR(String(pedido.retirada_em).split(' ')[0])} às ${String(pedido.retirada_em).split(' ')[1]}\n\n` +
    `Itens:\n${linhas}\n\n` +
    `Total: ${moeda(pedido.total)}${obs}`;

  document.getElementById('zap-link').href = `https://wa.me/${FEIRA.zap}?text=${encodeURIComponent(msg)}`;
}

// ==================================================================
// MEUS PEDIDOS
// ==================================================================
document.getElementById('btn-meus').addEventListener('click', abrirMeusPedidos);

async function abrirMeusPedidos() {
  const r = await fetch('/api/pedidos/me');
  if (r.status === 401) return location.replace('login.html');
  const pedidos = await r.json();

  const nomes = {
    aberto: 'Aberto',
    confirmado: 'Confirmado',
    pronto: 'Pronto',
    retirado: 'Retirado',
    cancelado: 'Cancelado',
  };

  const lista = document.getElementById('lista-meus');
  if (!pedidos.length) {
    lista.innerHTML = '<p class="vazio-sacola">Você ainda não fez pedidos.</p>';
  } else {
    lista.innerHTML = pedidos
      .map((p) => {
        const [d, h] = (p.retirada_em || ' ').split(' ');
        const quando = d ? `${dataBR(d)} às ${h}` : '';
        return `
          <div class="meu-pedido">
            <div class="meu-info">
              <strong>${p.codigo}</strong>
              <small>${quando}, ${p.itens} item(ns), ${moeda(p.total)}</small>
            </div>
            <div class="meu-acoes">
              <span class="meu-status st-${p.status}">${nomes[p.status] || p.status}</span>
              <button type="button" class="btn-repetir" data-repetir="${p.codigo}" title="Colocar os itens deste pedido na sacola">↻</button>
            </div>
          </div>
        `;
      })
      .join('');

    lista.querySelectorAll('[data-repetir]').forEach((b) => {
      b.addEventListener('click', () => repetirPedido(b.dataset.repetir));
    });
  }
  abre('overlay-pedidos');
}

// ---------- repetir um pedido anterior ----------
async function repetirPedido(codigo) {
  const r = await fetch('/api/pedidos/' + encodeURIComponent(codigo));
  if (r.status === 401) return location.replace('login.html');
  const pedido = await r.json();
  if (!r.ok) {
    alert(pedido.erro || 'Não foi possível repetir o pedido.');
    return;
  }

  let faltando = 0;
  for (const i of pedido.itens || []) {
    const res = await fetch('/api/carrinho', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produtoId: i.produto_id, quantidade: i.quantidade }),
    });
    if (res.status === 404) faltando++;
  }

  await carregarSacola();
  fecha('overlay-pedidos');
  abre('overlay-sacola');

  const msg = document.getElementById('msg-sacola');
  msg.hidden = true;
  if (faltando > 0) {
    msg.textContent = `${faltando} produto(s) não estão mais à venda e não foram adicionados.`;
    msg.hidden = false;
  }
}

// ---------- atalhos entre telas ----------
function rolarParaCardapio() {
  document.getElementById('cardapio').scrollIntoView({ behavior: 'smooth' });
}
document.getElementById('btn-meus-voltar').addEventListener('click', () => {
  fecha('overlay-pedidos');
  rolarParaCardapio();
});
document.getElementById('btn-conf-novo').addEventListener('click', () => {
  fecha('overlay-confirm');
  rolarParaCardapio();
});
document.getElementById('btn-conf-meus').addEventListener('click', () => {
  fecha('overlay-confirm');
  abrirMeusPedidos();
});

// ==================================================================
// INÍCIO
// ==================================================================
(async () => {
  if (sessionStorage.getItem('oca_bemvindo') === '1') {
    sessionStorage.removeItem('oca_bemvindo');
    mostrarBemVindo();
  }
  configurarRevelar();
  await carregarFeira();
  await carregarCardapio();
  await carregarSacola();
})();
