# Guia de Captura Automática de Notificações Bancárias (Android)

Este guia explica como configurar o **Automate (LlamaLab)** para capturar notificações bancárias no Android e enviá-las para o FinApp via webhook, inclusive **com fila offline** para quando você estiver fora da VPN (ZeroTier).

---

## Como Funciona a Integração

Sempre que uma compra no cartão de crédito/débito ou transferência Pix é realizada, o aplicativo do seu banco emite uma notificação no Android. O Automate captura essa notificação e dispara um webhook para a sua VM Linux via ZeroTier (`https://finapp.zt`).

O FinApp extrai o **valor** e o **estabelecimento**, vincula à conta correspondente e coloca o gasto como **Pendente de Confirmação** no topo do Dashboard para você categorizar e aprovar com 1 toque!

---

## Fluxo com Fila Offline (Recomendado)

Como a VM só é acessível via VPN, o fluxo salva as notificações num arquivo local quando você estiver offline. Quando a VPN conectar e uma nova notificação chegar, o Automate envia tudo em lote e limpa a fila.

> **Importante:** O Automate não tem funções como `arrayConcat` ou `listAdd` em expressões inline. A fila é construída manipulando a string JSON diretamente usando concatenação de texto.

### Lógica de Construção da Fila (string JSON)

A fila é um arquivo de texto com um array JSON. Cada nova notificação é inserida com a seguinte lógica:

- **Fila vazia** (`""` ou `"[]"`): escreve `[{...nova notificação...}]`
- **Fila com itens**: remove o `]` final, adiciona `,{...nova notificação...}]`

Isso é feito com concatenação de string sem precisar de nenhuma função especial.

---

### Blocos do Fluxo no Automate

Crie um novo fluxo (+) e adicione os seguintes blocos em sequência:

---

#### Bloco 1 — Gatilho: `Notification posted?`
| Campo | Valor |
|-------|-------|
| Package name | Selecione os apps dos bancos (ex: `com.nu.production`) |
| Output → Title | `not_title` |
| Output → Message/Text | `not_text` |
| Output → Package name | `not_app` |

Conecte a saída **Notification posted** ao próximo bloco.

---

#### Bloco 2 — `File read text` (lê a fila atual)
| Campo | Valor |
|-------|-------|
| File | `/storage/emulated/0/Download/finapp_queue.txt` |
| Output variable | `queue_content` |

> Se o arquivo não existir ainda, `queue_content` ficará vazio (`""`). O próximo bloco trata isso.

---

#### Bloco 3 — `Variable set` (monta o novo item JSON)
| Campo | Valor |
|-------|-------|
| Variable | `new_item` |
| Value | `jsonEncode({"app_name": not_app, "title": not_title, "text": not_text})` |

O Automate suporta dicionários literais `{chave: valor}` nas expressões, então o `jsonEncode` converte isso para uma string JSON sem precisar de nenhuma aspa escapada com `\`.

---

#### Bloco 4 — `Variable set` (anexa o item na fila)
| Campo | Valor |
|-------|-------|
| Variable | `updated_queue` |
| Value | `(queue_content = "" \| queue_content = "[]") ? "[" & new_item & "]" : substring(queue_content, 0, length(queue_content) - 1) & "," & new_item & "]"` |

**Explicação da expressão:**
- Se a fila está vazia → cria `[{novo_item}]`
- Se já tem itens → remove o `]` final com `substring(..., length-1)` e adiciona `,{novo_item}]`

---

#### Bloco 5 — `File write text` (salva a fila no arquivo)
| Campo | Valor |
|-------|-------|
| File | `/storage/emulated/0/Download/finapp_queue.txt` |
| Text | `updated_queue` |
| Append | **NÃO** (sobrescreve o arquivo inteiro) |

---

#### Bloco 6 — `Host address resolve` (checa se a VPN está ativa)
| Campo | Valor |
|-------|-------|
| Hostname | `finapp.zt` |
| Output variable | `resolved_ip` |

- **Resolveu (YES / não-vazio)** → vai para o **Bloco 7**
- **Não resolveu (NO / vazio)** → volta direto para o **Bloco 1** (fica na fila e aguarda)

> Alternativa: use o bloco **Ping** apontando para `172.23.17.157` se preferir verificar por IP.

---

#### Bloco 7 — `HTTP request` (envia a fila completa)
| Campo | Valor |
|-------|-------|
| Request URL | `https://finapp.zt/api/v1/webhooks/bank-notification` |
| Method | `POST` |
| Content type | `JSON` |
| Request content | `updated_queue` |
| Output → Status code | `http_status` |

O FinApp aceita tanto um objeto único `{...}` quanto um array `[{...},{...}]`.

---

#### Bloco 8 — `Expression true?` (verifica sucesso)
| Campo | Valor |
|-------|-------|
| Formula | `http_status = 201` |

- **YES (201)** → vai para o **Bloco 9** (limpa a fila)
- **NO (erro)** → volta para o **Bloco 1** (itens ficam na fila para a próxima tentativa)

---

#### Bloco 9 — `File write text` (esvazia a fila após envio com sucesso)
| Campo | Valor |
|-------|-------|
| File | `/storage/emulated/0/Download/finapp_queue.txt` |
| Text | `[]` |

Depois deste bloco, conecte de volta ao **Bloco 1** para fechar o loop.

---

### Diagrama do Fluxo

```
[Bloco 1: Notification posted?]
         |
[Bloco 2: File read text] ← lê fila atual
         |
[Bloco 3: Variable set] ← monta new_item como JSON string
         |
[Bloco 4: Variable set] ← anexa na fila (concatenação de string)
         |
[Bloco 5: File write text] ← salva fila no arquivo
         |
[Bloco 6: Host address resolve finapp.zt]
    NO ↙       ↘ YES
[Bloco 1]   [Bloco 7: HTTP request POST fila]
                 |
         [Bloco 8: http_status = 201?]
         NO ↙         ↘ YES
      [Bloco 1]   [Bloco 9: File write "[]"]
                         |
                     [Bloco 1]
```

---

## Comandos de Teste do Webhook

Teste o webhook diretamente do terminal da VM ou PowerShell:

### Notificação única (objeto JSON)
```bash
curl -k -X POST https://finapp.zt/api/v1/webhooks/bank-notification \
  -H "Content-Type: application/json" \
  -d '{"app_name": "Nubank", "title": "Compra aprovada", "text": "Compra de R$ 68,40 aprovada em Supermercado Extra"}'
```

### Lote de notificações (array JSON — simula envio da fila offline)
```bash
curl -k -X POST https://finapp.zt/api/v1/webhooks/bank-notification \
  -H "Content-Type: application/json" \
  -d '[
    {"app_name": "Nubank", "title": "Compra aprovada", "text": "Compra de R$ 68,40 aprovada em Supermercado Extra"},
    {"app_name": "Nubank", "title": "Compra no débito", "text": "Você pagou R$ 15,00 no débito em Padaria Santo Pão"},
    {"app_name": "Inter", "title": "Compra confirmada", "text": "Compra no cartão de crédito de R$ 89,90 aprovada em Posto Ipiranga"}
  ]'
```

### Outros exemplos
```bash
# Compra por aproximação
curl -k -X POST https://finapp.zt/api/v1/webhooks/bank-notification \
  -H "Content-Type: application/json" \
  -d '{"app_name": "Nubank", "title": "Compra aprovada", "text": "Compra por aproximação de R$ 32,50 no Restaurante Sabor Brasil"}'

# Transferência Pix enviada
curl -k -X POST https://finapp.zt/api/v1/webhooks/bank-notification \
  -H "Content-Type: application/json" \
  -d '{"app_name": "Nubank", "title": "Transferência enviada", "text": "Você transferiu R$ 120,00 para Maria da Silva"}'
```

---

## O que acontece após o envio

O FinApp responderá com `201 Created`:
```json
{
  "success": true,
  "message": "Transação capturada com sucesso!",
  "transaction": { "description": "Supermercado Extra", "amount": "68.40", "statusId": 2 }
}
```

Ao abrir o **FinApp** (`https://finapp.zt`), o banner amarelo piscando no topo do Dashboard mostrará as compras pendentes para você categorizar e aprovar com 1 toque!