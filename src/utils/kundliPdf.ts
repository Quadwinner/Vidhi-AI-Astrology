import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const MAROON: [number, number, number] = [97, 7, 43];
const GOLD: [number, number, number] = [229, 180, 91];
const GOLD_DK: [number, number, number] = [199, 144, 47];
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

const VARGA_INFO: Record<string, { name: string; sig: string }> = {
  D1: { name: 'Rashi', sig: 'The main birth chart — overall life, body, personality and destiny.' },
  D2: { name: 'Hora', sig: 'Wealth, prosperity and material resources.' },
  D3: { name: 'Drekkana', sig: 'Siblings, courage, initiative and short journeys.' },
  D4: { name: 'Chaturthamsa', sig: 'Fortune, property, fixed assets and inner happiness.' },
  D7: { name: 'Saptamsa', sig: 'Children, progeny and creative legacy.' },
  D9: { name: 'Navamsa', sig: 'Marriage, dharma, fortune and the soul\u2019s strength.' },
  D10: { name: 'Dasamsa', sig: 'Career, profession, status and achievements.' },
  D12: { name: 'Dwadasamsa', sig: 'Parents, ancestry and inherited karma.' },
  D16: { name: 'Shodasamsa', sig: 'Vehicles, comforts, luxuries and happiness.' },
  D20: { name: 'Vimsamsa', sig: 'Spiritual progress, worship and devotion.' },
  D24: { name: 'Chaturvimsamsa', sig: 'Education, learning and knowledge.' },
  D27: { name: 'Bhamsa', sig: 'Innate strengths, weaknesses and stamina.' },
  D30: { name: 'Trimsamsa', sig: 'Misfortunes, health challenges and character.' },
  D40: { name: 'Khavedamsa', sig: 'Auspicious and inauspicious matrilineal effects.' },
  D45: { name: 'Akshavedamsa', sig: 'Overall character and conduct (patrilineal).' },
  D60: { name: 'Shashtiamsa', sig: 'Past-life karma and the finest life details.' },
  chalit: { name: 'Bhava Chalit', sig: 'House cusp chart — actual house placement of planets.' },
  moon: { name: 'Chandra (Moon)', sig: 'Chart cast from the Moon — mind and emotions.' },
  sun: { name: 'Surya (Sun)', sig: 'Chart cast from the Sun — soul and vitality.' },
};

const PLANET_COLS = ['Planet', 'House', 'Sign', 'Sign Lord', 'Degree', 'Retrograde', 'Nakshatra', 'Nakshatra Lord', 'Nakshatra Pada'];
const STRENGTH_COLS = ['Planet', 'Planet Status', 'Functional Nature', 'Is Combust', 'Planetary War', 'Vargottama', 'Shadbala (Total)', 'Ashtakavarga'];
const KARAK_COLS = ['Planet', 'Karak', 'Signifier'];

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
  } else {
    keys = keys.slice(0, 8);
  }
  const head = keys.map(prettyKey);
  const body = rows.map((r) => keys.map((k) => toCell(r[k])));
  return { head, body };
}

export async function generateKundliPdf(profile: Profile, astro: AstroBundle): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pt = astro.processed_tables || {};
  const cd = astro.chart_data || {};

  drawCover(doc, profile);

  let y = newContentPage(doc, 'Birth Snapshot');
  y = drawHighlights(doc, pt, y);

  const northSvg: string | null =
    (typeof cd.north_chart_svg === 'string' && cd.north_chart_svg) || null;
  if (northSvg && !isBadSvg(northSvg)) {
    y = ensureSpace(doc, y, 360);
    y = sectionTitle(doc, 'Lagna Chart (D1 Rashi)', y);
    try {
      const png = await svgToPng(northSvg);
      const side = 300;
      doc.addImage(png, 'PNG', (PAGE_W - side) / 2, y + 8, side, side);
      y += side + 24;
    } catch { /* skip */ }
  }

  y = renderTable(doc, y, 'Planetary Positions', pt.d1_planets, PLANET_COLS);
  y = renderTable(doc, y, 'Planetary Strengths & Dignities', pt.d1_planets, STRENGTH_COLS);
  y = renderTable(doc, y, 'Houses (Bhavas)', pt.houses, ['House', 'Sign', 'Zodiac', 'Lord', 'Planets', 'Aspected By']);
  y = renderTable(doc, y, 'Planetary Friendships', pt.planetary_friendship);
  y = renderTable(doc, y, 'Jaimini Karakas', pt.jaimini_karakas, KARAK_COLS);
  y = renderTable(doc, y, 'Yogas in Your Chart', pt.yogas);
  y = renderTable(doc, y, 'Doshas', doshaRows(pt.doshas));
  y = renderTable(doc, y, 'Remedies', pt.remedies);
  y = renderTable(doc, y, 'Vimshottari Dasha Timeline', pt.vimshottari_dasha,
    ['Mahadasha Lord', 'Antardasha Lord', 'Start Date', 'End Date']);

  await renderDivisionalCharts(doc, pt);

  addFooters(doc);
  const safeName = (profile.name || 'Kundli').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
  doc.save(`Vidhi-Kundli-${safeName}.pdf`);
}

function isBadSvg(svg: string): boolean {
  return /out of api calls|renew subscription|error/i.test(svg);
}

function doshaRows(doshas: any): any[] {
  if (!doshas || typeof doshas !== 'object') return [];
  if (Array.isArray(doshas)) return doshas;
  return Object.entries(doshas).map(([k, v]) => ({ Dosha: prettyKey(k), Details: toCell(v) }));
}

function renderTable(doc: jsPDF, y: number, title: string, rows: any[], preferred?: string[]): number {
  const tbl = tableFromRows(rows, preferred);
  if (!tbl) return y;
  y = ensureSpace(doc, y, 90);
  y = sectionTitle(doc, title, y);
  autoTable(doc, {
    head: [tbl.head],
    body: tbl.body,
    startY: y + 6,
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: CONTENT_W,
    styles: { font: 'helvetica', fontSize: 7.6, cellPadding: 4, textColor: INK, lineColor: [225, 214, 196], lineWidth: 0.5, overflow: 'linebreak' },
    headStyles: { fillColor: MAROON, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.8 },
    alternateRowStyles: { fillColor: [250, 244, 232] },
    theme: 'grid',
  });
  return (doc as any).lastAutoTable.finalY + 26;
}

async function renderDivisionalCharts(doc: jsPDF, pt: any) {
  const charts = pt.divisional_charts;
  if (!charts || typeof charts !== 'object') return;

  const svgs: Record<string, string> = pt.divisional_chart_svgs || {};
  const svgLookup: Record<string, string> = {};
  for (const [k, v] of Object.entries(svgs)) {
    if (typeof v !== 'string') continue;
    const norm = k.toUpperCase().replace(/_SVG$/, '').replace(/_CHART$/, '').replace(/[^A-Z0-9]/g, '');
    svgLookup[norm] = v;
  }

  const order = ['D1', 'D2', 'D3', 'D4', 'D7', 'D9', 'D10', 'D12', 'D16', 'D20', 'D24', 'D27', 'D30', 'D40', 'D45', 'D60', 'chalit', 'moon', 'sun'];
  const keys = Object.keys(charts).sort((a, b) => {
    const ia = order.indexOf(a); const ib = order.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  doc.addPage(); paintPageBg(doc);
  let y = sectionTitle(doc, 'Divisional Charts (Vargas)', MARGIN + 6);
  y = paragraph(doc, 'Each divisional chart magnifies one area of life. Below are the planetary placements for every varga available in your chart.', y, MUTED, 9);
  y += 6;

  for (const key of keys) {
    const rows = charts[key];
    if (!Array.isArray(rows) || rows.length === 0) continue;
    const info = VARGA_INFO[key] || { name: '', sig: '' };
    const heading = info.name ? `${key} \u00b7 ${info.name}` : key;

    y = ensureSpace(doc, y, 120);
    y = sectionTitle(doc, heading, y);
    if (info.sig) y = paragraph(doc, info.sig, y, MUTED, 8.5);

    const norm = key.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const svg = svgLookup[norm];
    if (svg && !isBadSvg(svg)) {
      try {
        const png = await svgToPng(svg);
        y = ensureSpace(doc, y, 230);
        const side = 210;
        doc.addImage(png, 'PNG', (PAGE_W - side) / 2, y + 4, side, side);
        y += side + 12;
      } catch { /* skip image */ }
    }

    y = renderTable(doc, y, '', rows, ['Planet', 'Sign', 'House', 'Degree', 'Retrograde']);
  }
}

function drawHighlights(doc: jsPDF, pt: any, y: number): number {
  const planets: any[] = Array.isArray(pt.d1_planets) ? pt.d1_planets : [];
  const find = (n: string) => planets.find((p) => (p.Planet || '').toLowerCase() === n);
  const asc = find('ascendant');
  const moon = find('moon');
  const sun = find('sun');

  const items: [string, string][] = [
    ['Ascendant (Lagna)', asc ? `${asc.Sign || '-'}` : '-'],
    ['Moon Sign (Rashi)', moon ? `${moon.Sign || '-'}` : '-'],
    ['Sun Sign', sun ? `${sun.Sign || '-'}` : '-'],
    ['Nakshatra', moon ? `${moon.Nakshatra || '-'}${moon['Nakshatra Pada'] ? ' \u00b7 Pada ' + moon['Nakshatra Pada'] : ''}` : '-'],
  ];

  const cardW = (CONTENT_W - 12) / 2;
  const cardH = 56;
  items.forEach((it, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN + col * (cardW + 12);
    const cy = y + row * (cardH + 12);
    doc.setFillColor(250, 244, 232);
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.8);
    doc.roundedRect(x, cy, cardW, cardH, 8, 8, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...GOLD_DK);
    doc.text(it[0].toUpperCase(), x + 14, cy + 22, { charSpace: 0.5 });
    doc.setFont('times', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...MAROON);
    doc.text(it[1], x + 14, cy + 42);
  });

  return y + Math.ceil(items.length / 2) * (cardH + 12) + 12;
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
  doc.text('Full Kundli Report', PAGE_W / 2, 360, { align: 'center' });

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

function paintPageBg(doc: jsPDF) {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
}

function newContentPage(doc: jsPDF, title: string): number {
  doc.addPage();
  paintPageBg(doc);
  return sectionTitle(doc, title, MARGIN + 6);
}

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  if (!title) return y;
  doc.setFont('times', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...MAROON);
  doc.text(title, MARGIN, y);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1.5);
  doc.line(MARGIN, y + 6, MARGIN + 46, y + 6);
  return y + 22;
}

function paragraph(doc: jsPDF, text: string, y: number, color: [number, number, number] = INK, size = 10): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(size);
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(text, CONTENT_W);
  doc.text(lines, MARGIN, y);
  return y + lines.length * (size + 3) + 4;
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_H - MARGIN) {
    doc.addPage();
    paintPageBg(doc);
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
    doc.text('Vidhi \u00b7 Vedic Astrology', MARGIN, PAGE_H - 20);
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
