// ============================================================
// js/config.js — Configuração do Firebase
// ⚠️  PREENCHA COM SUAS CREDENCIAIS DO FIREBASE
// ============================================================
// Como obter as credenciais:
// 1. Acesse https://console.firebase.google.com
// 2. Crie um projeto (ou acesse o existente)
// 3. Vá em Configurações do projeto → Seus apps → Web
// 4. Copie o objeto firebaseConfig e cole abaixo
// ============================================================

const firebaseConfig = {
  apiKey:            "COLE_AQUI_SUA_API_KEY",
  authDomain:        "seu-projeto.firebaseapp.com",
  projectId:         "seu-projeto",
  storageBucket:     "seu-projeto.appspot.com",
  messagingSenderId: "000000000000",
  appId:             "1:000000000000:web:xxxxxxxxxxxx"
};

// ── Inicializa Firebase ──────────────────────────────────────
firebase.initializeApp(firebaseConfig);

// ── Referências globais ──────────────────────────────────────
const db   = firebase.firestore();
const auth = firebase.auth();

// ── Habilitar persistência offline (opcional) ────────────────
db.enablePersistence({ synchronizeTabs: true })
  .catch(err => {
    if (err.code === 'failed-precondition') {
      console.warn('Persistência offline indisponível: múltiplas abas abertas.');
    } else if (err.code === 'unimplemented') {
      console.warn('Persistência offline não suportada neste navegador.');
    }
  });

console.log('🔥 Firebase inicializado com sucesso');
