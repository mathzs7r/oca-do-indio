// ============================================================
// Oca do Índio — servidor da API
// Rodar:  npm install && npm start   (dentro de backend/)
// Site:   http://localhost:3000
// ============================================================
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const db = require('./db'); // cria/abre o banco e o administrador
const { salvarBackupPedidos } = require('./backup');
salvarBackupPedidos(); // garante um backup JSON atualizado na inicialização

const app = express();
const PRODUCAO = process.env.NODE_ENV === 'production';
const PORTA = process.env.PORT || 3000;

// atrás de proxy reverso (Render, Vercel, nginx) o IP real vem do X-Forwarded-For
if (PRODUCAO) app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(express.json());
app.use(cookieParser());

// ---------- cabeçalhos básicos de segurança ----------
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (PRODUCAO) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data:",
      "connect-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
    ].join('; '));
  }
  next();
});

// ---------- ROTAS DA API ----------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/produtos', require('./routes/produtos'));
app.use('/api/carrinho', require('./routes/carrinho'));
app.use('/api/pedidos', require('./routes/pedidos'));
app.use('/api/feira', require('./routes/feira'));
app.use('/api/admin', require('./routes/admin'));

// ---------- FRONTEND (pasta ../frontend) ----------
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// páginas de login/cadastro sempre acessíveis
app.get(['/login.html', '/cadastro.html'], (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', req.path.replace('/', '')));
});

// 404 da API em JSON
app.use('/api', (_req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

// erros inesperados sem vazar stack trace
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

app.listen(PORTA, () => {
  console.log(`Oca do Índio rodando em http://localhost:${PORTA}`);
});
