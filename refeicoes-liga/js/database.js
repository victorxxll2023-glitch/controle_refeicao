// ============================================================
// js/database.js — Operações Firestore
// ============================================================
// Estrutura de coleções:
//   employees/{id}       → dados do funcionário
//   attendance/{id}      → registro de presença (id = YYYY-MM-DD_matricula)
// ============================================================

const DB = (() => {
  const COL_EMP  = 'employees';
  const COL_ATT  = 'attendance';

  /* ─────────────────── FUNCIONÁRIOS ─────────────────────── */

  // Listar todos os funcionários (ordenados por nome)
  async function getEmployees() {
    try {
      const snap = await db.collection(COL_EMP)
        .orderBy('name')
        .get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error('getEmployees:', err);
      throw err;
    }
  }

  // Buscar funcionário por matrícula
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

  // Adicionar funcionário
  async function addEmployee({ name, matricula, setor }) {
    // Verificar matrícula duplicada
    const existing = await getEmployeeByMatricula(matricula);
    if (existing) {
      throw new Error('Já existe um funcionário com essa matrícula.');
    }
    return db.collection(COL_EMP).add({
      name:      name.trim(),
      matricula: String(matricula).trim(),
      setor:     setor.trim(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Atualizar funcionário
  async function updateEmployee(id, { name, matricula, setor }) {
    // Verificar se matrícula já pertence a outro
    const existing = await getEmployeeByMatricula(matricula);
    if (existing && existing.id !== id) {
      throw new Error('Já existe um funcionário com essa matrícula.');
    }
    return db.collection(COL_EMP).doc(id).update({
      name:      name.trim(),
      matricula: String(matricula).trim(),
      setor:     setor.trim(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Excluir funcionário
  async function deleteEmployee(id) {
    return db.collection(COL_EMP).doc(id).delete();
  }

  /* ─────────────────── PRESENÇAS ────────────────────────── */

  // ID único de presença por dia: "YYYY-MM-DD_matricula"
  function _attId(date, matricula) {
    return `${date}_${String(matricula).trim()}`;
  }

  // Verificar se já marcou presença hoje
  async function checkAttendance(matricula, date) {
    const docRef = db.collection(COL_ATT).doc(_attId(date, matricula));
    const snap = await docRef.get();
    return snap.exists;
  }

  // Marcar presença
  async function markAttendance(employee, date, time) {
    const docId = _attId(date, employee.matricula);
    const docRef = db.collection(COL_ATT).doc(docId);

    // Verificar duplicidade
    const snap = await docRef.get();
    if (snap.exists) {
      throw new Error('Presença já registrada para hoje.');
    }

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

  // Cancelar presença do dia
  async function cancelAttendance(matricula, date) {
    const docId = _attId(date, matricula);
    return db.collection(COL_ATT).doc(docId).delete();
  }

  // Buscar todas as presenças de uma data
  async function getAttendanceByDate(date) {
    const snap = await db.collection(COL_ATT)
      .where('date', '==', date)
      .get();
    return snap.docs.map(d => d.data());
  }

  // Buscar presenças por intervalo de datas
  async function getAttendanceByDateRange(startDate, endDate) {
    const snap = await db.collection(COL_ATT)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();
    return snap.docs.map(d => d.data());
  }

  // Buscar histórico de um funcionário
  async function getEmployeeHistory(employeeId) {
    const snap = await db.collection(COL_ATT)
      .where('employeeId', '==', employeeId)
      .orderBy('date', 'desc')
      .get();
    return snap.docs.map(d => d.data());
  }

  // Buscar histórico por matrícula (alternativa)
  async function getHistoryByMatricula(matricula) {
    const snap = await db.collection(COL_ATT)
      .where('matricula', '==', String(matricula))
      .orderBy('date', 'desc')
      .get();
    return snap.docs.map(d => d.data());
  }

  /* ─────────────────── BACKUP ────────────────────────────── */

  // Exportar todos os dados em JSON
  async function exportAll() {
    const [employees, attendance] = await Promise.all([
      db.collection(COL_EMP).get(),
      db.collection(COL_ATT).get(),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      version:    '1.0',
      employees:  employees.docs.map(d => ({ id: d.id, ...d.data() })),
      attendance: attendance.docs.map(d => ({ id: d.id, ...d.data() })),
    };
  }

  // Importar backup JSON
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

    await batch.commit();
    return {
      employees:  data.employees.length,
      attendance: data.attendance.length,
    };
  }

  /* ─────────────────── TEMPO REAL ────────────────────────── */

  // Ouvir mudanças nos funcionários em tempo real
  function listenEmployees(callback) {
    return db.collection(COL_EMP)
      .orderBy('name')
      .onSnapshot(snap => {
        const employees = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(employees);
      });
  }

  // Ouvir presenças de uma data em tempo real
  function listenAttendance(date, callback) {
    return db.collection(COL_ATT)
      .where('date', '==', date)
      .onSnapshot(snap => {
        const records = snap.docs.map(d => d.data());
        callback(records);
      });
  }

  return {
    getEmployees,
    getEmployeeByMatricula,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    checkAttendance,
    markAttendance,
    cancelAttendance,
    getAttendanceByDate,
    getAttendanceByDateRange,
    getEmployeeHistory,
    getHistoryByMatricula,
    exportAll,
    importBackup,
    listenEmployees,
    listenAttendance,
  };
})();
