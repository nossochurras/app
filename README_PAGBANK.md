# Aplicativo com checkout PagBank

## Configuração já aplicada

O projeto já contém, em `.env.production`:

- URL pública do Supabase;
- chave pública `anon` do Supabase;
- URL do workflow de cotação;
- URL do workflow de pedido para pesagem;
- URL do workflow de criação de pagamento.

O app não depende de uma URL própria para funcionar. Os endpoints do n8n aceitam o build web atual e um futuro aplicativo móvel, sempre exigindo o JWT válido do Supabase.

## Cartão

`VITE_PAGBANK_PUBLIC_KEY` permanece vazio porque essa chave é específica da sua conta e do ambiente PagBank. Enquanto ela estiver vazia:

- PIX continua disponível;
- pagamento na retirada continua disponível;
- cartão aparece desativado, sem provocar erro no checkout.

Quando gerar a chave pública de cartão no PagBank, preencha em `.env.production`:

```env
VITE_PAGBANK_PUBLIC_KEY=SUA_CHAVE_PUBLICA_PAGBANK
```

Essa é uma chave pública. Nunca coloque no app o token privado do PagBank ou a `service_role` do Supabase.

## Build

```bash
npm install
npm run lint
npm run build
```

O resultado para hospedagem ficará em `dist/`.

## URLs usadas

```text
https://n8nwebhook.solviaoficial.com/webhook/pagbank/checkout-quote
https://n8nwebhook.solviaoficial.com/webhook/pagbank/create-weighing-order
https://n8nwebhook.solviaoficial.com/webhook/pagbank/create-payment
```

## Correção de carregamento das URLs no modo de desenvolvimento

Este pacote inclui `.env`, `.env.development` e `.env.production`. O comando
`npm run dev` utiliza o modo `development`, enquanto `npm run build` utiliza o
modo `production`. Além disso, os três endpoints públicos do n8n possuem valores
padrão no código, evitando que o checkout seja bloqueado caso a plataforma de
hospedagem omita arquivos ocultos durante o upload.

Depois de substituir os arquivos, encerre o servidor Vite e execute novamente:

```bash
npm run dev
```
