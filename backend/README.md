# Backend

API do site Oca do Índio em Node.js + Express, com banco SQLite.

## Como rodar

```sh
cd backend
npm install
npm start
```

- Site local: http://localhost:3000
- Banco: criado automaticamente na primeira execução em `../database/`.
- Configuração por `.env` (veja `.env.example`):
  - `ADMIN_USUARIO` e `ADMIN_SENHA` são obrigatórios para o login administrativo.
  - `DB_PATH` é opcional para usar outro caminho de banco.
- Teste de fumaça (com o servidor rodando): `npm run teste`

## Rotas

- `/api/auth` cadastro, login, sessão e saída do cliente
- `/api/produtos` cardápio
- `/api/carrinho` itens da sacola
- `/api/pedidos` agendar retirada, meus pedidos e consulta por código
- `/api/feira` data, horários e contato
- `/api/admin` área restrita (acesso validado por sessão)
