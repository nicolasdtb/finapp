# Guia de Captura Automática de Notificações Bancárias (Android)

Este guia apresenta as **melhores alternativas 100% gratuitas e de código aberto** para substituir o MacroDroid e capturar notificações bancárias no Android sem pagar nada.

---

## 1. Como Funciona a Integração
Sempre que uma compra no cartão de crédito/débito ou transferência Pix é realizada, o aplicativo do seu banco emite uma notificação no Android. O aplicativo de automação captura essa notificação e dispara um webhook seguro diretamente para a sua VM Linux via ZeroTier (`https://finapp.zt`).

O FinApp analisa o texto, extrai o **valor** e o **estabelecimento**, vincula à sua conta correspondente e coloca o gasto como **Pendente de Confirmação** no topo do seu Dashboard para você categorizar e aprovar com 1 toque!

---

## Opção 1: Automate (LlamaLab) — Recomendado (Gratuito na Play Store)
O **Automate** é moderno, 100% gratuito na Play Store e usa blocos visuais de fluxo (flowcharts). A versão gratuita permite até 30 blocos por fluxo (nossa automação usa apenas 3 blocos!).

### Passo a Passo no Automate:
1. Instale o **Automate** na Play Store (ícone de engrenagens/labirinto azul).
2. Abra o app e toque no botão **+** para criar um novo fluxo.
3. No painel de blocos:
   - Adicione o bloco **Apps** -> **Notification posted?** (Gatilho quando chega notificação).
     - Toque nele para editar:
       - **Package name**: deixe em branco ou selecione os apps dos seus bancos (`com.nu.production`, etc.).
       - Em **Output variables**:
         - **Title**: digite `not_title`
         - **Message / Text**: digite `not_text`
         - **Package name**: digite `not_app`
   - Conecte a saída "YES" desse bloco ao próximo bloco:
   - Adicione o bloco **Connectivity** -> **HTTP request**:
     - **Request URL:** `https://finapp.zt/api/v1/webhooks/bank-notification` (ou `https://172.23.17.157/api/v1/webhooks/bank-notification`)
     - **Request method:** `POST`
     - **Request content type:** `JSON`
     - **Request content:**
       ```json
       {
         "app_name": "Nubank",
         "title": not_title,
         "text": not_text
       }
       ```
   - Conecte a saída do bloco HTTP de volta na entrada do bloco de notificação (criando um loop contínuo de escuta).
4. Salve com o nome **FinApp Notificações** e clique em **Start**.

---

## 2. Comandos de Teste do Webhook (Cenários Reais do Nubank e Bancos)

Você pode simular e testar todos os tipos de notificações bancárias diretamente do terminal da sua VM Linux ou pelo PowerShell/Prompt do Windows (usando `curl`):

### Teste 1: Compra no Cartão de Crédito Nubank
```bash
curl -k -X POST https://finapp.zt/api/v1/webhooks/bank-notification \
  -H "Content-Type: application/json" \
  -d '{"app_name": "Nubank", "title": "Compra aprovada", "text": "Compra de R$ 68,40 aprovada em Supermercado Extra"}'
```

### Teste 2: Compra no Débito Nubank
```bash
curl -k -X POST https://finapp.zt/api/v1/webhooks/bank-notification \
  -H "Content-Type: application/json" \
  -d '{"app_name": "Nubank", "title": "Compra no débito", "text": "Você pagou R$ 15,00 no débito em Padaria Santo Pão"}'
```

### Teste 3: Compra por Aproximação (Contactless)
```bash
curl -k -X POST https://finapp.zt/api/v1/webhooks/bank-notification \
  -H "Content-Type: application/json" \
  -d '{"app_name": "Nubank", "title": "Compra aprovada", "text": "Compra por aproximação de R$ 32,50 no Restaurante Sabor Brasil"}'
```

### Teste 4: Transferência Pix Enviada
```bash
curl -k -X POST https://finapp.zt/api/v1/webhooks/bank-notification \
  -H "Content-Type: application/json" \
  -d '{"app_name": "Nubank", "title": "Transferência enviada", "text": "Você transferiu R$ 120,00 para Maria da Silva"}'
```

### Teste 5: Notificação do Banco Inter
```bash
curl -k -X POST https://finapp.zt/api/v1/webhooks/bank-notification \
  -H "Content-Type: application/json" \
  -d '{"app_name": "Inter", "title": "Compra confirmada", "text": "Compra no cartão de crédito de R$ 89,90 aprovada em Posto Ipiranga"}'
```

---

## 3. O que acontece após disparar o comando:
1. O FinApp responderá com `201 Created`:
   ```json
   {
     "success": true,
     "message": "Transação capturada com sucesso!",
     "transaction": { "description": "Supermercado Extra", "amount": "68.40", "statusId": 2 }
   }
   ```
2. Ao abrir o **FinApp** (`https://finapp.zt`), você verá imediatamente o banner amarelo piscando no topo do Dashboard com o aviso de compras pendentes para revisar e aprovar!