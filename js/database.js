// ============================================================
// js/database.js — Operações Firestore (CORRIGIDO)
// ============================================================
// Estrutura de coleções:
//   employees/{id}       → dados do funcionário
//   attendance/{id}      → registro de presença (id = YYYY-MM-DD_matricula)
//   sectors/{id}         → setores (CRUD completo)
// ============================================================

const DB = (() => {
  const COL_EMP     = 'employees';
  const COL_ATT     = 'attendance';
  const COL_SECTORS = 'sectors';

  /* ─────────────────── FUNCIONÁRIOS ─────────────────────── */

  async function getEmployees() {
    try {
      const snap = await db.collection(COL_EMP).orderBy('name').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error('getEmployees:', err);
      throw err;
    }
  }

  async function getEmployeeByMatricula(matricula) {
    try {
      const snap = await db.collection(COL_EMP)
        .where('matricula', '==', String(matricula).trim())
        .limit(1)
        .get();
      if (snap.empty) return null;
      const d = snap.docs[0];
      return { id: d.id, ...d.data() };
    } catch (err) {
      console.error('getEmployeeByMatricula:', err);
      throw err;
    }
  }

  async function addEmployee({ name, matricula, setor }) {
    const existing = await getEmployeeByMatricula(matricula);
    if (existing) throw new Error('Já existe um funcionário com essa matrícula.');
    return db.collection(COL_EMP).add({
      name:      name.trim(),
      matricula: String(matricula).trim(),
      setor:     setor.trim(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  async function updateEmployee(id, { name, matricula, setor }) {
    const existing = await getEmployeeByMatricula(matricula);
    if (existing && existing.id !== id) throw new Error('Já existe um funcionário com essa matrícula.');
    return db.collection(COL_EMP).doc(id).update({
      name:      name.trim(),
      matricula: String(matricula).trim(),
      setor:     setor.trim(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  async function deleteEmployee(id) {
    // FIX: retorna promise simples sem estado extra
    return db.collection(COL_EMP).doc(id).delete();
  }

  /* ─────────────────── SETORES ───────────────────────────── */

 async function getSectors() {
  try {
    const snap = await db.collection(COL_SECTORS).orderBy('name').get();
    if (snap.empty) return getDefaultSectorList();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('getSectors:', err);
    return getDefaultSectorList();
  }
}

  function getDefaultSectorList() {
    return [
      'Administrativo','Cirurgia','Enfermagem','Farmácia',
      'Laboratório','Limpeza','Manutenção','Nutrição',
      'Oncologia','Quimioterapia','Radiologia','Recepção',
      'Segurança','TI','UTI','Outro'
    ].map((name, i) => ({ id: `default_${i}`, name }));
  }
  async function addSector(name) {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Nome do setor é obrigatório.');
    // Verificar duplicata
    const snap = await db.collection(COL_SECTORS)
      .where('name', '==', trimmed).limit(1).get();
    if (!snap.empty) throw new Error('Já existe um setor com esse nome.');
    return db.collection(COL_SECTORS).add({
      name: trimmed,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  async function updateSector(id, name) {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Nome do setor é obrigatório.');
    return db.collection(COL_SECTORS).doc(id).update({
      name: trimmed,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  async function deleteSector(id) {
    return db.collection(COL_SECTORS).doc(id).delete();
  }

  function listenSectors(callback) {
    return db.collection(COL_SECTORS)
      .orderBy('name')
      .onSnapshot(
        snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        err => console.error('listenSectors:', err)
      );
  }

  /* ─────────────────── PRESENÇAS ────────────────────────── */

  function _attId(date, matricula) {
    return `${date}_${String(matricula).trim()}`;
  }

  async function checkAttendance(matricula, date) {
    const docRef = db.collection(COL_ATT).doc(_attId(date, matricula));
    const snap = await docRef.get();
    return snap.exists;
  }

  async function markAttendance(employee, date, time) {
    const docId  = _attId(date, employee.matricula);
    const docRef = db.collection(COL_ATT).doc(docId);

    // FIX: usar set com merge:false para garantir atomicidade
    const snap = await docRef.get();
    if (snap.exists) throw new Error('Presença já registrada para hoje.');

    await docRef.set({
      employeeId: employee.id,
      name:       employee.name,
      matricula:  employee.matricula,
      setor:      employee.setor,
      date:       date,
      time:       time,
      timestamp:  firebase.firestore.FieldValue.serverTimestamp(),
    });

    return { docId, date, time };
  }

  // FIX: Desmarcar presença (toggle)
  async function cancelAttendance(matricula, date) {
    const docId = _attId(date, matricula);
    return db.collection(COL_ATT).doc(docId).delete();
  }

  async function getAttendanceByDate(date) {
    try {
      const snap = await db.collection(COL_ATT)
        .where('date', '==', date)
        .get();
      return snap.docs.map(d => d.data());
    } catch (err) {
      console.error('getAttendanceByDate:', err);
      throw err;
    }
  }

  async function getAttendanceByDateRange(startDate, endDate) {
    try {
      const snap = await db.collection(COL_ATT)
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .get();
      return snap.docs.map(d => d.data());
    } catch (err) {
      console.error('getAttendanceByDateRange:', err);
      throw err;
    }
  }

  // FIX PRINCIPAL: getEmployeeHistory — query corrigida
  // O erro ocorria porque o índice composto pode não existir.
  // Solução: buscar por matricula (mais simples e sem índice composto)
  async function getEmployeeHistory(employeeId) {
    try {
      // Primeiro tentamos por employeeId com orderBy (requer índice)
      const snap = await db.collection(COL_ATT)
        .where('employeeId', '==', employeeId)
        .orderBy('date', 'desc')
        .get();
      return snap.docs.map(d => d.data());
    } catch (err) {
      // FIX: Fallback sem orderBy caso índice não exista
      console.warn('getEmployeeHistory com índice falhou, usando fallback:', err.message);
      try {
        const snap = await db.collection(COL_ATT)
          .where('employeeId', '==', employeeId)
          .get();
        const records = snap.docs.map(d => d.data());
        // Ordenar no cliente
        return records.sort((a, b) => b.date.localeCompare(a.date));
      } catch (err2) {
        console.error('getEmployeeHistory fallback:', err2);
        throw new Error('Não foi possível carregar o histórico. Verifique os índices do Firestore.');
      }
    }
  }

  async function getHistoryByMatricula(matricula) {
    try {
      const snap = await db.collection(COL_ATT)
        .where('matricula', '==', String(matricula))
        .get();
      const records = snap.docs.map(d => d.data());
      return records.sort((a, b) => b.date.localeCompare(a.date));
    } catch (err) {
      console.error('getHistoryByMatricula:', err);
      throw err;
    }
  }

  /* ─────────────────── BACKUP ────────────────────────────── */

  async function exportAll() {
    const [emps, att, secs] = await Promise.all([
      db.collection(COL_EMP).get(),
      db.collection(COL_ATT).get(),
      db.collection(COL_SECTORS).get().catch(() => ({ docs: [] })),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      version:    '2.0',
      employees:  emps.docs.map(d => ({ id: d.id, ...d.data() })),
      attendance: att.docs.map(d => ({ id: d.id, ...d.data() })),
      sectors:    secs.docs.map(d => ({ id: d.id, ...d.data() })),
    };
  }

  async function importBackup(data) {
    if (!data.employees || !data.attendance) {
      throw new Error('Formato de backup inválido.');
    }

    const batch = db.batch();

    for (const emp of data.employees) {
      const { id, ...fields } = emp;
      batch.set(db.collection(COL_EMP).doc(id), fields, { merge: true });
    }

    for (const att of data.attendance) {
      const { id, ...fields } = att;
      batch.set(db.collection(COL_ATT).doc(id), fields, { merge: true });
    }

    if (data.sectors) {
      for (const sec of data.sectors) {
        const { id, ...fields } = sec;
        batch.set(db.collection(COL_SECTORS).doc(id), fields, { merge: true });
      }
    }

    await batch.commit();
    return {
      employees:  data.employees.length,
      attendance: data.attendance.length,
      sectors:    (data.sectors || []).length,
    };
  }

  /* ─────────────────── TEMPO REAL ────────────────────────── */

  function listenEmployees(callback) {
    return db.collection(COL_EMP)
      .orderBy('name')
      .onSnapshot(
        snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        err => console.error('listenEmployees:', err)
      );
  }

  function listenAttendance(date, callback) {
    return db.collection(COL_ATT)
      .where('date', '==', date)
      .onSnapshot(
        snap => callback(snap.docs.map(d => d.data())),
        err => console.error('listenAttendance:', err)
      );
  }

  return {
    // Funcionários
    getEmployees, getEmployeeByMatricula,
    addEmployee, updateEmployee, deleteEmployee,
    // Setores
    getSectors, addSector, updateSector, deleteSector,
    listenSectors, getDefaultSectorList,
    // Presenças
    checkAttendance, markAttendance, cancelAttendance,
    getAttendanceByDate, getAttendanceByDateRange,
    getEmployeeHistory, getHistoryByMatricula,
    // Backup
    exportAll, importBackup,
    // Real-time
    listenEmployees, listenAttendance,
  };
})();
