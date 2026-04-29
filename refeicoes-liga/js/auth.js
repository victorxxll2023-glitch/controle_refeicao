// ============================================================
// js/auth.js — Autenticação Firebase
// ============================================================

const Auth = (() => {
  // Páginas públicas (sem redirecionamento)
  const PUBLIC_PAGES = ['index.html', '/'];

  // ── Verificar autenticação na carga da página ────────────
  function init() {
    const path = window.location.pathname;
    const isPublic = PUBLIC_PAGES.some(p => path.endsWith(p));

    auth.onAuthStateChanged(user => {
      if (user) {
        // Usuário logado na página de login → ir para app
        if (isPublic) {
          window.location.href = 'app.html';
        }
        // Atualizar UI com nome do usuário
        const el = document.getElementById('user-name');
        if (el) el.textContent = user.email.split('@')[0];
      } else {
        // Usuário não logado em página protegida → login
        if (!isPublic) {
          window.location.href = 'index.html';
        }
      }
    });
  }

  // ── Login com email e senha ──────────────────────────────
  async function login(email, password) {
    try {
      const cred = await auth.signInWithEmailAndPassword(email, password);
      return { ok: true, user: cred.user };
    } catch (err) {
      return { ok: false, error: _translateError(err.code) };
    }
  }

  // ── Logout ───────────────────────────────────────────────
  async function logout() {
    try {
      await auth.signOut();
      window.location.href = 'index.html';
    } catch (err) {
      console.error('Erro ao sair:', err);
    }
  }

  // ── Obter usuário atual ──────────────────────────────────
  function currentUser() {
    return auth.currentUser;
  }

  // ── Traduzir erros Firebase ──────────────────────────────
  function _translateError(code) {
    const map = {
      'auth/user-not-found':    'Usuário não encontrado.',
      'auth/wrong-password':    'Senha incorreta.',
      'auth/invalid-email':     'E-mail inválido.',
      'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
      'auth/network-request-failed': 'Erro de conexão. Verifique sua internet.',
      'auth/invalid-credential': 'E-mail ou senha incorretos.',
    };
    return map[code] || 'Erro ao autenticar. Tente novamente.';
  }

  return { init, login, logout, currentUser };
})();
