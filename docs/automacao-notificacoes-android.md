# Guia de Captura Automática de Notificações Bancárias (Android)

Este guia explica como configurar o **Automate (LlamaLab)** para capturar notificações bancárias no Android e enviá-las para o FinApp via webhook, com **fila offline** para quando você estiver fora da VPN (ZeroTier).

---

## Como Funciona a Integração

Sempre que uma compra no cartão de crédito/débito ou transferência Pix é realizada, o aplicativo do seu banco emite uma notificação no Android. O Automate captura essa notificação e dispara um webhook para a sua VM Linux via ZeroTier (`https://finapp.zt`).

O FinApp extrai o **valor** e o **estabelecimento**, vincula à conta correspondente e coloca o gasto como **Pendente de Confirmação** no Dashboard para você aprovar com 1 toque!

---

## Funções suportadas no Automate (expressões)

> Antes de montar o fluxo, é importante saber o que **funciona de verdade** nas expressões do Automate:
>
> ✅ `jsonEncode(dict)` — converte um dicionário em string JSON  
> ✅ `jsonDecode(string)` — converte string JSON em dicionário  
> ✅ Concatenação com `&` — ex: `"[" & variavel & "]"`  
> ✅ Operador ternário `? :` — ex: `x = "" ? "sim" : "nao"`  
> ✅ Comparações: `=`, `≠`, `<`, `>`, `≤`, `≥`  
> ❌ `substring()` — **não existe**  
> ❌ `length()` — **não existe**  
> ❌ `arrayConcat()` — **não existe**  
> ❌ `replace()` — **não existe**

---

## Estratégia da Fila Offline

O arquivo de fila armazena as notificações separadas por vírgula (sem colchetes):

```
{"app_name":"...","title":"...","text":"..."},{"app_name":"...","title":"...","text":"..."}
```

- **Fila vazia** → grava `new_item` em modo overwrite
- **Fila com itens** → grava `"," & new_item` em modo **APPEND** (sem precisar de substring!)
- **Na hora de enviar** → HTTP body = `"[" & queue_content & "]"` (só concatenação com `&`)

Dessa forma, nenhuma função de string avançada é necessária.

---

## Blocos do Fluxo no Automate

Crie um novo fluxo (+) com **11 blocos** em sequência. Todos os nomes estão conforme o menu do Automate.

---

### Bloco 1 — `Notification posted?`
| Campo | Valor |
|-------|-------|
| Package name | Selecione os apps dos bancos (ex: `com.nu.production`) |
| Output → Title | `not_title` |
| Output → Message/Text | `not_text` |
| Output → Package name | `not_app` |

→ Saída **Notification posted** vai para o **Bloco 2**.

---

### Bloco 2 — `File read text` (lê a fila atual)
| Campo | Valor |
|-------|-------|
| File | `/storage/emulated/0/Download/finapp_queue.txt` |
| Output variable | `queue_content` |

→ Se o arquivo não existir ainda, `queue_content` fica vazio (`""`). Vai para o **Bloco 3**.

---

### Bloco 3 — `Variable set` (monta o JSON do item)
| Campo | Valor |
|-------|-------|
| Variable | `new_item` |
| Value | `jsonEncode({"app_name": not_app, "title": not_title, "text": not_text})` |

→ Vai para o **Bloco 4**.

---

### Bloco 4 — `Expression true?` (fila está vazia?)
| Campo | Valor |
|-------|-------|
| Formula | `queue_content = ""` |

- **YES (vazia)** → vai para o **Bloco 5**
- **NO (já tem itens)** → vai para o **Bloco 6**

---

### Bloco 5 — `File write text` (cria fila com primeiro item)
| Campo | Valor |
|-------|-------|
| File | `/storage/emulated/0/Download/finapp_queue.txt` |
| Text | `new_item` |
| Append | **NÃO** (sobrescreve) |

→ Vai para o **Bloco 7**.

---

### Bloco 6 — `File write text` (adiciona item na fila)
| Campo | Valor |
|-------|-------|
| File | `/storage/emulated/0/Download/finapp_queue.txt` |
| Text | `"," & new_item` |
| Append | **SIM** (adiciona ao final) |

→ Vai para o **Bloco 7**.

---

### Bloco 7 — `File read text` (relê a fila completa)
| Campo | Valor |
|-------|-------|
| File | `/storage/emulated/0/Download/finapp_queue.txt` |
| Output variable | `queue_content` |

→ Vai para o **Bloco 8**.

---

### Bloco 8 — `Host address resolve` (checa se a VPN está ativa)
| Campo | Valor |
|-------|-------|
| Hostname | `finapp.zt` |
| Output variable | `resolved_ip` |

- **Não resolveu (vazio)** → volta para o **Bloco 1** (fica na fila, aguarda VPN)
- **Resolveu** → vai para o **Bloco 9**

> Alternativa: use o bloco **Ping** com o IP `172.23.17.157` se preferir verificar por IP direto.

---

### Bloco 9 — `HTTP request` (envia a fila completa)
| Campo | Valor |
|-------|-------|
| Request URL | `https://finapp.zt/api/v1/webhooks/bank-notification` |
| Method | `POST` |
| Content type | `JSON` |
| Request content | `"[" & queue_content & "]"` |
| Output → Status code | `http_status` |

O FinApp aceita tanto objeto único `{...}` quanto array `[{...},{...}]`.

→ Vai para o **Bloco 10**.

---

### Bloco 10 — `Expression true?` (envio foi bem-sucedido?)
| Campo | Valor |
|-------|-------|
| Formula | `http_status = 201` |

- **YES (201)** → vai para o **Bloco 11** (limpa a fila)
- **NO (erro/offline)** → volta para o **Bloco 1** (itens ficam na fila)

---

### Bloco 11 — `File write text` (esvazia a fila após sucesso)
| Campo | Valor |
|-------|-------|
| File | `/storage/emulated/0/Download/finapp_queue.txt` |
| Text | *(deixar em branco)* |
| Append | **NÃO** (sobrescreve com vazio) |

→ Volta para o **Bloco 1** (loop contínuo de escuta).

---

## Diagrama do Fluxo

```
[1: Notification posted?]
         |
[2: File read text] ← lê fila
         |
[3: Variable set] ← new_item = jsonEncode({...})
         |
[4: Expression: queue_content = ""?]
   YES ↙         ↘ NO
[5: File write]  [6: File write APPEND]
  overwrite        "," & new_item
        ↘        ↙
     [7: File read text] ← relê fila completa
              |
[8: Host address resolve finapp.zt]
   Vazio ↙           ↘ Resolveu
[Bloco 1]     [9: HTTP POST "[" & queue_content & "]"]
                        |
              [10: http_status = 201?]
          NO ↙               ↘ YES
       [Bloco 1]        [11: File write vazio]
                                  |
                             [Bloco 1]
```

---

## Comandos de Teste do Webhook

### Notificação única
```bash
curl -k -X POST https://finapp.zt/api/v1/webhooks/bank-notification \
  -H "Content-Type: application/json" \
  -d '{"app_name": "Nubank", "title": "Compra aprovada", "text": "Compra de R$ 68,40 aprovada em Supermercado Extra"}'
```

### Lote (simula envio da fila offline)
```bash
curl -k -X POST https://finapp.zt/api/v1/webhooks/bank-notification \
  -H "Content-Type: application/json" \
  -d '[
    {"app_name": "Nubank", "title": "Compra aprovada", "text": "Compra de R$ 68,40 aprovada em Supermercado Extra"},
    {"app_name": "Nubank", "title": "Compra no débito", "text": "Você pagou R$ 15,00 no débito em Padaria Santo Pão"}
  ]'
```

### Outros exemplos
```bash
# Pix enviado
curl -k -X POST https://finapp.zt/api/v1/webhooks/bank-notification \
  -H "Content-Type: application/json" \
  -d '{"app_name": "Nubank", "title": "Transferência enviada", "text": "Você transferiu R$ 120,00 para Maria da Silva"}'

# Banco Inter
curl -k -X POST https://finapp.zt/api/v1/webhooks/bank-notification \
  -H "Content-Type: application/json" \
  -d '{"app_name": "Inter", "title": "Compra confirmada", "text": "Compra no cartão de crédito de R$ 89,90 aprovada em Posto Ipiranga"}'
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

Ao abrir o **FinApp** (`https://finapp.zt`), o banner amarelo no topo do Dashboard mostrará as compras pendentes para categorizar e aprovar!