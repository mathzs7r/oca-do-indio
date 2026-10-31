// login restrito do administrador
document.getElementById('form-admin').addEventListener('submit', async (e) => {
  e.preventDefault();
  const erro = document.getElementById('msg-erro');
  erro.hidden = true;
  try {
    const resp = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario: document.getElementById('usuario').value,
        senha: document.getElementById('senha').value,
      }),
    });
    const dados = await resp.json();
    if (!resp.ok) throw new Error(dados.erro || 'Falha no login.');
    location.href = 'admin.html';
  } catch (err) {
    erro.textContent = err.message;
    erro.hidden = false;
  }
});
