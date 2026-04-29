// ============================================================
// js/admin.js — Lógica do Painel Administrativo (admin.html)
// ============================================================

(async () => {

  // ── Estado ──────────────────────────────────────────────
  let employees    = [];
  let editingId    = null;
  let activeTab    = 'employees';
  let reportPeriod = 'week';
  let reportData   = null;

  // ── Inicializar autenticação ─────────────────────────────
  Auth.init();

  // ── Tema ─────────────────────────────────────────────────
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
    if (name === 'backup')    initBackup();
  }

  // ── FUNCIONÁRIOS ─────────────────────────────────────────

  async function loadEmployees() {
    const tbody = document.getElementById('emp-tbody');
    tbody.innerHTML = '<tr><td colspan="4"><div class="loading-spinner"></div></td></tr>';

    try {
      employees = await DB.getEmployees();
      renderEmployeesTable();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="4" style="color:var(--danger)">Erro: ${err.message}</td></tr>`;
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
          <p>${searchV ? 'Nenhum resultado.' : 'Nenhum funcionário cadastrado.'}</p>
        </div>
      </td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(emp => `
      <tr>
        <td>
          <strong>${Utils.escHtml(emp.name)}</strong>
        </td>
        <td class="mono" style="color:var(--accent)">${Utils.escHtml(emp.matricula)}</td>
        <td>
          <span class="badge badge-neutral">${Utils.escHtml(emp.setor)}</span>
        </td>
        <td>
          <div style="display:flex;gap:6px;justify-content:flex-end">
            <button class="btn btn-ghost btn-sm" style="height:36px;font-size:.82rem"
              data-edit="${emp.id}">✎ Editar</button>
            <button class="btn btn-danger btn-sm" style="height:36px;font-size:.82rem"
              data-delete="${emp.id}" data-name="${Utils.escHtml(emp.name)}">✕</button>
          </div>
        </td>
      </tr>`).join('');

    // Eventos
    tbody.querySelectorAll('[data-edit]').forEach(btn =>
      btn.addEventListener('click', () => openEditModal(btn.dataset.edit))
    );
    tbody.querySelectorAll('[data-delete]').forEach(btn =>
      btn.addEventListener('click', () => confirmDelete(btn.dataset.delete, btn.dataset.name))
    );
  }

  // ── Busca no admin ───────────────────────────────────────
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

    mat.disabled = !!emp; // matrícula não editável após cadastro

    modal.classList.add('open');
    setTimeout(() => name.focus(), 200);
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
    saveBtn.disabled = true;
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
      saveBtn.disabled = false;
      saveBtn.textContent = 'Salvar';
    }
  });

  // ── Confirmação de exclusão ──────────────────────────────
  function confirmDelete(id, name) {
    const modal    = document.getElementById('confirm-modal');
    const nameEl   = document.getElementById('confirm-name');
    const confirmBtn = document.getElementById('btn-confirm-delete');

    nameEl.textContent = name;
    modal.classList.add('open');

    // Limpar handlers anteriores
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

    newBtn.addEventListener('click', async () => {
      newBtn.disabled = true;
      newBtn.textContent = 'Excluindo...';
      try {
        await DB.deleteEmployee(id);
        Utils.toast('Funcionário excluído.', 'info');
        modal.classList.remove('open');
        await loadEmployees();
      } catch (err) {
        Utils.toast('Erro ao excluir: ' + err.message, 'error');
        newBtn.disabled = false;
        newBtn.textContent = 'Excluir';
      }
    });
  }

  document.getElementById('close-confirm-modal')?.addEventListener('click', () =>
    document.getElementById('confirm-modal').classList.remove('open')
  );
  document.getElementById('btn-cancel-delete')?.addEventListener('click', () =>
    document.getElementById('confirm-modal').classList.remove('open')
  );

  // ── RELATÓRIOS ───────────────────────────────────────────

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
      previewEl.innerHTML = `<tr><td colspan="5" style="color:var(--danger)">Erro: ${err.message}</td></tr>`;
    }
  }

  document.getElementById('btn-dl-csv')?.addEventListener('click', async () => {
    await Reports.downloadReport('csv', reportPeriod);
  });

  document.getElementById('btn-dl-pdf')?.addEventListener('click', async () => {
    await Reports.downloadReport('pdf', reportPeriod);
  });

  // ── QR CODES ─────────────────────────────────────────────

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
    const search    = document.getElementById('qr-search')?.value || '';
    const term      = Utils.normalize(search);

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

    // Gerar QR codes
    filtered.forEach(emp => {
      const el = document.getElementById(`qr-${emp.matricula}`);
      if (el && typeof QRCode !== 'undefined') {
        new QRCode(el, {
          text:   emp.matricula,
          width:  140,
          height: 140,
          colorDark:  '#060e1c',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M,
        });
      }
    });
  }

  document.getElementById('qr-search')?.addEventListener('input',
    Utils.debounce(() => _renderQRCards(), 250)
  );

  document.getElementById('btn-print-qr')?.addEventListener('click', () => {
    window.print();
  });

  // ── BACKUP ───────────────────────────────────────────────

  function initBackup() {
    // nada a carregar
  }

  document.getElementById('btn-export')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-export');
    btn.disabled = true;
    btn.textContent = 'Exportando...';
    try {
      const data = await DB.exportAll();
      const json = JSON.stringify(data, null, 2);
      const date = Utils.today();
      Utils.downloadFile(json, `backup_refeicoes_${date}.json`, 'application/json');
      Utils.toast('Backup exportado com sucesso!', 'success');
    } catch (err) {
      Utils.toast('Erro ao exportar: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '⬇ Exportar Backup JSON';
    }
  });

  document.getElementById('btn-import')?.addEventListener('click', () => {
    document.getElementById('import-file').click();
  });

  document.getElementById('import-file')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;

    if (!window.confirm(`Importar backup "${file.name}"?\n\nOs dados existentes serão mantidos e mesclados com o backup.`)) {
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

  // ── Carregar funcionários inicial ────────────────────────
  await loadEmployees();

  // ── Logout ───────────────────────────────────────────────
  document.getElementById('logout-btn')?.addEventListener('click', Auth.logout);

})();
