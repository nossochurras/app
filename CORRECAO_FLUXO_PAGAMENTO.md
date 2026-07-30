# Correção do fluxo de pedidos aguardando pagamento

## Causa encontrada

O status `awaiting_payment` era usado em dois momentos diferentes:

1. após a pesagem, antes de o cliente escolher PIX, cartão ou pagamento local;
2. depois que o meio de pagamento já tinha sido escolhido e a cobrança já estava aguardando confirmação.

A tela `Meus Pedidos` não diferenciava esses momentos. Nos pedidos com pesagem, qualquer pedido `awaiting_payment` exibia `Ir para Pagamento`; nos demais pedidos online, exibia `Continuar pagamento`. Ambos executavam `onGoToCheckout`, que sempre definia `view = 'checkout'` e voltava à seleção da forma de pagamento.

## Comportamento corrigido

- Pedido sem método/cobrança criada: abre o checkout para escolher a forma de pagamento.
- PIX já criado: abre a tela de acompanhamento do PIX e recupera QR Code/copia e cola quando disponíveis.
- Cartão já enviado: abre a tela de confirmação/análise.
- Pagamento na retirada já escolhido: abre a tela `Aguardando pagamento na retirada`.
- Cobrança existente sem método identificável, mas com referência PagBank: abre uma tela genérica de acompanhamento, evitando duplicar a cobrança.
- A sessão é salva no `localStorage` por pedido para sobreviver à navegação e à reabertura do app no mesmo dispositivo.
- Quando o pagamento é confirmado, a sessão salva daquele pedido é removida.

## Arquivos alterados

- `src/App.tsx`
- `src/components/PaymentStatusScreen.tsx`
- `src/lib/checkoutApi.ts`
- `src/lib/orderPayment.ts` (novo)

## Validações realizadas

- Transpilação sintática de todos os arquivos `.ts` e `.tsx` executáveis.
- Testes de rota para:
  - pedido apenas pesado, ainda sem pagamento;
  - PIX aguardando confirmação;
  - pagamento local aguardando atendente;
  - cobrança PagBank com método ausente;
  - gravação, leitura e remoção da sessão recuperável.

O ambiente de análise não conseguiu baixar integralmente as dependências do npm por indisponibilidade de pacotes no espelho utilizado. Por isso, o comando completo `npm run build` deve ser executado no ambiente normal de deploy, onde o Dockerfile já faz `npm install` e `npm run build`.
