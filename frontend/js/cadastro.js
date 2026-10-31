// cadastro do cliente
document.getElementById('form-cadastro').addEventListener('submit', async (e) => {
  e.preventDefault();
  const erro = document.getElementById('msg-erro');
  erro.hidden = true;
  try {
    const resp = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: document.getElementById('nome').value,
        telefone: document.getElementById('telefone').value,
        senha: document.getElementById('senha').value,
      }),
    });
    const dados = await resp.json();
    if (!resp.ok) throw new Error(dados.erro || 'Falha no cadastro.');
    // cadastrou? agora precisa fazer login
    location.href = 'login.html?cadastro=1';
  } catch (err) {
    erro.textContent = err.message;
    erro.hidden = false;
  }
});
