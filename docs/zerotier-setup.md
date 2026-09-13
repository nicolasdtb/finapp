# Guia de Configuracao do ZeroTier na VM Linux

Para conectar o celular e o PC na VM sem precisar abrir portas de roteador:

## 1. Criar a Rede no ZeroTier
1. Acesse [my.zerotier.com](https://my.zerotier.com) e crie uma conta gratuita.
2. Clique em **Create A Network** e copie o **Network ID** (16 caracteres).

## 2. Instalar na VM Linux (Ubuntu/Debian)
```bash
curl -s https://install.zerotier.com | sudo bash
sudo zerotier-cli join SEU_NETWORK_ID_AQUI
```
3. Volte no painel do my.zerotier.com e marque a caixinha **Auth** para autorizar a VM.
4. Anote o IP atribuido a VM na coluna *Managed IPs* (ex: `10.147.17.50`).

## 3. Conectar Celular e PC
- **No Android:** Baixe o app *ZeroTier One* na Play Store, adicione o mesmo Network ID e conecte. Lembre-se de autorizar no painel web.
- **No Windows:** Baixe o client do ZeroTier, entre no Network ID e autorize.

## 4. Testar o App
Com o ZeroTier ativo, no navegador do celular ou PC acesse:
- Frontend: `http://10.147.17.50:3000`
- Backend API: `http://10.147.17.50:3001`
