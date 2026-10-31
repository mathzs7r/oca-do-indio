// exige login para entrar no site
(async () => {
  const cliente = await clienteLogado();
  if (!cliente) location.replace('login.html');
})();
