# CodeMaster — Backend API

## Arrancar em 4 passos

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar o .env
```bash
cp .env.example .env
```
Abre o `.env` e preenche obrigatoriamente:
- `DATABASE_URL` — URL do PostgreSQL local ou Render
- `JWT_SECRET` — qualquer string longa e aleatória

### 3. Criar tabelas + dados iniciais
```bash
node scripts/setup.js
```

### 4. Criar o teu admin
Edita `scripts/create-admin.js` (nome, email, senha) e corre:
```bash
node scripts/create-admin.js
```

### 5. Arrancar
```bash
npm run dev      # desenvolvimento (auto-reload)
npm start        # produção
```

---

## Rotas disponíveis

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/api/auth/login` | ❌ | Login |
| GET | `/api/auth/me` | ✅ | Dados do utilizador |
| POST | `/api/inscricoes` | ❌ | Nova inscrição (landing page) |
| GET | `/api/alunos/progresso` | ✅ aluno | Progresso do aluno |
| POST | `/api/alunos/progresso` | ✅ aluno | Marcar tópico |
| GET | `/api/pagamento/info` | ❌ | Dados bancários do .env |
| GET | `/api/admin/metricas` | ✅ admin | Métricas gerais |
| GET | `/api/admin/inscricoes` | ✅ admin | Listar inscrições |
| PATCH | `/api/admin/inscricoes/:id/confirmar` | ✅ admin | Confirmar + criar aluno |
| GET | `/api/admin/alunos` | ✅ admin | Listar alunos com progresso |
| POST | `/api/admin/alunos` | ✅ admin | Criar aluno manualmente |
| GET | `/api/health` | ❌ | Health check |

---

## Fluxo completo de inscrição

```
1. Aluno preenche formulário → POST /api/inscricoes
   └── Resposta: dados bancários + link WhatsApp pré-preenchido

2. Aluno envia comprovativo via WhatsApp (+244 943 526 836)

3. Admin confirma no painel → PATCH /api/admin/inscricoes/:id/confirmar
   └── Cria conta do aluno com senha temporária
   └── Resposta: { senhaTemporaria: "XYZ123" }

4. Admin envia senha ao aluno via WhatsApp

5. Aluno entra em /login com email + senha temporária
```
