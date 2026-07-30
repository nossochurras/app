# Integração PagBank — aplicativo

Este projeto foi preparado para operar com o PagBank por meio de um backend no n8n. O aplicativo nunca recebe o token privado do PagBank, nunca define um pedido como pago e nunca concede cupom ou fidelidade antes da confirmação do webhook.

## O que foi implementado

- Checkout com PIX, cartão de crédito e pagamento presencial na retirada.
- Criptografia do cartão no navegador com o SDK oficial do PagBank.
- Envio do JWT Supabase para autenticação no n8n.
- Cotação e recálculo do pedido pelo backend.
- Chave estável por tentativa para idempotência e repetição segura após timeout.
- Tela PIX com QR Code, copia e cola e validade.
- Atualização do status por Supabase Realtime.
- Retomada de pedidos pendentes.
- Pedidos por peso enviados ao backend e mantidos em `awaiting_weighing` até o valor final ser definido.
- Remoção das gravações de `payment_status = paid`, consumo de cupom e fidelidade no frontend.
- Confirmação manual no painel limitada a pedidos `LOCAL` por RPC protegida.

## Variáveis do aplicativo

Copie `.env.example` para `.env.local` e preencha:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA_SUPABASE
VITE_N8N_CHECKOUT_QUOTE_URL=https://SEU-N8N/webhook/pagbank/checkout-quote
VITE_N8N_CREATE_WEIGHING_ORDER_URL=https://SEU-N8N/webhook/pagbank/create-weighing-order
VITE_N8N_CREATE_PAYMENT_URL=https://SEU-N8N/webhook/pagbank/create-payment
VITE_PAGBANK_PUBLIC_KEY=SUA_CHAVE_PUBLICA_PAGBANK
```

A chave PagBank acima é a chave pública de cartão. Não coloque `PAGBANK_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` ou qualquer segredo no `.env` do Vite, pois variáveis `VITE_` são entregues ao navegador.

## Ordem de instalação

1. Execute os SQLs da entrega `pagbank-supabase-sql.zip`, na ordem indicada.
2. Importe e configure os workflows de `pagbank-n8n-workflows.zip`.
3. Publique os workflows e copie as URLs de produção para `.env.local`.
4. Obtenha a chave pública de cartão do mesmo ambiente PagBank usado pelo n8n.
5. Execute o aplicativo.

## Execução local

```bash
npm install
npm run dev
```

Para validar a versão de produção:

```bash
npm run build
```

## Regras importantes

- Use todas as credenciais de Sandbox juntas durante os testes: token, chave pública e URL base de Sandbox.
- Em produção, troque todo o conjunto para produção; não misture ambientes.
- O cartão está limitado a 1 parcela nesta entrega. Parcelamento deve ser habilitado somente depois de implementar a consulta/apresentação das condições comerciais reais da conta.
- O resultado síncrono do PagBank não libera o pedido. A confirmação definitiva é o webhook autenticado, persistido pelo n8n e aplicado atomicamente no Supabase.
- Não altere as políticas RLS ou os triggers financeiros sem preservar o bloqueio de alterações financeiras pelo cliente.
