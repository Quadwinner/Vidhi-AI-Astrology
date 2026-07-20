import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const MAROON: [number, number, number] = [97, 7, 43];
const GOLD: [number, number, number] = [229, 180, 91];
const DARK: [number, number, number] = [13, 12, 11];
const CREAM: [number, number, number] = [251, 243, 226];
const INK: [number, number, number] = [46, 34, 28];
const MUTED: [number, number, number] = [120, 100, 88];

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 44;
const CONTENT_W = PAGE_W - MARGIN * 2;

interface Profile {
  name: string; gender?: string; date_of_birth: string; time_of_birth: string; birth_place: string;
}
interface AstroBundle { chart_data?: any; processed_tables?: any; }

function svgToPng(svg: string, size = 720): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const cleaned = svg.replace(/<rect[^>]*fill="white"[^>]*\/>/i, '');
      const uri = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(cleaned)));
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('no ctx'));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('svg load failed'));
      img.src = uri;
    } catch (e) {
      reject(e as Error);
    }
  });
}

function prettyKey(k: string): string {
  return k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function toCell(v: any): string {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.map(toCell).filter(Boolean).join(', ');
  return '';
}

function tableFromRows(rows: any[], preferred?: string[]): { head: string[]; body: string[][] } | null {
  if (!Array.isArray(rows) || rows.length === 0 || typeof rows[0] !== 'object') return null;
  let keys = Object.keys(rows[0]).filter((k) => {
    const v = rows[0][k];
    return v === null || ['string', 'number', 'boolean'].includes(typeof v) || Array.isArray(v);
  });
  if (preferred && preferred.length) {
    const present = preferred.filter((k) => keys.includes(k));
    if (present.length) keys = present;
  }
  keys = keys.slice(0, 7);
  const head = keys.map(prettyKey);
  const body = rows.map((r) => keys.map((k) => toCell(r[k])));
  return { head, body };
}

export async function generateKundliPdf(profile: Profile, astro: AstroBundle): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pt = astro.processed_tables || {};
  const cd = astro.chart_data || {};

  drawCover(doc, profile);

  const northSvg: string | null =
    (typeof cd.north_chart_svg === 'string' && cd.north_chart_svg) ||
    (pt.divisional_chart_svgs && pt.divisional_chart_svgs.D1) || null;

  doc.addPage();
  let y = pageHeader(doc, 'Birth Chart (Lagna Kundli)');
  if (northSvg && !/out of api calls|renew subscription|error/i.test(northSvg)) {
    try {
      const png = await svgToPng(northSvg);
      const side = 320;
      doc.addImage(png, 'PNG', (PAGE_W - side) / 2, y + 8, side, side);
      y += side + 24;
    } catch { /* skip chart if it can't render */ }
  } else {
    y = note(doc, 'Birth chart image is unavailable for this profile.', y + 8);
  }

  const sections: { title: string; rows: any[]; preferred?: string[] }[] = [
    { title: 'Planetary Positions', rows: pt.d1_planets, preferred: ['Planet', 'Sign', 'Zodiac', 'House', 'Degree', 'Nakshatra', 'Retro'] },
    { title: 'Houses', rows: pt.houses, preferred: ['House', 'Sign', 'Zodiac', 'Lord', 'Planets', 'Aspected By'] },
    { title: 'Vimshottari Dasha', rows: pt.vimshottari_dasha },
    { title: 'Yogas', rows: pt.yogas },
    { title: 'Remedies', rows: pt.remedies },
  ];

  for (const s of sections) {
    const tbl = tableFromRows(s.rows, s.preferred);
    if (!tbl) continue;
    y = ensureSpace(doc, y, 90);
    y = sectionTitle(doc, s.title, y);
    autoTable(doc, {
      head: [tbl.head],
      body: tbl.body,
      startY: y + 6,
      margin: { left: MARGIN, right: MARGIN },
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, textColor: INK, lineColor: [225, 214, 196], lineWidth: 0.5 },
      headStyles: { fillColor: MAROON, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      alternateRowStyles: { fillColor: [250, 244, 232] },
      theme: 'grid',
    });
    y = (doc as any).lastAutoTable.finalY + 24;
  }

  const doshas = pt.doshas;
  if (doshas && typeof doshas === 'object') {
    const doshaRows = Array.isArray(doshas) ? doshas : Object.entries(doshas).map(([k, v]) => ({ Dosha: prettyKey(k), Details: toCell(v) }));
    const tbl = tableFromRows(doshaRows);
    if (tbl) {
      y = ensureSpace(doc, y, 90);
      y = sectionTitle(doc, 'Doshas', y);
      autoTable(doc, {
        head: [tbl.head], body: tbl.body, startY: y + 6,
        margin: { left: MARGIN, right: MARGIN },
        styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, textColor: INK, lineColor: [225, 214, 196], lineWidth: 0.5 },
        headStyles: { fillColor: MAROON, textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 244, 232] },
        theme: 'grid',
      });
      y = (doc as any).lastAutoTable.finalY + 24;
    }
  }

  const divSvgs = pt.divisional_chart_svgs || {};
  const divKeys = Object.keys(divSvgs).filter((k) => /^D\d+$/.test(k) && k !== 'D1').slice(0, 4);
  for (const key of divKeys) {
    const svg = divSvgs[key];
    if (typeof svg !== 'string' || /out of api calls|renew subscription|error/i.test(svg)) continue;
    try {
      const png = await svgToPng(svg);
      y = ensureSpace(doc, y, 300);
      y = sectionTitle(doc, `Divisional Chart ${key}`, y);
      const side = 260;
      doc.addImage(png, 'PNG', (PAGE_W - side) / 2, y + 8, side, side);
      y += side + 24;
    } catch { /* skip */ }
  }

  addFooters(doc);
  const safeName = (profile.name || 'Kundli').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
  doc.save(`Vidhi-Kundli-${safeName}.pdf`);
}

function drawCover(doc: jsPDF, profile: Profile) {
  doc.setFillColor(...DARK);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
  doc.setFillColor(...MAROON);
  doc.rect(0, 0, PAGE_W, 210, 'F');

  doc.setTextColor(...GOLD);
  doc.setFont('times', 'bold');
  doc.setFontSize(46);
  doc.text('Vidhi', PAGE_W / 2, 120, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...CREAM);
  doc.text('VEDIC ASTROLOGY', PAGE_W / 2, 148, { align: 'center', charSpace: 3 });

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1);
  doc.line(MARGIN, 300, PAGE_W - MARGIN, 300);

  doc.setFont('times', 'bold');
  doc.setFontSize(34);
  doc.setTextColor(...GOLD);
  doc.text('Kundli Report', PAGE_W / 2, 360, { align: 'center' });

  doc.setFont('times', 'italic');
  doc.setFontSize(26);
  doc.setTextColor(...CREAM);
  doc.text(profile.name || 'Your Chart', PAGE_W / 2, 400, { align: 'center' });

  const details: [string, string][] = [
    ['Date of Birth', fmtDate(profile.date_of_birth)],
    ['Time of Birth', fmtTime(profile.time_of_birth)],
    ['Place of Birth', profile.birth_place || '-'],
  ];
  if (profile.gender) details.push(['Gender', profile.gender]);

  let dy = 470;
  doc.setFontSize(12);
  for (const [label, val] of details) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GOLD);
    doc.text(label.toUpperCase(), PAGE_W / 2, dy, { align: 'center', charSpace: 1.5 });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...CREAM);
    doc.setFontSize(14);
    doc.text(val, PAGE_W / 2, dy + 20, { align: 'center' });
    doc.setFontSize(12);
    dy += 56;
  }

  doc.setDrawColor(...GOLD);
  doc.line(MARGIN, PAGE_H - 90, PAGE_W - MARGIN, PAGE_H - 90);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GOLD);
  doc.text(`Generated on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, PAGE_W / 2, PAGE_H - 66, { align: 'center' });
}

function pageHeader(doc: jsPDF, title: string): number {
  doc.setFillColor(...CREAM);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
  return sectionTitle(doc, title, MARGIN + 6);
}

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFont('times', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...MAROON);
  doc.text(title, MARGIN, y);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1.5);
  doc.line(MARGIN, y + 6, MARGIN + 46, y + 6);
  return y + 22;
}

function note(doc: jsPDF, text: string, y: number): number {
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(text, MARGIN, y);
  return y + 20;
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_H - MARGIN) {
    doc.addPage();
    doc.setFillColor(...CREAM);
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
    return MARGIN + 6;
  }
  return y;
}

function addFooters(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, PAGE_H - 34, PAGE_W - MARGIN, PAGE_H - 34);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text('Vidhi · Vedic Astrology', MARGIN, PAGE_H - 20);
    doc.text(`Page ${i} of ${total}`, PAGE_W - MARGIN, PAGE_H - 20, { align: 'right' });
  }
}

function fmtDate(d: string): string {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtTime(t: string): string {
  if (!t) return '-';
  const [h, m] = t.split(':');
  if (h === undefined || m === undefined) return t;
  const hr = parseInt(h, 10);
  const ampm = hr >= 12 ? 'PM' : 'AM';
  const h12 = hr % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}
