// ==================================================================
// 🪶 auth.js — checagem de sessão + máscara de telefone
// - index.html redireciona pro login se não houver sessão
// - login/cadastro redirecionam pro index se JÁ estão logados
// - máscara automática: (42) 99999-9999
// ==================================================================
async function clienteLogado() {
  try {
    const resp = await fetch('/api/auth/me');
    if (!resp.ok) return null;
    const dados = await resp.json();
    return dados.logado ? dados.cliente : null;
  } catch {
    return null;
  }
}

// ---------- Máscara de telefone ((42) 99999-9999) ----------
function mascaraTelefone(input) {
  let v = input.value.replace(/\D/g, '');
  if (v.length > 11) v = v.slice(0, 11);

  if (v.length > 9) {
    input.value = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
  } else if (v.length > 7) {
    input.value = `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
  } else if (v.length > 2) {
    input.value = `(${v.slice(0, 2)}) ${v.slice(2)}`;
  } else if (v.length > 0) {
    input.value = `(${v}`;
  } else {
    input.value = '';
  }
}

// aplica em todo campo de telefone da página
document.querySelectorAll('input[type="tel"]').forEach((input) => {
  input.addEventListener('input', () => mascaraTelefone(input));
  input.addEventListener('blur', () => mascaraTelefone(input));
});
