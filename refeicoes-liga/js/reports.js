// ============================================================
// js/reports.js — Geração de Relatórios CSV e PDF
// ============================================================

const Reports = (() => {

  /* ─────────────────── CONSOLIDAR DADOS ──────────────────── */

  // Consolida presenças por funcionário dentro de um período
  function consolidate(attendanceRecords) {
    const map = {};

    for (const rec of attendanceRecords) {
      const key = rec.matricula;
      if (!map[key]) {
        map[key] = {
          name:      rec.name,
          matricula: rec.matricula,
          setor:     rec.setor,
          dates:     [],
          total:     0,
        };
      }
      map[key].dates.push(rec.date);
      map[key].total++;
    }

    // Ordenar por nome
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  /* ─────────────────── CSV ────────────────────────────────── */

  function generateCSV(records, periodLabel) {
    const rows = [
      ['Relatório de Refeições — Liga Contra o Câncer'],
      [`Período: ${periodLabel}`],
      [`Gerado em: ${new Date().toLocaleString('pt-BR')}`],
      [],
      ['Nome', 'Matrícula', 'Setor', 'Total de Refeições', 'Datas'],
    ];

    for (const r of records) {
      rows.push([
        r.name,
        r.matricula,
        r.setor,
        r.total,
        r.dates.sort().map(Utils.fmtDate).join(' | '),
      ]);
    }

    rows.push([]);
    rows.push([`Total geral: ${records.reduce((s, r) => s + r.total, 0)} refeições`]);
    rows.push([`Funcionários: ${records.length}`]);

    // Escapar campos com vírgula
    const csv = rows
      .map(row => row.map(c => {
        const s = String(c ?? '');
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      }).join(','))
      .join('\n');

    return '\uFEFF' + csv; // BOM para Excel abrir corretamente
  }

  /* ─────────────────── PDF ────────────────────────────────── */

  function generatePDF(records, periodLabel) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageW = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = margin;

    // ── Cabeçalho ──────────────────────────────────────────
    // Barra de topo
    doc.setFillColor(0, 168, 140); // #00a88c ≈ accent
    doc.rect(0, 0, pageW, 22, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text('LIGA NORTE-RIOGRANDENSE CONTRA O CÂNCER', pageW / 2, 9, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('CECAN — Centro Avançado de Oncologia', pageW / 2, 15, { align: 'center' });

    y = 30;

    // Título
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(10, 30, 60);
    doc.text('Relatório de Controle de Refeições', pageW / 2, y, { align: 'center' });
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 100, 130);
    doc.text(`Período: ${periodLabel}`, pageW / 2, y, { align: 'center' });
    y += 5;
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageW / 2, y, { align: 'center' });
    y += 8;

    // Linha divisória
    doc.setDrawColor(220, 230, 240);
    doc.setLineWidth(0.4);
    doc.line(margin, y, pageW - margin, y);
    y += 6;

    // Resumo rápido
    const totalRef = records.reduce((s, r) => s + r.total, 0);
    doc.setFontSize(9);
    doc.setTextColor(50, 80, 110);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total de funcionários: ${records.length}`, margin, y);
    doc.text(`Total de refeições: ${totalRef}`, pageW / 2, y, { align: 'center' });
    doc.text(`Média por funcionário: ${records.length ? (totalRef / records.length).toFixed(1) : 0}`, pageW - margin, y, { align: 'right' });
    y += 8;

    // ── Tabela ──────────────────────────────────────────────
    const headers = [['Nome', 'Matrícula', 'Setor', 'Total', 'Datas']];
    const body = records.map(r => [
      r.name,
      r.matricula,
      r.setor,
      String(r.total),
      r.dates.sort().map(Utils.fmtDate).join(', '),
    ]);

    doc.autoTable({
      startY:    y,
      head:      headers,
      body:      body,
      margin:    { left: margin, right: margin },
      headStyles: {
        fillColor: [0, 168, 140],
        textColor: 255,
        fontStyle:  'bold',
        fontSize:   9,
        cellPadding: 3,
      },
      bodyStyles: {
        fontSize:    8.5,
        cellPadding: 2.5,
        textColor:   [30, 50, 80],
      },
      alternateRowStyles: { fillColor: [240, 248, 255] },
      columnStyles: {
        0: { cellWidth: 52 },
        1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 34 },
        3: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
        4: { cellWidth: 'auto', fontSize: 7.5 },
      },
      didDrawPage: (data) => {
        // Rodapé
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(7.5);
        doc.setTextColor(150, 170, 190);
        doc.text(
          `Página ${data.pageNumber} de ${pageCount} — Sistema de Controle de Refeições`,
          pageW / 2,
          doc.internal.pageSize.getHeight() - 8,
          { align: 'center' }
        );
      },
    });

    return doc;
  }

  /* ─────────────────── DOWNLOAD ──────────────────────────── */

  async function downloadReport(type, period = 'week') {
    // Determinar intervalo
    let range, label;
    if (period === 'week') {
      range = Utils.getCurrentWeekRange();
      label = `Semana ${range.label}`;
    } else if (period === 'lastweek') {
      range = Utils.getLastWeekRange();
      label = `Semana ${range.label}`;
    } else {
      range = Utils.getCurrentMonthRange();
      label = range.label;
    }

    // Buscar dados
    const attendance = await DB.getAttendanceByDateRange(range.start, range.end);
    const records    = consolidate(attendance);

    if (records.length === 0) {
      Utils.toast('Nenhuma refeição registrada nesse período.', 'warning');
      return null;
    }

    const safeLabel = label.replace(/\//g, '-').replace(/\s+/g, '_');

    if (type === 'csv') {
      const csv = generateCSV(records, label);
      Utils.downloadFile(csv, `refeicoes_${safeLabel}.csv`, 'text/csv;charset=utf-8');
      Utils.toast('CSV baixado com sucesso!', 'success');
    } else {
      const doc = generatePDF(records, label);
      doc.save(`refeicoes_${safeLabel}.pdf`);
      Utils.toast('PDF gerado com sucesso!', 'success');
    }

    return records;
  }

  /* ─────────────────── RELATÓRIO NA TELA ─────────────────── */

  async function getReportData(period = 'week') {
    let range, label;
    if (period === 'week') {
      range = Utils.getCurrentWeekRange();
      label = `Semana ${range.label}`;
    } else if (period === 'lastweek') {
      range = Utils.getLastWeekRange();
      label = `Semana ${range.label}`;
    } else {
      range = Utils.getCurrentMonthRange();
      label = range.label;
    }

    const attendance = await DB.getAttendanceByDateRange(range.start, range.end);
    const records    = consolidate(attendance);

    return { records, label, range };
  }

  return { consolidate, generateCSV, generatePDF, downloadReport, getReportData };
})();
