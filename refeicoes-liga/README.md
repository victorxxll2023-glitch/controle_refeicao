# 🍽 Sistema de Controle de Refeições Hospitalares

> Sistema web profissional para registro diário de refeições de colaboradores, desenvolvido para a **Liga Norte-Riograndense Contra o Câncer — CECAN**.

---

## 📋 Sobre o Projeto

### O problema

O refeitório do CECAN registrava as refeições dos colaboradores em **planilhas manuais de papel**, um processo lento, sujeito a erros de escrita, difícil de consultar historicamente e que gerava retrabalho na geração de relatórios semanais.

### A solução

Um sistema web otimizado para uso em **tablet na entrada do refeitório**, permitindo que um funcionário registre presenças rapidamente por nome, matrícula ou **leitura de QR Code**, com dados armazenados em tempo real na nuvem e relatórios gerados automaticamente.

---

## ✨ Funcionalidades

| Módulo | Descrição |
|--------|-----------|
| 🔐 **Login seguro** | Autenticação via Firebase Auth (email/senha) |
| 🍽 **Registro diário** | Busca instantânea, marcação com 1 toque, anti-duplicidade |
| 📷 **QR Code** | Leitura por câmera do tablet para marcação automática |
| 👤 **Cadastro** | Adicionar, editar e excluir funcionários |
| 📊 **Relatórios** | Geração automática semanal/mensal com download em CSV e PDF |
| 🕐 **Histórico** | Consulta de todos os dias que cada colaborador almoçou |
| 🌙 **Modo escuro/claro** | Alternância de tema salva no dispositivo |
| 💾 **Backup** | Exportar/importar todos os dados em JSON |
| 📶 **Offline parcial** | Firebase Persistence mantém dados em cache local |

---

## 🖥 Demonstração das Telas

```
index.html   → Página de login
app.html     → Tela principal (uso diário no tablet)
admin.html   → Painel administrativo completo
```

---

## 🛠 Tecnologias Utilizadas

- **Frontend:** HTML5, CSS3 e JavaScript puro (sem frameworks)
- **Banco de dados:** Firebase Firestore (NoSQL, tempo real)
- **Autenticação:** Firebase Authentication
- **Hospedagem:** GitHub Pages
- **Geração de PDF:** jsPDF + jsPDF-AutoTable
- **Scanner QR:** Html5-QRCode
- **Gerador QR:** QRCodeJS
- **Fontes:** Syne (títulos) + DM Sans (corpo) — Google Fonts

---

## 🚀 Como Configurar e Publicar

### 1. Criar o projeto Firebase

1. Acesse [console.firebase.google.com](https://console.firebase.google.com)
2. Clique em **"Criar projeto"** → dê um nome (ex: `cecan-refeicoes`)
3. Desative o Google Analytics (opcional) → **Criar projeto**

### 2. Configurar o Firestore

1. No menu lateral, clique em **Firestore Database**
2. Clique em **"Criar banco de dados"**
3. Escolha **"Iniciar no modo de produção"** → Selecione a região `southamerica-east1` (São Paulo)
4. Vá em **Regras** e cole o conteúdo do arquivo `firestore.rules`
5. Clique em **Publicar**

### 3. Configurar a Autenticação

1. No menu lateral, clique em **Authentication**
2. Clique em **"Começar"**
3. Ative o provedor **"E-mail/senha"**
4. Vá em **Usuários** → **"Adicionar usuário"**
5. Cadastre o e-mail e senha do responsável pelo sistema

### 4. Obter as credenciais do Firebase

1. Vá em ⚙ **Configurações do projeto** (ícone de engrenagem)
2. Role até **"Seus apps"** → clique em **"Adicionar app"** → escolha **Web** (`</>`)
3. Dê um apelido (ex: `cecan-web`) e clique em **Registrar app**
4. Copie o objeto `firebaseConfig` exibido

### 5. Configurar o arquivo `js/config.js`

Abra o arquivo `js/config.js` e substitua os valores:

```javascript
const firebaseConfig = {
  apiKey:            "SUA_API_KEY",
  authDomain:        "seu-projeto.firebaseapp.com",
  projectId:         "seu-projeto",
  storageBucket:     "seu-projeto.appspot.com",
  messagingSenderId: "000000000000",
  appId:             "1:000000000000:web:xxxxxxxxxxxx"
};
```

### 6. Publicar no GitHub Pages

```bash
# 1. Crie um repositório no GitHub (ex: cecan-refeicoes)

# 2. Clone e suba os arquivos
git init
git add .
git commit -m "feat: sistema de controle de refeições CECAN"
git remote add origin https://github.com/SEU_USUARIO/cecan-refeicoes.git
git push -u origin main

# 3. Ative o GitHub Pages
# GitHub → Settings → Pages → Source: "Deploy from branch" → main / (root)
```

O sistema estará disponível em:
```
https://SEU_USUARIO.github.io/cecan-refeicoes/
```

### 7. Autorizar o domínio no Firebase

1. No Firebase → **Authentication → Settings → Domínios autorizados**
2. Adicione: `seu-usuario.github.io`

---

## 📱 Uso no Tablet

### Configuração recomendada

- **Dispositivo:** Tablet Android (8" ou maior)
- **Navegador:** Google Chrome (versão atualizada)
- **Orientação:** Paisagem ou retrato — ambos funcionam

### Adicionar à tela inicial (modo app)

1. Abra o Chrome no tablet
2. Acesse a URL do sistema
3. Toque no menu (⋮) → **"Adicionar à tela inicial"**
4. O sistema abrirá como aplicativo nativo

### Uso diário

1. Abra o sistema → faça login (o Chrome salva as credenciais)
2. Na tela principal (`app.html`):
   - **Digite** nome ou matrícula na busca
   - **Toque** em "✓ Marcar" para registrar
   - Ou use o **botão ▣** (canto inferior direito) para escanear QR Code

---

## 📁 Estrutura do Projeto

```
cecan-refeicoes/
├── index.html          # Página de login
├── app.html            # Tela de registro diário (tablet)
├── admin.html          # Painel administrativo
├── firestore.rules     # Regras de segurança Firebase
├── css/
│   └── style.css       # Design system completo
├── js/
│   ├── config.js       # Configuração Firebase (⚠ editar)
│   ├── auth.js         # Autenticação
│   ├── database.js     # Operações Firestore (CRUD)
│   ├── utils.js        # Utilitários (datas, toast, helpers)
│   ├── reports.js      # Geração CSV e PDF
│   ├── daily.js        # Lógica da tela diária
│   └── admin.js        # Lógica do painel admin
└── README.md
```

---

## 🗂 Estrutura do Banco de Dados

### Coleção `employees`
```json
{
  "id": "auto-gerado",
  "name": "João da Silva",
  "matricula": "12345",
  "setor": "Enfermagem",
  "createdAt": "timestamp"
}
```

### Coleção `attendance`
```json
{
  "id": "2025-01-15_12345",
  "employeeId": "abc123",
  "name": "João da Silva",
  "matricula": "12345",
  "setor": "Enfermagem",
  "date": "2025-01-15",
  "time": "12:07",
  "timestamp": "serverTimestamp"
}
```

> O ID do registro de presença é composto por `data_matrícula`, o que **impede duplicidades** naturalmente no Firestore.

---

## 📊 Relatórios

O sistema gera automaticamente relatórios para:

- **Semana atual** (segunda a sexta)
- **Semana anterior**
- **Mês atual**

Cada relatório contém: Nome · Matrícula · Setor · Total de refeições · Datas

**Formatos de download:**
- 📄 **CSV** — compatível com Excel e LibreOffice Calc
- 📑 **PDF** — com cabeçalho institucional, tabela formatada e rodapé

---

## 🔐 Segurança

- Acesso restrito por autenticação Firebase
- Regras do Firestore bloqueiam leitura/escrita sem login
- Domínios autorizados configurados no Firebase Auth
- Dados trafegam via HTTPS (Firebase + GitHub Pages)
- Nenhuma credencial exposta no código (apenas config pública do Firebase)

---

## 🔄 Backup e Recuperação

- **Exportar:** Painel Admin → Backup → Exportar JSON
- **Importar:** Painel Admin → Backup → Importar JSON
- Os dados são mesclados (não substituídos) na importação

---

## 👨‍💻 Desenvolvimento

Projeto desenvolvido com foco em:

- **Usabilidade em tablet** — botões grandes, busca instantânea, feedback visual imediato
- **Performance** — listeners em tempo real do Firestore, sem recarregamentos
- **Código limpo** — módulos separados, comentários em português, sem dependências desnecessárias
- **Custo zero** — Firebase free tier (Spark) suporta uso hospitalar de pequeno/médio porte

---

## 📜 Licença

Desenvolvido para uso interno da Liga Norte-Riograndense Contra o Câncer — CECAN.  
Uso, adaptação e redistribuição permitidos com atribuição.

---

*Sistema de Controle de Refeições Hospitalares · v1.0 · CECAN*
