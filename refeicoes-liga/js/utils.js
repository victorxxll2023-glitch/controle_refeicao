// ============================================================
// js/utils.js — Utilitários globais
// ============================================================

const Utils = (() => {

  /* ─────────────────── DATAS ─────────────────────────────── */

  // Data atual no formato YYYY-MM-DD (para IDs no Firestore)
  function today() {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }

  // Hora atual HH:MM
  function timeNow() {
    const d = new Date();
    return d.toTimeString().slice(0, 5);
  }

  // Formatar YYYY-MM-DD → DD/MM/YYYY
  function fmtDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  // Nome do dia da semana (pt-BR)
  const DAYS = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  function dayName(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return DAYS[date.getDay()];
  }

  // Data por extenso: "Segunda, 15 de Janeiro de 2025"
  const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  function fmtDateFull(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return `${DAYS[date.getDay()]}, ${d} de ${MONTHS[m-1]} de ${y}`;
  }

  // Calcular datas da semana atual (Segunda a Sexta)
  function getCurrentWeekRange() {
    const today = new Date();
    const day   = today.getDay(); // 0=Dom
    const diff  = day === 0 ? -6 : 1 - day; // dias até segunda

    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);

    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    return {
      start: monday.toISOString().split('T')[0],
      end:   friday.toISOString().split('T')[0],
      label: `${fmtDate(monday.toISOString().split('T')[0])} a ${fmtDate(friday.toISOString().split('T')[0])}`,
    };
  }

  // Semana anterior
  function getLastWeekRange() {
    const week = getCurrentWeekRange();
    const start = new Date(week.start);
    start.setDate(start.getDate() - 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 4);
    const s = start.toISOString().split('T')[0];
    const e = end.toISOString().split('T')[0];
    return { start: s, end: e, label: `${fmtDate(s)} a ${fmtDate(e)}` };
  }

  // Mês atual (YYYY-MM-DD range)
  function getCurrentMonthRange() {
    const d = new Date();
    const y = d.getFullYear(), m = d.getMonth();
    const start = `${y}-${String(m+1).padStart(2,'0')}-01`;
    const last  = new Date(y, m + 1, 0);
    const end   = last.toISOString().split('T')[0];
    return { start, end, label: `${MONTHS[m]} de ${y}` };
  }

  /* ─────────────────── TOAST ─────────────────────────────── */

  let toastContainer;

  function _ensureContainer() {
    if (!toastContainer) {
      toastContainer = document.getElementById('toast-container');
      if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
      }
    }
    return toastContainer;
  }

  const TOAST_ICONS = {
    success: '✓',
    error:   '✕',
    info:    'ℹ',
    warning: '⚠',
  };

  function toast(message, type = 'info', duration = 3500) {
    const container = _ensureContainer();

    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `
      <span class="toast-icon">${TOAST_ICONS[type]}</span>
      <span class="toast-msg">${message}</span>
    `;

    container.appendChild(el);

    // Auto-remove
    const remove = () => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 300);
    };

    el.addEventListener('click', remove);
    setTimeout(remove, duration);
  }

  /* ─────────────────── FUNÇÕES AUXILIARES ────────────────── */

  // Debounce
  function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  // Normalizar texto para busca (remove acentos, lowercase)
  function normalize(str) {
    return String(str)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  // Escape HTML
  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Highlight termo na string
  function highlight(text, term) {
    if (!term) return escHtml(text);
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(${escaped})`, 'gi');
    return escHtml(text).replace(re, '<mark style="background:var(--accent);color:#060e1c;border-radius:3px;padding:0 2px;">$1</mark>');
  }

  // Download de arquivo
  function downloadFile(content, filename, type = 'text/plain') {
    const blob = new Blob([content], { type });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Ler arquivo JSON do input
  function readJsonFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try { resolve(JSON.parse(e.target.result)); }
        catch { reject(new Error('Arquivo JSON inválido.')); }
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));
      reader.readAsText(file);
    });
  }

  // Formatar matrícula (só números, máx 10 chars)
  function fmtMatricula(value) {
    return String(value).replace(/\D/g, '').slice(0, 10);
  }

  // Confirmar ação com modal nativo (fallback)
  function confirm(msg) {
    return window.confirm(msg);
  }

  // Capitalizar nomes
  function capitalizeName(str) {
    const lower = ['de','da','do','dos','das','e','em','na','no'];
    return str.trim().toLowerCase().split(' ').map((w, i) => {
      if (i > 0 && lower.includes(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');
  }

  // Formatar setor para badge de cor
  const SETOR_COLORS = {
    'oncologia': '#e76f51',
    'enfermagem': '#2a9d8f',
    'administrativo': '#457b9d',
    'nutrição': '#e9c46a',
    'farmácia': '#8338ec',
    'laboratório': '#3a86ff',
    'radiologia': '#06d6a0',
    'cirurgia': '#ef476f',
    'uti': '#ff6b35',
    'recepção': '#74c69d',
  };

  function setorColor(setor) {
    const key = normalize(setor).split(' ')[0];
    return SETOR_COLORS[key] || '#7eaacf';
  }

  return {
    today, timeNow, fmtDate, dayName, fmtDateFull,
    getCurrentWeekRange, getLastWeekRange, getCurrentMonthRange,
    toast, debounce, normalize, escHtml, highlight,
    downloadFile, readJsonFile, fmtMatricula, capitalizeName, setorColor,
  };
})();
