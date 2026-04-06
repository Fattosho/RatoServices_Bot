# RatoServices_bot

Bot de Telegram para dropservice com:
- sincronizacao de servicos da API do fornecedor
- separacao por categoria
- captura de leads
- afiliado somente para quem ja comprou
- credito de comissao em carteira interna
- markup padrao de 150 por cento

## O que ja esta pronto
- menu inicial do bot
- listagem de categorias
- listagem de servicos por categoria
- cadastro de lead ao iniciar conversa
- liberacao automatica de afiliado para quem tiver pelo menos 1 pedido pago
- geracao de link de indicacao
- schema SQL para PostgreSQL
- cliente generico de integracao com API do fornecedor
- rotina de sincronizacao de servicos

## O que falta conectar
Voce ainda precisa informar os detalhes da API do fornecedor para a parte de pagamento e compra final:
- URL base correta da API
- caminho real do endpoint de servicos
- formato do payload de compra
- como a autenticacao deve ser enviada, caso nao seja Bearer padrao
- integracao Pix do seu provedor de pagamento

Com apenas a chave da API nao foi possivel puxar os servicos reais daqui, entao o projeto ficou preparado para isso de forma configuravel.

## Instalar
```bash
npm install
cp .env.example .env
```

## Rodar em desenvolvimento
```bash
npm run dev
```

## Build
```bash
npm run build
npm start
```

## Estrutura
```text
src/
  bot/
  config/
  db/
  integrations/
  services/
  types/
  utils/
```

## Fluxo do bot
1. usuario entra com /start
2. lead e salvo
3. categorias sao exibidas
4. usuario escolhe categoria
5. servicos da categoria sao exibidos
6. usuario consulta detalhes
7. quando existir a parte de checkout, o pedido sera criado
8. apos primeira compra paga, o usuario vira afiliado
9. afiliado recebe link proprio para indicar e ganhar creditos

## Variaveis principais
- `SUPPLIER_API_BASE_URL`: URL da API do fornecedor
- `SUPPLIER_API_SERVICES_PATH`: endpoint de servicos
- `SUPPLIER_API_TOKEN`: token da API
- `SUPPLIER_API_TOKEN_HEADER`: nome do header de autenticacao
- `SUPPLIER_API_TOKEN_PREFIX`: prefixo do token, ex.: Bearer
- `PRICE_MARKUP_MULTIPLIER`: 2.5 para aplicar 150 por cento sobre o custo
- `AFFILIATE_COMMISSION_PERCENT`: 10

## Observacao importante
Se a API retornar os servicos num formato diferente do esperado, ajuste o arquivo:
- `src/integrations/supplierApi.ts`

Ele ja tenta mapear formatos comuns de categoria, nome, descricao e preco.
