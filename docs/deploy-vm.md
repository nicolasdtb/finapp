# Guia de Deploy na VM Linux

Este guia contem todos os comandos necessarios para subir a aplicacao na VM Linux recem-criada.

---

## Passo 1: Preparar o Git e Subir o Codigo (No seu PC)
Se ainda nao enviou para o GitHub/GitLab:
```bash
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

---

## Passo 2: Preparar a VM Linux (Ubuntu/Debian)

Abra o terminal SSH da sua VM e instale o Git e o Docker:

```bash
# Atualizar repositorios
sudo apt update && sudo apt upgrade -y

# Instalar Git e Curl
sudo apt install -y git curl

# Instalar Docker e Docker Compose via script oficial
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker
```

---

## Passo 3: Configurar o ZeroTier na VM

```bash
# Instalar ZeroTier
curl -s https://install.zerotier.com | sudo bash

# Entrar na sua rede ZeroTier
sudo zerotier-cli join SEU_NETWORK_ID_AQUI
```
*Lembre-se de entrar no painel my.zerotier.com e marcar a opcao **Auth** para autorizar a VM.*
*Anote o IP do ZeroTier atribuido a VM (ex: `10.147.17.50`).*

---

## Passo 4: Clonar e Subir a Aplicacao

```bash
# Clonar o projeto
git clone https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git finapp
cd finapp

# Iniciar todos os conteineres (PostgreSQL, Backend e Frontend)
docker compose up -d --build
```

---

## Passo 5: Testar o Acesso

Com o ZeroTier conectado no seu Celular e no seu PC:
- **PWA no Celular e PC:** `http://IP_DO_ZEROTIER:3000`
- **Backend API:** `http://IP_DO_ZEROTIER:3001/health`
- **DBeaver no PC:** Conectar em `IP_DO_ZEROTIER:5432`
