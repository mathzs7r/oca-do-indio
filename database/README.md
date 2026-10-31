# Database

SQLite da Oca do Índio: arquivo único, sem servidor externo.

## Arquivos

- `schema.sql` criação de tabelas, índices e regras
- `seed.sql` cardápio inicial
- `oca-do-indio.db` banco gerado automaticamente pelo backend (não versionado)

O backend cria o banco e aplica `schema.sql` + `seed.sql` na primeira execução.

## Fluxo dos dados

Clientes e carrinhos:
- um cliente pode ter um carrinho aberto com itens de produtos
- cada cliente já cadastrado pode ter inúmeros pedidos

pedidos:
- cada pedido guarda data e horário de retirada, cliente, status e itens
- mudanças de status ficam registradas em `pedido_status_log`
