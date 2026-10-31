# Oca do Índio

Site de pedidos com retirada agendada para a feira: shawarma, bolo de aipim e docinhos artesanais.

Feito com Node.js, Express e SQLite.

## Rodar localmente

```sh
cd backend
npm install
npm start
```

Depois abra http://localhost:3000

Para o acesso ao painel administrativo, defina `ADMIN_USUARIO` e `ADMIN_SENHA`
em um arquivo `.env` dentro de `backend/` (veja o exemplo em `backend/.env.example`).

## Estrutura

```
frontend/  páginas, estilos e scripts do navegador
backend/   API, autenticação, carrinho e pedidos
database/  schema e carga inicial do SQLite
```

## Publicar no Render

1. Suba o projeto para o GitHub.
2. No Render, crie um Web Service apontando para este repositório.
3. O `render.yaml` já define `rootDir: backend`, build `npm ci` e start `npm start`.
4. Configure as variáveis `ADMIN_USUARIO` e `ADMIN_SENHA` no painel do Render.
5. Faça o deploy.

## Avisos importantes

- **Plano gratuito do Render:** o disco é temporário, então pedidos e cadastros
  podem ser perdidos em reinícios, deploys ou hibernação do serviço. Para uma
  feira real, considere um plano com disco persistente ou um banco externo.
- O serviço gratuito hiberna após cerca de 15 minutos sem acesso.

## Área do administrador

Existe uma área restrita, cujo acesso é validado pelo backend e nunca aparece
nos links do site. As credenciais ficam apenas em variáveis de ambiente.
