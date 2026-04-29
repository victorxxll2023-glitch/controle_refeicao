// ============================================================
// js/admin.js — Painel Administrativo (CORRIGIDO + SETORES)
// ============================================================

(async () => {

  // ── Estado ──────────────────────────────────────────────
  let employees    = [];
  let sectors      = [];
  let editingId    = null;
  let activeTab    = 'employees';
  let reportPeriod = 'week';
  let reportData   = null;
  let sectorsUnsub = null;

  // ── Inicializar ──────────────────────────────────────────
  Auth.init();

  // Aplicar tema
  const savedTheme = localStorage.getItem('liga-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const cur  = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('liga-theme', next);
  });

  // ── Tabs ─────────────────────────────────────────────────
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  function switchTab(name) {
    activeTab = name;
    document.querySelectorAll('.tab-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.tab === name)
    );
    document.querySelectorAll('.tab-panel').forEach(p =>
      p.classList.toggle('active', p.id === `tab-${name}`)
    );

    if (name === 'employees') loadEmployees();
    if (name === 'reports')   initReports();
    if (name === 'qrcodes')   renderQRList();
    if (name === 'sectors')   initSectors();
    if (name === 'backup')    {}
  }

  // ════════════════════════════════════════════════════════
  // FUNCIONÁRIOS
  // ════════════════════════════════════════════════════════

  async function loadEmployees() {
    const tbody = document.getElementById('emp-tbody');
    tbody.innerHTML = '<tr><td colspan="4"><div class="loading-spinner"></div></td></tr>';

    try {
      employees = await DB.getEmployees();
      renderEmployeesTable();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="4"><div class="err-state">
        <span>⚠️</span> Erro ao carregar: ${Utils.escHtml(err.message)}
      </div></td></tr>`;
    }
  }

  function renderEmployeesTable() {
    const tbody   = document.getElementById('emp-tbody');
    const searchV = document.getElementById('admin-search')?.value.toLowerCase() || '';

    let list = employees;
    if (searchV) {
      list = employees.filter(e =>
        Utils.normalize(e.name).includes(Utils.normalize(searchV)) ||
        Utils.normalize(e.matricula).includes(Utils.normalize(searchV)) ||
        Utils.normalize(e.setor).includes(Utils.normalize(searchV))
      );
    }

    document.getElementById('emp-count').textContent =
      `${employees.length} funcionário${employees.length !== 1 ? 's' : ''}`;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4">
        <div class="empty-state" style="padding:32px">
          <span class="empty-icon">👤</span>
          <p>${searchV ? 'Nenhum resultado encontrado.' : 'Nenhum funcionário cadastrado.'}</p>
        </div>
      </td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(emp => `
      <tr>
        <td><strong>${Utils.escHtml(emp.name)}</strong></td>
        <td class="mono" style="color:var(--accent)">${Utils.escHtml(emp.matricula)}</td>
        <td><span class="badge badge-neutral">${Utils.escHtml(emp.setor)}</span></td>
        <td>
          <div class="row-actions">
            <button class="btn btn-ghost btn-sm" data-edit="${emp.id}">✎ Editar</button>
            <button class="btn btn-danger btn-sm" data-delete="${emp.id}" data-name="${Utils.escHtml(emp.name)}">✕</button>
          </div>
        </td>
      </tr>`).join('');

    // FIX: Re-registrar eventos a cada render (garante que funcione após qualquer exclusão)
    tbody.querySelectorAll('[data-edit]').forEach(btn =>
      btn.addEventListener('click', () => openEditModal(btn.dataset.edit))
    );
    tbody.querySelectorAll('[data-delete]').forEach(btn =>
      btn.addEventListener('click', () => confirmDelete(btn.dataset.delete, btn.dataset.name))
    );
  }

  document.getElementById('admin-search')?.addEventListener('input',
    Utils.debounce(() => renderEmployeesTable(), 200)
  );

  // ── Modal Adicionar / Editar ─────────────────────────────
  document.getElementById('btn-add-emp')?.addEventListener('click', () => openModal());

  function openModal(emp = null) {
    editingId = emp ? emp.id : null;
    const modal  = document.getElementById('emp-modal');
    const title  = document.getElementById('modal-title');
    const name   = document.getElementById('field-name');
    const mat    = document.getElementById('field-matricula');
    const setor  = document.getElementById('field-setor');

    title.textContent = emp ? 'Editar Funcionário' : 'Novo Funcionário';
    name.value  = emp?.name      || '';
    mat.value   = emp?.matricula || '';
    setor.value = emp?.setor     || '';
    mat.disabled = !!emp;

    // Preencher select de setores dinamicamente
    populateSetorSelect(setor, emp?.setor);

    document.getElementById('form-error').classList.remove('visible');
    modal.classList.add('open');
    setTimeout(() => name.focus(), 200);
  }

  function populateSetorSelect(selectEl, currentValue = '') {
    const options = sectors;

    selectEl.innerHTML = '<option value="">Selecione...</option>' +
      options.map(s => `<option value="${Utils.escHtml(s.name)}"
        ${s.name === currentValue ? 'selected' : ''}>${Utils.escHtml(s.name)}</option>`).join('');
  }

  function openEditModal(id) {
    const emp = employees.find(e => e.id === id);
    if (emp) openModal(emp);
  }

  document.getElementById('close-emp-modal')?.addEventListener('click', closeEmpModal);
  document.getElementById('emp-modal')?.addEventListener('click', e => {
    if (e.target.id === 'emp-modal') closeEmpModal();
  });

  function closeEmpModal() {
    document.getElementById('emp-modal').classList.remove('open');
    document.getElementById('form-error').classList.remove('visible');
    editingId = null;
  }

  document.getElementById('emp-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = document.getElementById('form-error');
    errEl.classList.remove('visible');

    const name  = document.getElementById('field-name').value.trim();
    const mat   = document.getElementById('field-matricula').value.trim();
    const setor = document.getElementById('field-setor').value.trim();

    if (!name || !mat || !setor) {
      errEl.textContent = 'Preencha todos os campos.';
      errEl.classList.add('visible');
      return;
    }

    const saveBtn = document.getElementById('btn-save-emp');
    saveBtn.disabled    = true;
    saveBtn.textContent = 'Salvando...';

    try {
      if (editingId) {
        await DB.updateEmployee(editingId, { name: Utils.capitalizeName(name), matricula: mat, setor });
        Utils.toast('Funcionário atualizado!', 'success');
      } else {
        await DB.addEmployee({ name: Utils.capitalizeName(name), matricula: mat, setor });
        Utils.toast('Funcionário cadastrado!', 'success');
      }
      closeEmpModal();
      await loadEmployees();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.add('visible');
    } finally {
      saveBtn.disabled    = false;
      saveBtn.textContent = 'Salvar';
    }
  });

  // ── Confirmar exclusão (FIX: cloneNode para resetar eventos) ─
  function confirmDelete(id, name) {
    const modal   = document.getElementById('confirm-modal');
    const nameEl  = document.getElementById('confirm-name');
    let   confirmBtn = document.getElementById('btn-confirm-delete');

    nameEl.textContent = name;

    // Resetar estado antes de clonar (evita clonar botão travado "Excluindo...")
    confirmBtn.disabled    = false;
    confirmBtn.textContent = 'Excluir';

    // Clonar para remover todos os listeners anteriores
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    confirmBtn = newBtn;

    modal.classList.add('open');

    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled    = true;
      confirmBtn.textContent = 'Excluindo...';

      try {
        await DB.deleteEmployee(id);
        Utils.toast('Funcionário excluído.', 'info');
        closeConfirmModal();
        await loadEmployees();
      } catch (err) {
        Utils.toast('Erro ao excluir: ' + err.message, 'error');
        confirmBtn.disabled    = false;
        confirmBtn.textContent = 'Excluir';
      }
    });
  }

  function closeConfirmModal() {
    const modal = document.getElementById('confirm-modal');
    modal.classList.remove('open');
    // Resetar botão para evitar estado travado entre exclusões
    const btn = document.getElementById('btn-confirm-delete');
    if (btn) { btn.disabled = false; btn.textContent = 'Excluir'; }
  }

  document.getElementById('close-confirm-modal')?.addEventListener('click', closeConfirmModal);
  document.getElementById('btn-cancel-delete')?.addEventListener('click', closeConfirmModal);

  // ════════════════════════════════════════════════════════
  // SETORES — integrado na aba Funcionários
  // ════════════════════════════════════════════════════════

  // initSectors mantido só para compatibilidade com switchTab (não faz nada agora)
  function initSectors() {}

  let editingSectorId = null;
  let sectorsPanelInitialized = false;

  function initInlineSectorsPanel() {
    if (sectorsPanelInitialized) {
      // Já inicializado, apenas atualizar lista
      renderInlineSectorsList();
      return;
    }
    sectorsPanelInitialized = true;

    const panel = document.getElementById('inline-sectors-panel');
    if (!panel) return;

    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div class="search-wrap" style="flex:1;max-width:280px">
          <span class="search-icon">🔍</span>
          <input class="search-input" type="search" id="inline-sector-search"
            placeholder="Buscar setor..." autocomplete="off">
        </div>
        <button class="btn btn-primary btn-sm" id="btn-add-sector-inline">+ Novo Setor</button>
      </div>
      <div id="inline-sectors-list">
        <div class="loading-spinner"></div>
      </div>

      <!-- Modal Setor (inline, dentro da aba funcionários) -->
      <div class="modal-overlay" id="sector-modal" role="dialog" aria-modal="true">
        <div class="modal" style="max-width:400px">
          <div class="modal-header">
            <h3 id="sector-modal-title">Novo Setor</h3>
            <button class="btn btn-ghost btn-icon" id="close-sector-modal">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label" for="field-sector-name">Nome do Setor</label>
              <input class="form-input" type="text" id="field-sector-name"
                placeholder="Ex: Oncologia" autocorrect="off" required>
            </div>
            <div id="sector-form-error" class="form-error" style="margin-top:10px"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="btn-cancel-sector">Cancelar</button>
            <button class="btn btn-primary btn-lg" id="btn-save-sector">Salvar</button>
          </div>
        </div>
      </div>

      <!-- Modal Confirmar exclusão de setor -->
      <div class="modal-overlay" id="confirm-sector-modal" role="dialog" aria-modal="true">
        <div class="modal" style="max-width:400px">
          <div class="modal-header">
            <h3>Confirmar Exclusão</h3>
            <button class="btn btn-ghost btn-icon" id="close-confirm-sector">✕</button>
          </div>
          <div class="modal-body">
            <div class="confirm-box">
              <div class="confirm-icon">⚠️</div>
              <h3>Excluir setor?</h3>
              <p>Tem certeza que deseja excluir <strong id="confirm-sector-name"></strong>?</p>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="btn-cancel-sector-delete">Cancelar</button>
            <button class="btn btn-danger btn-lg" id="btn-confirm-sector-delete">✕ Excluir</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-add-sector-inline')?.addEventListener('click', () => openSectorModal());
    document.getElementById('close-sector-modal')?.addEventListener('click', closeSectorModal);
    document.getElementById('btn-cancel-sector')?.addEventListener('click', closeSectorModal);
    document.getElementById('sector-modal')?.addEventListener('click', e => {
      if (e.target.id === 'sector-modal') closeSectorModal();
    });
    document.getElementById('close-confirm-sector')?.addEventListener('click', () =>
      document.getElementById('confirm-sector-modal').classList.remove('open')
    );
    document.getElementById('btn-cancel-sector-delete')?.addEventListener('click', () =>
      document.getElementById('confirm-sector-modal').classList.remove('open')
    );
    document.getElementById('btn-save-sector')?.addEventListener('click', saveSector);
    document.getElementById('field-sector-name')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') saveSector();
    });
    document.getElementById('inline-sector-search')?.addEventListener('input',
      Utils.debounce(() => renderInlineSectorsList(), 200)
    );

    // Carregar setores e escutar em tempo real
    DB.getSectors().then(list => {
      sectors = list;
      renderInlineSectorsList();
    });

    if (!sectorsUnsub) {
      sectorsUnsub = DB.listenSectors(list => {
        sectors = list;
        renderInlineSectorsList();
        // Atualizar select do modal de funcionário se estiver aberto
        const setor = document.getElementById('field-setor');
        if (setor) populateSetorSelect(setor, setor.value);
      });
    }
  }

  function renderInlineSectorsList() {
    const container = document.getElementById('inline-sectors-list');
    if (!container) return;

    const search = Utils.normalize(document.getElementById('inline-sector-search')?.value || '');
    const list = search
      ? sectors.filter(s => Utils.normalize(s.name).includes(search))
      : sectors;

    if (list.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:20px">
          <span class="empty-icon">🏥</span>
          <p style="font-size:.85rem">${search ? 'Nenhum setor encontrado.' : 'Nenhum setor cadastrado.'}</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr><th>Setor</th><th style="text-align:right">Ações</th></tr>
        </thead>
        <tbody>
          ${list.map(s => `
            <tr>
              <td>
                <span style="display:inline-flex;align-items:center;gap:8px">
                  <span style="width:8px;height:8px;border-radius:50%;background:${Utils.setorColor(s.name)};display:inline-block;flex-shrink:0"></span>
                  ${Utils.escHtml(s.name)}
                </span>
              </td>
              <td>
                <div class="row-actions">
                  <button class="btn btn-ghost btn-sm" data-edit-sector="${s.id}" data-sector-name="${Utils.escHtml(s.name)}">✎</button>
                  <button class="btn btn-danger btn-sm" data-delete-sector="${s.id}" data-sector-name="${Utils.escHtml(s.name)}">✕</button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    container.querySelectorAll('[data-edit-sector]').forEach(btn =>
      btn.addEventListener('click', () => openSectorModal(btn.dataset.editSector, btn.dataset.sectorName))
    );
    container.querySelectorAll('[data-delete-sector]').forEach(btn =>
      btn.addEventListener('click', () => confirmDeleteSector(btn.dataset.deleteSector, btn.dataset.sectorName))
    );
  }

  function openSectorModal(id = null, name = '') {
    editingSectorId = id;
    const modal = document.getElementById('sector-modal');
    if (!modal) return;
    document.getElementById('sector-modal-title').textContent = id ? 'Editar Setor' : 'Novo Setor';
    document.getElementById('field-sector-name').value = name;
    document.getElementById('sector-form-error').classList.remove('visible');
    modal.classList.add('open');
    setTimeout(() => document.getElementById('field-sector-name').focus(), 200);
  }

  function closeSectorModal() {
    document.getElementById('sector-modal')?.classList.remove('open');
    editingSectorId = null;
  }

  async function saveSector() {
    const errEl = document.getElementById('sector-form-error');
    errEl.classList.remove('visible');
    const name    = document.getElementById('field-sector-name').value.trim();
    const saveBtn = document.getElementById('btn-save-sector');

    if (!name) {
      errEl.textContent = 'Informe o nome do setor.';
      errEl.classList.add('visible');
      return;
    }

    saveBtn.disabled    = true;
    saveBtn.textContent = 'Salvando...';

    try {
      if (editingSectorId) {
        await DB.updateSector(editingSectorId, name);
        Utils.toast('Setor atualizado!', 'success');
      } else {
        await DB.addSector(name);
        Utils.toast('Setor criado!', 'success');
      }
      closeSectorModal();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.add('visible');
    } finally {
      saveBtn.disabled    = false;
      saveBtn.textContent = 'Salvar';
    }
  }

  function confirmDeleteSector(id, name) {
    // Bloquear exclusão de setores da lista padrão (não salvos no Firestore)
    if (id && id.startsWith('default_')) {
      Utils.toast('Este setor padrão não pode ser excluído. Adicione setores personalizados primeiro.', 'error');
      return;
    }

    const modal = document.getElementById('confirm-sector-modal');
    if (!modal) return;
    document.getElementById('confirm-sector-name').textContent = name;

    let confirmBtn = document.getElementById('btn-confirm-sector-delete');
    // Resetar antes de clonar
    confirmBtn.disabled    = false;
    confirmBtn.textContent = '✕ Excluir';
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    confirmBtn = newBtn;
    modal.classList.add('open');

    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled    = true;
      confirmBtn.textContent = 'Excluindo...';
      try {
        await DB.deleteSector(id);
        Utils.toast('Setor excluído.', 'info');
        modal.classList.remove('open');
      } catch (err) {
        Utils.toast('Erro ao excluir: ' + err.message, 'error');
        confirmBtn.disabled    = false;
        confirmBtn.textContent = '✕ Excluir';
      }
    });
  }

  // ════════════════════════════════════════════════════════
  // RELATÓRIOS
  // ════════════════════════════════════════════════════════

  function initReports() {
    renderReportPreview();
  }

  document.querySelectorAll('[data-period]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-period]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      reportPeriod = btn.dataset.period;
      renderReportPreview();
    });
  });

  async function renderReportPreview() {
    const previewEl = document.getElementById('report-table-body');
    const headerEl  = document.getElementById('report-period-label');
    const summaryEl = document.getElementById('report-summary');
    if (!previewEl) return;

    previewEl.innerHTML = '<tr><td colspan="5"><div class="loading-spinner"></div></td></tr>';

    try {
      const { records, label } = await Reports.getReportData(reportPeriod);
      reportData = { records, label };
      if (headerEl) headerEl.textContent = label;

      if (records.length === 0) {
        previewEl.innerHTML = `<tr><td colspan="5">
          <div class="empty-state" style="padding:24px">
            <span class="empty-icon">📋</span>
            <p>Nenhuma refeição registrada neste período.</p>
          </div>
        </td></tr>`;
        if (summaryEl) summaryEl.textContent = '';
        return;
      }

      const total = records.reduce((s, r) => s + r.total, 0);
      if (summaryEl) {
        summaryEl.textContent = `${records.length} funcionários · ${total} refeições no período`;
      }

      previewEl.innerHTML = records.map(r => `
        <tr>
          <td>${Utils.escHtml(r.name)}</td>
          <td class="mono" style="color:var(--accent)">${Utils.escHtml(r.matricula)}</td>
          <td><span class="badge badge-neutral">${Utils.escHtml(r.setor)}</span></td>
          <td style="text-align:center;font-weight:700;color:var(--text-1)">${r.total}</td>
          <td style="font-size:.8rem;color:var(--text-2)">${r.dates.sort().map(Utils.fmtDate).join(', ')}</td>
        </tr>`).join('');
    } catch (err) {
      previewEl.innerHTML = `<tr><td colspan="5">
        <div class="err-state">⚠️ Erro ao carregar: ${Utils.escHtml(err.message)}</div>
      </td></tr>`;
    }
  }

  document.getElementById('btn-dl-csv')?.addEventListener('click', () =>
    Reports.downloadReport('csv', reportPeriod)
  );
  document.getElementById('btn-dl-pdf')?.addEventListener('click', () =>
    Reports.downloadReport('pdf', reportPeriod)
  );

  // ════════════════════════════════════════════════════════
  // QR CODES
  // ════════════════════════════════════════════════════════

  function renderQRList() {
    const container = document.getElementById('qr-list');
    if (!container) return;

    if (employees.length === 0) {
      DB.getEmployees().then(list => {
        employees = list;
        _renderQRCards();
      });
    } else {
      _renderQRCards();
    }
  }

  function _renderQRCards() {
    const container = document.getElementById('qr-list');
    if (!container) return;

    const search = document.getElementById('qr-search')?.value || '';
    const term   = Utils.normalize(search);

    const filtered = term
      ? employees.filter(e => Utils.normalize(e.name).includes(term) || e.matricula.includes(term))
      : employees;

    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-state"><span class="empty-icon">🔲</span><p>Nenhum resultado.</p></div>';
      return;
    }

    container.innerHTML = filtered.map(emp => `
      <div class="card" style="text-align:center;flex:0 0 200px">
        <div style="font-weight:600;font-size:.95rem;margin-bottom:4px">${Utils.escHtml(emp.name)}</div>
        <div style="font-size:.78rem;color:var(--text-3);margin-bottom:12px">${Utils.escHtml(emp.setor)}</div>
        <div id="qr-${emp.matricula}" style="display:flex;justify-content:center"></div>
        <div class="mono" style="font-size:.75rem;color:var(--text-2);margin-top:8px">#${Utils.escHtml(emp.matricula)}</div>
      </div>`).join('');

    filtered.forEach(emp => {
      const el = document.getElementById(`qr-${emp.matricula}`);
      if (el && typeof QRCode !== 'undefined') {
        new QRCode(el, {
          text:   emp.matricula,
          width:  140,
          height: 140,
          colorDark:    '#060e1c',
          colorLight:   '#ffffff',
          correctLevel: QRCode.CorrectLevel.M,
        });
      }
    });
  }

  document.getElementById('qr-search')?.addEventListener('input',
    Utils.debounce(() => _renderQRCards(), 250)
  );
  document.getElementById('btn-print-qr')?.addEventListener('click', () => window.print());

  // ════════════════════════════════════════════════════════
  // BACKUP
  // ════════════════════════════════════════════════════════

  document.getElementById('btn-export')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-export');
    btn.disabled    = true;
    btn.textContent = 'Exportando...';
    try {
      const data = await DB.exportAll();
      const json = JSON.stringify(data, null, 2);
      Utils.downloadFile(json, `backup_refeicoes_${Utils.today()}.json`, 'application/json');
      Utils.toast('Backup exportado com sucesso!', 'success');
    } catch (err) {
      Utils.toast('Erro ao exportar: ' + err.message, 'error');
    } finally {
      btn.disabled    = false;
      btn.textContent = '⬇ Exportar Backup JSON';
    }
  });

  document.getElementById('btn-import')?.addEventListener('click', () =>
    document.getElementById('import-file').click()
  );

  document.getElementById('import-file')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (!window.confirm(`Importar backup "${file.name}"?\n\nOs dados existentes serão mesclados.`)) {
      e.target.value = '';
      return;
    }
    try {
      const data   = await Utils.readJsonFile(file);
      const result = await DB.importBackup(data);
      Utils.toast(`Importado! ${result.employees} funcionários, ${result.attendance} registros.`, 'success');
      await loadEmployees();
    } catch (err) {
      Utils.toast('Erro ao importar: ' + err.message, 'error');
    }
    e.target.value = '';
  });

  // ── Carregar dados iniciais ──────────────────────────────

  // Carregar setores para o select do modal
  DB.getSectors().then(list => {
    sectors = list;
  }).catch(() => {
    sectors = [];
  });

  // Toggle painel de setores dentro da aba funcionários
  document.getElementById('toggle-sectors-panel')?.addEventListener('click', () => {
    const panel = document.getElementById('inline-sectors-panel');
    const icon  = document.getElementById('sectors-toggle-icon');
    if (!panel) return;
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    if (icon) icon.textContent = isOpen ? '▶' : '▼';
    if (!isOpen) initInlineSectorsPanel();
  });

  await loadEmployees();

  document.getElementById('logout-btn')?.addEventListener('click', Auth.logout);

})();
