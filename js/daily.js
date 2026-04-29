// ============================================================
// js/daily.js — Lógica da tela de uso diário (CORRIGIDO)
// ============================================================

(async () => {
  // ── Estado ──────────────────────────────────────────────
  let allEmployees = [];
  let markedToday  = {};   // { matricula: time }
  let searchTerm   = '';
  let filterMode   = 'all'; // 'all' | 'pending' | 'marked'
  let qrScanner    = null;

  // ── Elementos do DOM ────────────────────────────────────
  const searchInput  = document.getElementById('search');
  const searchClear  = document.getElementById('search-clear');
  const empList      = document.getElementById('emp-list');
  const listCount    = document.getElementById('list-count');
  const statTotal    = document.getElementById('stat-total');
  const statMarked   = document.getElementById('stat-marked');
  const statPending  = document.getElementById('stat-pending');
  const todayLabel   = document.getElementById('today-label');
  const qrModal      = document.getElementById('qr-modal');
  const fabQr        = document.getElementById('fab-qr');

  // ── Inicializar ──────────────────────────────────────────
  const TODAY = Utils.today();
  if (todayLabel) todayLabel.textContent = Utils.fmtDateFull(TODAY);

  // Escutar funcionários em tempo real
  DB.listenEmployees(employees => {
    allEmployees = employees;
    renderList();
    updateStats();
  });

  // Escutar presenças de hoje em tempo real
  DB.listenAttendance(TODAY, records => {
    markedToday = {};
    records.forEach(r => { markedToday[r.matricula] = r.time || '--:--'; });
    renderList();
    updateStats();
  });

  // ── Busca ────────────────────────────────────────────────
  searchInput?.addEventListener('input', Utils.debounce(e => {
    searchTerm = e.target.value.trim();
    searchClear?.classList.toggle('visible', searchTerm.length > 0);
    renderList();
  }, 150));

  searchClear?.addEventListener('click', () => {
    searchInput.value = '';
    searchTerm = '';
    searchClear.classList.remove('visible');
    searchInput.focus();
    renderList();
  });

  // ── Filtros ──────────────────────────────────────────────
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterMode = btn.dataset.filter;
      renderList();
    });
  });

  // ── Renderizar lista ─────────────────────────────────────
  function renderList() {
    const term = Utils.normalize(searchTerm);

    let filtered = allEmployees.filter(emp => {
      // Filtro por texto
      const matchText = !term ||
        Utils.normalize(emp.name).includes(term) ||
        Utils.normalize(emp.matricula).includes(term) ||
        Utils.normalize(emp.setor).includes(term);

      // Filtro por status
      const isMarked = !!markedToday[emp.matricula];
      const matchFilter =
        filterMode === 'all'     ? true :
        filterMode === 'marked'  ? isMarked :
        filterMode === 'pending' ? !isMarked : true;

      return matchText && matchFilter;
    });

    // Ordenar: não-marcados primeiro, depois alfabético
    filtered.sort((a, b) => {
      const aM = !!markedToday[a.matricula];
      const bM = !!markedToday[b.matricula];
      if (aM !== bM) return aM ? 1 : -1;
      return a.name.localeCompare(b.name, 'pt-BR');
    });

    listCount.textContent = `${filtered.length} funcionário${filtered.length !== 1 ? 's' : ''}`;

    if (filtered.length === 0) {
      empList.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🔍</span>
          <h3>Nenhum resultado</h3>
          <p>${searchTerm
            ? `Nenhum funcionário encontrado para "${Utils.escHtml(searchTerm)}"`
            : filterMode !== 'all'
              ? 'Nenhum funcionário nesta categoria.'
              : 'Nenhum funcionário cadastrado ainda.'}</p>
        </div>`;
      return;
    }

    empList.innerHTML = filtered.map(emp => buildCard(emp)).join('');

    // FIX: Usar delegação de evento para evitar problemas de estado
    empList.querySelectorAll('[data-mark]').forEach(btn => {
      btn.addEventListener('click', () => handleToggle(btn.dataset.mark));
    });

    empList.querySelectorAll('[data-unmark]').forEach(btn => {
      btn.addEventListener('click', () => handleUnmark(btn.dataset.unmark));
    });

    empList.querySelectorAll('[data-history]').forEach(btn => {
      btn.addEventListener('click', () => showHistory(btn.dataset.history, btn.dataset.name));
    });
  }

  function buildCard(emp) {
    const marked = !!markedToday[emp.matricula];
    const time   = markedToday[emp.matricula] || '';
    const color  = Utils.setorColor(emp.setor);
    const term   = Utils.normalize(searchTerm);

    const nameHl = term
      ? Utils.highlight(emp.name, searchTerm)
      : Utils.escHtml(emp.name);

    return `
    <div class="emp-card ${marked ? 'is-marked' : ''}" id="card-${emp.matricula}">
      <div class="emp-info">
        <div class="emp-name">${nameHl}</div>
        <div class="emp-meta">
          <span class="emp-matricula">#${Utils.escHtml(emp.matricula)}</span>
          <span class="emp-setor" style="color:${color}">
            <span>●</span> ${Utils.escHtml(emp.setor)}
          </span>
        </div>
      </div>
      <div class="emp-action">
        <span class="mark-time">${marked ? `✓ ${time}` : ''}</span>
        ${marked
          ? `<div style="display:flex;gap:6px;align-items:center">
               <button class="btn btn-ghost btn-sm hist-btn" data-history="${emp.id}" data-name="${Utils.escHtml(emp.name)}">Histórico</button>
               <button class="btn-unmark" data-unmark="${emp.matricula}" title="Desmarcar presença">✕</button>
             </div>`
          : `<button class="btn-mark" data-mark="${emp.matricula}">
               <span>✓</span> Marcar
             </button>`
        }
      </div>
    </div>`;
  }

  // ── Toggle: Marcar / Desmarcar ───────────────────────────
  async function handleToggle(matricula) {
    if (markedToday[matricula]) {
      await handleUnmark(matricula);
    } else {
      await handleMark(matricula);
    }
  }

  async function handleMark(matricula) {
    const emp = allEmployees.find(e => e.matricula === matricula);
    if (!emp) return;

    if (markedToday[matricula]) {
      Utils.toast(`${emp.name} já está marcado.`, 'warning');
      return;
    }

    const btn = document.querySelector(`[data-mark="${matricula}"]`);
    if (btn) { btn.disabled = true; btn.textContent = '...'; }

    try {
      const time = Utils.timeNow();
      await DB.markAttendance(emp, TODAY, time);

      const card = document.getElementById(`card-${matricula}`);
      if (card) card.classList.add('just-marked');

      Utils.toast(`✓ ${emp.name} — presença registrada!`, 'success');
    } catch (err) {
      Utils.toast(err.message || 'Erro ao registrar presença.', 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '<span>✓</span> Marcar'; }
    }
  }

  // FIX: Desmarcar presença (toggle)
  async function handleUnmark(matricula) {
    const emp = allEmployees.find(e => e.matricula === matricula);
    if (!emp) return;

    const btn = document.querySelector(`[data-unmark="${matricula}"]`);
    if (btn) { btn.disabled = true; }

    try {
      await DB.cancelAttendance(matricula, TODAY);
      Utils.toast(`${emp.name} — presença removida.`, 'info');
    } catch (err) {
      Utils.toast(err.message || 'Erro ao remover presença.', 'error');
      if (btn) { btn.disabled = false; }
    }
  }

  // ── Marcar por matrícula (QR) ────────────────────────────
  async function markByMatricula(matricula) {
    const mat = String(matricula).trim();
    const emp = allEmployees.find(e => e.matricula === mat);
    if (!emp) {
      Utils.toast(`Matrícula ${mat} não encontrada.`, 'error');
      return;
    }
    await handleMark(mat);
  }

  // ── Histórico individual (FIX: try/catch com mensagem) ───
  async function showHistory(employeeId, name) {
    const modal   = document.getElementById('history-modal');
    const titleEl = document.getElementById('history-name');
    const bodyEl  = document.getElementById('history-body');
    const countEl = document.getElementById('history-count');

    titleEl.textContent  = name;
    countEl.textContent  = '';
    bodyEl.innerHTML     = '<div class="loading-spinner"></div>';
    modal.classList.add('open');

    try {
      // FIX: usar getEmployeeHistory com fallback automático
      const history = await DB.getEmployeeHistory(employeeId);

      if (history.length === 0) {
        bodyEl.innerHTML = `
          <div class="empty-state" style="padding:32px">
            <span class="empty-icon">🍽</span>
            <p>Nenhuma refeição registrada ainda.</p>
          </div>`;
      } else {
        countEl.textContent = `${history.length} refeição${history.length !== 1 ? 'ões' : ''}`;
        bodyEl.innerHTML = history.map(r => `
          <div class="history-item">
            <span class="history-date">${Utils.fmtDate(r.date)}</span>
            <span class="history-day">${Utils.dayName(r.date)}</span>
            <span style="font-size:.78rem;color:var(--text-3)">${r.time || ''}</span>
          </div>`).join('');
      }
    } catch (err) {
      bodyEl.innerHTML = `
        <div style="text-align:center;padding:24px">
          <div style="font-size:2rem;margin-bottom:8px">⚠️</div>
          <p style="color:var(--danger);font-size:.9rem">${Utils.escHtml(err.message)}</p>
          <p style="color:var(--text-3);font-size:.8rem;margin-top:8px">
            Pode ser necessário criar um índice no Firestore. Veja o console para detalhes.
          </p>
        </div>`;
      console.error('showHistory erro:', err);
    }
  }

  // ── Atualizar estatísticas ────────────────────────────────
  function updateStats() {
    const total   = allEmployees.length;
    const marked  = Object.keys(markedToday).length;
    const pending = total - marked;

    if (statTotal)   statTotal.textContent   = total;
    if (statMarked)  statMarked.textContent  = marked;
    if (statPending) statPending.textContent = pending;

    // Atualizar contador de filtros
    document.querySelectorAll('.filter-btn').forEach(btn => {
      const f = btn.dataset.filter;
      const badge = btn.querySelector('.filter-count');
      if (!badge) return;
      if (f === 'all')     badge.textContent = total;
      if (f === 'marked')  badge.textContent = marked;
      if (f === 'pending') badge.textContent = pending;
    });
  }

  // ── QR Code Scanner ──────────────────────────────────────
  fabQr?.addEventListener('click', openQrScanner);

  function openQrScanner() {
    qrModal.classList.add('open');
    document.getElementById('qr-result').textContent = 'Aponte a câmera para o QR Code...';

    const html5QrCode = new Html5Qrcode('reader');
    qrScanner = html5QrCode;

    html5QrCode.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      async (decodedText) => {
        html5QrCode.pause(true);
        document.getElementById('qr-result').textContent = `QR lido: ${decodedText}`;
        await markByMatricula(decodedText);
        setTimeout(closeQrScanner, 1800);
      }
    ).catch(err => {
      console.error('QR scanner error:', err);
      Utils.toast('Não foi possível acessar a câmera.', 'error');
    });
  }

  function closeQrScanner() {
    if (qrScanner) {
      qrScanner.stop().catch(() => {});
      qrScanner = null;
    }
    qrModal?.classList.remove('open');
  }

  document.getElementById('close-qr')?.addEventListener('click', closeQrScanner);
  qrModal?.addEventListener('click', e => {
    if (e.target === qrModal) closeQrScanner();
  });

  // Fechar modal histórico
  document.getElementById('history-modal')?.addEventListener('click', e => {
    if (e.target.id === 'history-modal') {
      e.target.classList.remove('open');
    }
  });

  // ── Tema ─────────────────────────────────────────────────
  const savedTheme = localStorage.getItem('liga-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const cur  = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('liga-theme', next);
  });

  // ── Logout ───────────────────────────────────────────────
  document.getElementById('logout-btn')?.addEventListener('click', Auth.logout);

})();
