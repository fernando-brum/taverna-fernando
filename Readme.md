# taverna-fernando

Sistema de gestão de marmitas — registro de pedidos, itens e entregas.

Projeto da disciplina Integração DevOps.

---

## Pré-requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e em execução
- Portas `3000` (app) e `3307` (banco) livres na máquina

---

## Subir o ambiente

```bash
docker compose up --build -d
```

| Flag | O que faz |
|------|-----------|
| `--build` | Reconstrói a imagem antes de subir (necessário após qualquer mudança de código) |
| `-d` | Sobe em background (detached) |

Aguarde a mensagem `MARMITATECH PRO ONLINE NA PORTA 3000` nos logs antes de acessar.

---

## Acessar a aplicação

Abra no navegador: **http://localhost:3000**

Credenciais padrão criadas automaticamente na primeira inicialização:

| Campo | Valor |
|-------|-------|
| Usuário | `admin` |
| Senha | `admin123` |

---

## Comandos essenciais

### Ver status dos containers
```bash
docker compose ps
```

### Ver logs em tempo real
```bash
docker compose logs -f
```

Somente do app:
```bash
docker compose logs -f app
```

### Derrubar os containers (mantém os dados do banco)
```bash
docker compose down
```

### Derrubar e apagar os dados do banco
```bash
docker compose down -v
```

> Use `-v` quando precisar recriar o banco do zero, por exemplo após mudanças no `init.sql`.

### Reiniciar somente o app (sem rebuild)
```bash
docker compose restart app
```

### Reconstruir e subir após mudança de código
```bash
docker compose up --build -d
```

---

## Executar os testes

Os testes rodam dentro do container do app. Copie os arquivos de teste e execute:

```bash
docker cp tests marmitatech-app:/app/
docker exec marmitatech-app node --test tests/app.test.js
docker exec marmitatech-app node --test tests/crypto.test.js
```

---

## Estrutura do projeto

```
taverna-fernando/
├── src/
│   ├── app.js          # Rotas Express (factory pattern)
│   ├── crypto.js       # Hash e verificação de senha (crypto nativo Node.js)
│   └── MSN-ICON.png    # Ícone da aplicação
├── views/
│   ├── login.ejs       # Tela de login
│   └── dashboard.ejs   # Dashboard principal
├── tests/
│   ├── app.test.js     # Testes das rotas HTTP
│   └── crypto.test.js  # Testes de hash e verificação de senha
├── index.js            # Entrypoint (conexão DB + start do servidor)
├── init.sql            # Schema e dados iniciais do banco
├── Dockerfile          # Build multi-stage da imagem
└── docker-compose.yml  # Orquestração app + banco
```

---

## Banco de dados

O MySQL roda internamente na porta `3306` (container) e é exposto na porta `3307` do host.

Para conectar com um cliente externo (ex: DBeaver, TablePlus):

| Parâmetro | Valor |
|-----------|-------|
| Host | `localhost` |
| Porta | `3307` |
| Banco | `marmitadb` |
| Usuário | `user` |
| Senha | `password` |

Para acessar o banco pelo terminal:

```bash
docker exec -it marmitatech-db mysql -u user -ppassword marmitadb
```

---

## Variáveis de ambiente

Configuradas no `docker-compose.yml`:

| Variável | Valor padrão |
|----------|-------------|
| `DB_HOST` | `db` |
| `DB_PORT` | `3306` |
| `DB_USER` | `user` |
| `DB_PASS` | `password` |
| `DB_NAME` | `marmitadb` |

---

## Pipeline CI/CD

O GitHub Actions executa automaticamente a cada push na branch `develop`:

1. **build** — verifica sintaxe do código
2. **lint** — ESLint
3. **test** — executa os testes com cobertura via c8 (mínimo 80%)
4. **sonar** — análise de qualidade e segurança no SonarQube
