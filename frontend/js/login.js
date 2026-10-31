// mensagem de cadastro recém-feito
if (new URLSearchParams(location.search).get('cadastro') === '1') {
  document.getElementById('msg-ok').textContent = 'Cadastro realizado! Faça login para continuar.';
  document.getElementById('msg-ok').hidden = false;
}

// login do cliente
document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const erro = document.getElementById('msg-erro');
  erro.hidden = true;
  try {
    const resp = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telefone: document.getElementById('telefone').value,
        senha: document.getElementById('senha').value,
      }),
    });
    const dados = await resp.json();
    if (!resp.ok) throw new Error(dados.erro || 'Falha no login.');
    // marca para o índio dar as boas-vindas na tela inicial
    sessionStorage.setItem('oca_bemvindo', '1');
    location.href = 'index.html';
  } catch (err) {
    erro.textContent = err.message;
    erro.hidden = false;
  }
});
