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

// js/config.js
const firebaseConfig = {
  apiKey: "AIzaSyDP-04tBEyIq2xCYL5j2-hE1wLDchuiq5s",
  authDomain: "cecan-refeicoes.firebaseapp.com",
  projectId: "cecan-refeicoes",
  storageBucket: "cecan-refeicoes.firebasestorage.app",
  messagingSenderId: "924255868425",
  appId: "1:924255868425:web:47757a36a550016bf34ad8"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

var db   = firebase.firestore();
var auth = firebase.auth();

db.enablePersistence({ synchronizeTabs: true })
  .catch(err => {
    if (err.code === 'failed-precondition') {
      console.warn('Persistência offline indisponível: múltiplas abas abertas.');
    } else if (err.code === 'unimplemented') {
      console.warn('Persistência offline não suportada neste navegador.');
    }
  });

console.log('🔥 Firebase inicializado com sucesso');
