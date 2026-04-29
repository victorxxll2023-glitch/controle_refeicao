// ============================================================
// js/reports.js — Geração de Relatórios XLSX e PDF
// ============================================================

const Reports = (() => {

  /* ─────────────────── CONSOLIDAR DADOS ──────────────────── */

  function consolidate(attendanceRecords) {
    const map = {};
    for (const rec of attendanceRecords) {
      const key = rec.matricula;
      if (!map[key]) {
        map[key] = { name: rec.name, matricula: rec.matricula, setor: rec.setor, dates: [], total: 0 };
      }
      map[key].dates.push(rec.date);
      map[key].total++;
    }
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  /* ─────────────────── XLSX ───────────────────────────────── */

  function generateXLSX(records, periodLabel) {
    const XLSX = window.XLSX;
    if (!XLSX) { Utils.toast('Biblioteca XLSX não carregada.', 'error'); return null; }

    const wb = XLSX.utils.book_new();
    const ws = {};

    const accent   = '00C9A7';
    const darkBg   = '0A1E3C';
    const headerBg = '1A3A6C';
    const altRow   = 'EBF4FF';
    const white    = 'FFFFFF';
    const gray     = 'F0F4F8';
    const totalBg  = 'D0F0E8';

    const centerBold = (bg, color = '0A1E3C', sz = 11) => ({
      font: { bold: true, color: { rgb: color }, sz, name: 'Arial' },
      fill: { fgColor: { rgb: bg }, patternType: 'solid' },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: borders(),
    });

    const borders = () => ({
      top:    { style: 'thin', color: { rgb: 'C5D5E8' } },
      bottom: { style: 'thin', color: { rgb: 'C5D5E8' } },
      left:   { style: 'thin', color: { rgb: 'C5D5E8' } },
      right:  { style: 'thin', color: { rgb: 'C5D5E8' } },
    });

    const cell = (v, bold = false, bg = white, color = '0A1E3C', halign = 'left', sz = 10) => ({
      v, t: typeof v === 'number' ? 'n' : 's',
      s: {
        font: { bold, color: { rgb: color }, sz, name: 'Arial' },
        fill: { fgColor: { rgb: bg }, patternType: 'solid' },
        alignment: { horizontal: halign, vertical: 'center', wrapText: true },
        border: borders(),
      }
    });

    let row = 1;

    // ── Título principal ──────────────────────────────────
    ws[`A${row}`] = { v: 'LIGA NORTE-RIOGRANDENSE CONTRA O CÂNCER', t: 's', s: centerBold(darkBg, white, 13) };
    ws[`A${row+1}`] = { v: 'CECAN — Centro Avançado de Oncologia', t: 's', s: centerBold(darkBg, accent, 10) };
    ws[`A${row+2}`] = { v: 'RELATÓRIO DE CONTROLE DE REFEIÇÕES', t: 's', s: centerBold(accent, white, 12) };

    // Merge das 5 colunas para as 3 linhas de título
    for (let i = row; i <= row + 2; i++) {
      ['B','C','D','E'].forEach(col => {
        ws[`${col}${i}`] = { v: '', t: 's', s: { fill: { fgColor: { rgb: i === row || i === row+1 ? darkBg : accent }, patternType: 'solid' } } };
      });
    }
    row += 3;

    // ── Info do período ───────────────────────────────────
    ws[`A${row}`] = { v: `Período: ${periodLabel}`, t: 's', s: { font: { bold: true, sz: 10, name: 'Arial', color: { rgb: '1A3A6C' } }, fill: { fgColor: { rgb: gray }, patternType: 'solid' }, alignment: { horizontal: 'left', vertical: 'center' }, border: borders() } };
    ['B','C','D','E'].forEach(col => { ws[`${col}${row}`] = { v: '', t: 's', s: { fill: { fgColor: { rgb: gray }, patternType: 'solid' }, border: borders() } }; });
    row++;

    ws[`A${row}`] = { v: `Gerado em: ${new Date().toLocaleString('pt-BR')}`, t: 's', s: { font: { sz: 9, name: 'Arial', color: { rgb: '4A6A8A' } }, fill: { fgColor: { rgb: gray }, patternType: 'solid' }, alignment: { horizontal: 'left', vertical: 'center' }, border: borders() } };
    ['B','C','D','E'].forEach(col => { ws[`${col}${row}`] = { v: '', t: 's', s: { fill: { fgColor: { rgb: gray }, patternType: 'solid' }, border: borders() } }; });
    row++;

    // Linha vazia
    row++;

    // ── Resumo ────────────────────────────────────────────
    const totalRef = records.reduce((s, r) => s + r.total, 0);
    const media = records.length ? (totalRef / records.length).toFixed(1) : '0';

    ws[`A${row}`] = cell('Total de Funcionários', true, 'E8F4FD', '1A3A6C', 'center', 10);
    ws[`B${row}`] = cell(records.length, true, 'E8F4FD', '00A884', 'center', 14);
    ws[`C${row}`] = cell('Total de Refeições', true, 'E8F4FD', '1A3A6C', 'center', 10);
    ws[`D${row}`] = cell(totalRef, true, 'E8F4FD', '00A884', 'center', 14);
    ws[`E${row}`] = cell(`Média: ${media}/func.`, true, 'E8F4FD', '1A3A6C', 'center', 10);
    row++;
    row++; // espaço

    // ── Cabeçalho da tabela ───────────────────────────────
    ws[`A${row}`] = { v: 'NOME DO FUNCIONÁRIO', t: 's', s: centerBold(headerBg, white) };
    ws[`B${row}`] = { v: 'MATRÍCULA',           t: 's', s: centerBold(headerBg, white) };
    ws[`C${row}`] = { v: 'SETOR / UNIDADE',     t: 's', s: centerBold(headerBg, white) };
    ws[`D${row}`] = { v: 'TOTAL',               t: 's', s: centerBold(headerBg, white) };
    ws[`E${row}`] = { v: 'DATAS',               t: 's', s: centerBold(headerBg, white) };
    const dataStart = row + 1;
    row++;

    // ── Dados ─────────────────────────────────────────────
    records.forEach((r, i) => {
      const bg = i % 2 === 0 ? white : altRow;
      ws[`A${row}`] = cell(r.name,     false, bg, '0A1E3C', 'left');
      ws[`B${row}`] = cell(r.matricula,false, bg, '1A6A8A', 'center');
      ws[`C${row}`] = cell(r.setor,    false, bg, '0A1E3C', 'left');
      ws[`D${row}`] = cell(r.total,    true,  bg, '007A5E', 'center');
      ws[`E${row}`] = cell(r.dates.sort().map(Utils.fmtDate).join(' | '), false, bg, '4A5568', 'left', 9);
      row++;
    });

    // ── Linha de total ────────────────────────────────────
    ws[`A${row}`] = cell('TOTAL GERAL', true, totalBg, '0A1E3C', 'right');
    ws[`B${row}`] = cell('', false, totalBg);
    ws[`C${row}`] = cell(`${records.length} funcionário${records.length !== 1 ? 's' : ''}`, true, totalBg, '1A3A6C', 'center');
    ws[`D${row}`] = { v: totalRef, t: 'n', s: { font: { bold: true, sz: 12, color: { rgb: '007A5E' }, name: 'Arial' }, fill: { fgColor: { rgb: totalBg }, patternType: 'solid' }, alignment: { horizontal: 'center', vertical: 'center' }, border: borders() } };
    ws[`E${row}`] = cell('refeições no período', false, totalBg, '4A6A8A', 'left');
    row++;

    // ── Rodapé ────────────────────────────────────────────
    row++;
    ws[`A${row}`] = { v: 'Sistema de Controle de Refeições — CECAN · Liga Contra o Câncer', t: 's', s: { font: { italic: true, sz: 8, color: { rgb: '8A9AB0' }, name: 'Arial' }, alignment: { horizontal: 'left' } } };

    // ── Merges ────────────────────────────────────────────
    const merges = [
      // Título
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } },
      // Período
      { s: { r: 3, c: 0 }, e: { r: 3, c: 4 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: 4 } },
      // Rodapé
      { s: { r: row - 1, c: 0 }, e: { r: row - 1, c: 4 } },
    ];
    ws['!merges'] = merges;

    // ── Largura das colunas ───────────────────────────────
    ws['!cols'] = [
      { wch: 38 }, // Nome
      { wch: 14 }, // Matrícula
      { wch: 22 }, // Setor
      { wch: 10 }, // Total
      { wch: 42 }, // Datas
    ];

    // ── Altura das linhas ─────────────────────────────────
    ws['!rows'] = [];
    ws['!rows'][0] = { hpt: 28 }; // título 1
    ws['!rows'][1] = { hpt: 20 }; // título 2
    ws['!rows'][2] = { hpt: 24 }; // título 3
    ws['!rows'][6] = { hpt: 36 }; // resumo
    ws['!rows'][dataStart - 2] = { hpt: 22 }; // header tabela

    // Ref do range
    ws['!ref'] = `A1:E${row}`;

    XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
    return wb;
  }

  /* ─────────────────── PDF ────────────────────────────────── */

  function generatePDF(records, periodLabel) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = margin;

    doc.setFillColor(0, 168, 140);
    doc.rect(0, 0, pageW, 22, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text('LIGA NORTE-RIOGRANDENSE CONTRA O CÂNCER', pageW / 2, 9, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('CECAN — Centro Avançado de Oncologia', pageW / 2, 15, { align: 'center' });

    y = 30;
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
    doc.setDrawColor(220, 230, 240);
    doc.setLineWidth(0.4);
    doc.line(margin, y, pageW - margin, y);
    y += 6;

    const totalRef = records.reduce((s, r) => s + r.total, 0);
    doc.setFontSize(9);
    doc.setTextColor(50, 80, 110);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total de funcionários: ${records.length}`, margin, y);
    doc.text(`Total de refeições: ${totalRef}`, pageW / 2, y, { align: 'center' });
    doc.text(`Média por funcionário: ${records.length ? (totalRef / records.length).toFixed(1) : 0}`, pageW - margin, y, { align: 'right' });
    y += 8;

    doc.autoTable({
      startY: y,
      head: [['Nome', 'Matrícula', 'Setor', 'Total', 'Datas']],
      body: records.map(r => [r.name, r.matricula, r.setor, String(r.total), r.dates.sort().map(Utils.fmtDate).join(', ')]),
      margin: { left: margin, right: margin },
      headStyles: { fillColor: [0, 168, 140], textColor: 255, fontStyle: 'bold', fontSize: 9, cellPadding: 3 },
      bodyStyles: { fontSize: 8.5, cellPadding: 2.5, textColor: [30, 50, 80] },
      alternateRowStyles: { fillColor: [240, 248, 255] },
      columnStyles: {
        0: { cellWidth: 52 },
        1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 34 },
        3: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
        4: { cellWidth: 'auto', fontSize: 7.5 },
      },
      didDrawPage: (data) => {
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(7.5);
        doc.setTextColor(150, 170, 190);
        doc.text(`Página ${data.pageNumber} de ${pageCount} — Sistema de Controle de Refeições`, pageW / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
      },
    });

    return doc;
  }

  /* ─────────────────── DOWNLOAD ──────────────────────────── */

  async function downloadReport(type, period = 'week') {
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

    if (records.length === 0) {
      Utils.toast('Nenhuma refeição registrada nesse período.', 'warning');
      return null;
    }

    const safeLabel = label.replace(/\//g, '-').replace(/\s+/g, '_');

    if (type === 'csv') {
      // Gera XLSX no lugar de CSV
      const wb = generateXLSX(records, label);
      if (!wb) return null;
      window.XLSX.writeFile(wb, `refeicoes_${safeLabel}.xlsx`);
      Utils.toast('Planilha Excel gerada com sucesso!', 'success');
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

  return { consolidate, generateXLSX, generatePDF, downloadReport, getReportData };
})();
