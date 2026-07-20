import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

interface Profile {
  name: string; gender?: string; date_of_birth: string; time_of_birth: string; birth_place: string;
}
interface AstroBundle { chart_data?: any; processed_tables?: any; }

const PLANETS: Record<string, string> = {
  Sun: 'सूर्य', Moon: 'चंद्र', Mars: 'मंगल', Mercury: 'बुध', Jupiter: 'गुरु', Venus: 'शुक्र',
  Saturn: 'शनि', Rahu: 'राहु', Ketu: 'केतु', Ascendant: 'लग्न', Uranus: 'यूरेनस', Neptune: 'नेपच्यून', Pluto: 'प्लूटो',
  Su: 'सूर्य', Mo: 'चंद्र', Ma: 'मंगल', Me: 'बुध', Ju: 'गुरु', Ve: 'शुक्र', Sa: 'शनि', Ra: 'राहु', Ke: 'केतु', As: 'लग्न',
};
const SIGNS: Record<string, string> = {
  Aries: 'मेष', Taurus: 'वृषभ', Gemini: 'मिथुन', Cancer: 'कर्क', Leo: 'सिंह', Virgo: 'कन्या',
  Libra: 'तुला', Scorpio: 'वृश्चिक', Sagittarius: 'धनु', Capricorn: 'मकर', Aquarius: 'कुम्भ', Pisces: 'मीन',
};
const NAKSHATRAS: Record<string, string> = {
  Ashwini: 'अश्विनी', Bharani: 'भरणी', Krittika: 'कृत्तिका', Rohini: 'रोहिणी', Mrigashira: 'मृगशिरा', Mrigashirsha: 'मृगशिरा',
  Ardra: 'आर्द्रा', Punarvasu: 'पुनर्वसु', Pushya: 'पुष्य', Ashlesha: 'आश्लेषा', Magha: 'मघा',
  'Purva Phalguni': 'पूर्व फाल्गुनी', 'Uttara Phalguni': 'उत्तर फाल्गुनी', Hasta: 'हस्त', Chitra: 'चित्रा',
  Swati: 'स्वाति', Vishakha: 'विशाखा', Anuradha: 'अनुराधा', Jyeshtha: 'ज्येष्ठा', Mula: 'मूल', Moola: 'मूल',
  'Purva Ashadha': 'पूर्वाषाढ़ा', 'Uttara Ashadha': 'उत्तराषाढ़ा', Shravana: 'श्रवण', Dhanishta: 'धनिष्ठा',
  Shatabhisha: 'शतभिषा', 'Purva Bhadrapada': 'पूर्व भाद्रपद', 'Uttara Bhadrapada': 'उत्तर भाद्रपद', Revati: 'रेवती',
};
const STATUS: Record<string, string> = {
  Exalted: 'उच्च', Debilitated: 'नीच', 'Own House': 'स्वगृही', 'Own Sign': 'स्वराशि', Mooltrikona: 'मूलत्रिकोण',
  Friendly: 'मित्र', Enemy: 'शत्रु', Neutral: 'सम', Benefic: 'शुभ', Malefic: 'पाप', Yogakaraka: 'योगकारक',
  Maraka: 'मारक', Badhaka: 'बाधक', Combust: 'अस्त', Yes: 'हाँ', No: 'नहीं', 'N/A': '—', Retrograde: 'वक्री',
};
const VALUE_MAP: Record<string, string> = { ...PLANETS, ...SIGNS, ...NAKSHATRAS, ...STATUS };

const HEADERS: Record<string, string> = {
  Planet: 'ग्रह', House: 'भाव', Sign: 'राशि', Zodiac: 'राशि', 'Sign Lord': 'राशि स्वामी', Lord: 'स्वामी',
  Degree: 'अंश', Retrograde: 'वक्री', Nakshatra: 'नक्षत्र', 'Nakshatra Lord': 'नक्षत्र स्वामी', 'Nakshatra Pada': 'नक्षत्र पद',
  'Planet Status': 'ग्रह स्थिति', 'Functional Nature': 'कार्यात्मक प्रकृति', 'Is Combust': 'अस्त', 'Planetary War': 'ग्रह युद्ध',
  Vargottama: 'वर्गोत्तम', 'Shadbala (Total)': 'षड्बल (कुल)', 'Shadbala (Ratio)': 'षड्बल (अनुपात)', Ashtakavarga: 'अष्टकवर्ग',
  Karak: 'कारक', Signifier: 'कारकत्व', Planets: 'ग्रह', 'Aspected By': 'दृष्ट (द्वारा)', Friends: 'मित्र', Enemies: 'शत्रु',
  'Mahadasha Lord': 'महादशा स्वामी', 'Antardasha Lord': 'अंतर्दशा स्वामी', 'Start Date': 'प्रारंभ तिथि', 'End Date': 'समाप्ति तिथि',
  Dosha: 'दोष', Details: 'विवरण', Info: 'सूचना',
};

const LABELS = {
  brand: 'विधि', sub: 'वैदिक ज्योतिष', title: 'सम्पूर्ण कुंडली रिपोर्ट', dob: 'जन्म तिथि', tob: 'जन्म समय',
  pob: 'जन्म स्थान', gender: 'लिंग', generated: 'तैयार की गई', snapshot: 'जन्म सारांश',
  ascendant: 'लग्न', moonSign: 'चंद्र राशि', sunSign: 'सूर्य राशि', nakshatra: 'नक्षत्र', pada: 'पद',
  lagnaChart: 'लग्न कुंडली (D1 राशि)', positions: 'ग्रहों की स्थिति', strengths: 'ग्रह बल एवं स्थिति',
  houses: 'भाव (घर)', friendships: 'ग्रह मैत्री', karakas: 'जैमिनी कारक', yogas: 'आपकी कुंडली के योग',
  doshas: 'दोष', remedies: 'उपाय', dasha: 'विंशोत्तरी दशा काल', vargas: 'वर्ग कुंडलियाँ',
  vargasIntro: 'प्रत्येक वर्ग कुंडली जीवन के एक क्षेत्र को विस्तार से दर्शाती है। नीचे आपकी कुंडली में उपलब्ध सभी वर्गों की ग्रह स्थिति दी गई है।',
  footer: 'विधि · वैदिक ज्योतिष', page: 'पृष्ठ',
};

const VARGA: Record<string, { name: string; sig: string }> = {
  D1: { name: 'राशि', sig: 'मुख्य जन्म कुंडली — समग्र जीवन, शरीर, व्यक्तित्व और भाग्य।' },
  D2: { name: 'होरा', sig: 'धन, समृद्धि और भौतिक संसाधन।' },
  D3: { name: 'द्रेष्काण', sig: 'भाई-बहन, साहस और अल्प यात्राएँ।' },
  D4: { name: 'चतुर्थांश', sig: 'भाग्य, संपत्ति और आंतरिक सुख।' },
  D7: { name: 'सप्तांश', sig: 'संतान और वंश।' },
  D9: { name: 'नवांश', sig: 'विवाह, धर्म, भाग्य और आत्मबल।' },
  D10: { name: 'दशांश', sig: 'करियर, व्यवसाय और प्रतिष्ठा।' },
  D12: { name: 'द्वादशांश', sig: 'माता-पिता और पूर्वज।' },
  D16: { name: 'षोडशांश', sig: 'वाहन, सुख-सुविधाएँ।' },
  D20: { name: 'विंशांश', sig: 'आध्यात्मिक प्रगति और उपासना।' },
  D24: { name: 'चतुर्विंशांश', sig: 'शिक्षा और ज्ञान।' },
  D27: { name: 'भांश', sig: 'सहज शक्ति, दुर्बलता और सहनशक्ति।' },
  D30: { name: 'त्रिंशांश', sig: 'कष्ट, स्वास्थ्य और चरित्र।' },
  D40: { name: 'खवेदांश', sig: 'मातृ पक्ष के शुभ-अशुभ प्रभाव।' },
  D45: { name: 'अक्षवेदांश', sig: 'समग्र चरित्र और आचरण।' },
  D60: { name: 'षष्ट्यांश', sig: 'पूर्व जन्म के कर्म और सूक्ष्म विवरण।' },
  chalit: { name: 'भाव चलित', sig: 'भाव कुंडली — ग्रहों की वास्तविक भाव स्थिति।' },
  moon: { name: 'चंद्र', sig: 'चंद्र से बनी कुंडली — मन और भावनाएँ।' },
  sun: { name: 'सूर्य', sig: 'सूर्य से बनी कुंडली — आत्मा और जीवनशक्ति।' },
};

function esc(s: any): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const VALUE_KEYS = Object.keys(VALUE_MAP).sort((a, b) => b.length - a.length);

function trVal(v: any): string {
  if (v === null || v === undefined) return '—';
  let s = String(v);
  if (VALUE_MAP[s]) return VALUE_MAP[s];
  for (const k of VALUE_KEYS) {
    if (s.includes(k)) {
      s = s.split(k).join(VALUE_MAP[k]);
    }
  }
  return s;
}

function trHeader(h: string): string {
  return HEADERS[h] || h;
}

const PLANET_COLS = ['Planet', 'House', 'Sign', 'Sign Lord', 'Degree', 'Retrograde', 'Nakshatra', 'Nakshatra Lord', 'Nakshatra Pada'];
const STRENGTH_COLS = ['Planet', 'Planet Status', 'Functional Nature', 'Is Combust', 'Planetary War', 'Vargottama', 'Shadbala (Total)', 'Ashtakavarga'];
const KARAK_COLS = ['Planet', 'Karak', 'Signifier'];
const HOUSE_COLS = ['House', 'Sign', 'Zodiac', 'Lord', 'Planets', 'Aspected By'];
const DASHA_COLS = ['Mahadasha Lord', 'Antardasha Lord', 'Start Date', 'End Date'];
const DIV_COLS = ['Planet', 'Sign', 'House', 'Degree', 'Retrograde'];

function prettyKey(k: string): string {
  return k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
function cellRaw(v: any): string {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.map(cellRaw).filter(Boolean).join(', ');
  if (typeof v === 'object') return '';
  return String(v);
}
function isBadSvg(svg: string): boolean { return /out of api calls|renew subscription|error/i.test(svg); }
function svgDataUri(svg: string): string {
  const cleaned = svg.replace(/<rect[^>]*fill="white"[^>]*\/>/i, '');
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(cleaned)));
}

function tableHtml(rows: any[], preferred?: string[]): string {
  if (!Array.isArray(rows) || rows.length === 0 || typeof rows[0] !== 'object') return '';
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
  const head = keys.map((k) => `<th>${esc(trHeader(prettyKey(k)))}</th>`).join('');
  const body = rows.map((r) => {
    const tds = keys.map((k) => `<td>${esc(trVal(cellRaw(r[k])))}</td>`).join('');
    return `<tr>${tds}</tr>`;
  }).join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function section(title: string, inner: string): string {
  if (!inner) return '';
  return `<div class="sec"><h2>${esc(title)}</h2>${inner}</div>`;
}

function doshaRows(doshas: any): any[] {
  if (!doshas || typeof doshas !== 'object') return [];
  if (Array.isArray(doshas)) return doshas;
  return Object.entries(doshas).map(([k, v]) => ({ Dosha: prettyKey(k), Details: cellRaw(v) }));
}

function buildHtml(profile: Profile, astro: AstroBundle): string {
  const pt = astro.processed_tables || {};
  const cd = astro.chart_data || {};
  const planets: any[] = Array.isArray(pt.d1_planets) ? pt.d1_planets : [];
  const find = (n: string) => planets.find((p) => (p.Planet || '').toLowerCase() === n);
  const asc = find('ascendant'); const moon = find('moon'); const sun = find('sun');

  const cards = [
    [LABELS.ascendant, asc ? trVal(asc.Sign) : '—'],
    [LABELS.moonSign, moon ? trVal(moon.Sign) : '—'],
    [LABELS.sunSign, sun ? trVal(sun.Sign) : '—'],
    [LABELS.nakshatra, moon ? `${trVal(moon.Nakshatra)}${moon['Nakshatra Pada'] ? ' · ' + LABELS.pada + ' ' + moon['Nakshatra Pada'] : ''}` : '—'],
  ].map(([l, v]) => `<div class="card"><div class="cl">${esc(l)}</div><div class="cv">${esc(v)}</div></div>`).join('');

  let html = '';
  html += `<div class="cover">
    <div class="cbrand">${LABELS.brand}</div>
    <div class="csub">${LABELS.sub}</div>
    <div class="cline"></div>
    <div class="ctitle">${LABELS.title}</div>
    <div class="cname">${esc(profile.name || '')}</div>
    <div class="cdetails">
      <div><span>${LABELS.dob}</span>${esc(fmtDate(profile.date_of_birth))}</div>
      <div><span>${LABELS.tob}</span>${esc(fmtTime(profile.time_of_birth))}</div>
      <div><span>${LABELS.pob}</span>${esc(profile.birth_place || '—')}</div>
      ${profile.gender ? `<div><span>${LABELS.gender}</span>${esc(profile.gender)}</div>` : ''}
    </div>
    <div class="cgen">${LABELS.generated}: ${esc(new Date().toLocaleDateString('hi-IN', { day: 'numeric', month: 'long', year: 'numeric' }))}</div>
  </div>`;

  html += `<div class="sec"><h2>${LABELS.snapshot}</h2><div class="cards">${cards}</div></div>`;

  const northSvg: string | null = (typeof cd.north_chart_svg === 'string' && cd.north_chart_svg) || null;
  if (northSvg && !isBadSvg(northSvg)) {
    html += `<div class="sec"><h2>${LABELS.lagnaChart}</h2><div class="chartwrap"><img src="${svgDataUri(northSvg)}"/></div></div>`;
  }

  html += section(LABELS.positions, tableHtml(pt.d1_planets, PLANET_COLS));
  html += section(LABELS.strengths, tableHtml(pt.d1_planets, STRENGTH_COLS));
  html += section(LABELS.houses, tableHtml(pt.houses, HOUSE_COLS));
  html += section(LABELS.friendships, tableHtml(pt.planetary_friendship));
  html += section(LABELS.karakas, tableHtml(pt.jaimini_karakas, KARAK_COLS));
  html += section(LABELS.yogas, tableHtml(pt.yogas));
  html += section(LABELS.doshas, tableHtml(doshaRows(pt.doshas)));
  html += section(LABELS.remedies, tableHtml(pt.remedies));
  html += section(LABELS.dasha, tableHtml(pt.vimshottari_dasha, DASHA_COLS));

  const charts = pt.divisional_charts;
  if (charts && typeof charts === 'object') {
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
    let divInner = `<p class="intro">${LABELS.vargasIntro}</p>`;
    for (const key of keys) {
      const rows = charts[key];
      if (!Array.isArray(rows) || rows.length === 0) continue;
      const info = VARGA[key] || { name: '', sig: '' };
      const heading = info.name ? `${key} · ${info.name}` : key;
      const norm = key.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const svg = svgLookup[norm];
      const img = svg && !isBadSvg(svg) ? `<div class="chartwrap sm"><img src="${svgDataUri(svg)}"/></div>` : '';
      divInner += `<div class="varga"><h3>${esc(heading)}</h3>${info.sig ? `<p class="sig">${esc(info.sig)}</p>` : ''}${img}${tableHtml(rows, DIV_COLS)}</div>`;
    }
    html += `<div class="sec"><h2>${LABELS.vargas}</h2>${divInner}</div>`;
  }

  return html;
}

function fmtDate(d: string): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('hi-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}
function fmtTime(t: string): string {
  if (!t) return '—';
  const [h, m] = t.split(':');
  if (h === undefined || m === undefined) return t;
  const hr = parseInt(h, 10);
  const ampm = hr >= 12 ? 'PM' : 'AM';
  const h12 = hr % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

const STYLE = `
* { box-sizing: border-box; margin: 0; padding: 0; }
#vidhi-hi-report { width: 794px; background: #ffffff; font-family: 'Noto Sans Devanagari','Inter',sans-serif; color: #2e221c; }
#vidhi-hi-report .cover { height: 1090px; background: #0d0c0b; color: #E5B45B; text-align: center; padding-top: 90px; position: relative; }
#vidhi-hi-report .cover::before { content:''; position:absolute; top:0; left:0; right:0; height:200px; background:#61072B; }
#vidhi-hi-report .cbrand { position: relative; font-family:'Playfair Display',serif; font-size: 60px; font-weight:700; color:#E5B45B; }
#vidhi-hi-report .csub { position: relative; color:#E5E2DF; letter-spacing: 6px; font-size: 15px; margin-top: 6px; }
#vidhi-hi-report .cline { width: 60%; height: 1px; background:#E5B45B; margin: 150px auto 0; }
#vidhi-hi-report .ctitle { font-family:'Playfair Display',serif; font-size: 42px; color:#E5B45B; margin-top: 60px; }
#vidhi-hi-report .cname { font-size: 30px; color:#E5E2DF; margin-top: 20px; }
#vidhi-hi-report .cdetails { margin-top: 70px; color:#E5E2DF; }
#vidhi-hi-report .cdetails div { font-size: 18px; margin-bottom: 24px; }
#vidhi-hi-report .cdetails span { display:block; color:#E5B45B; font-size: 12px; letter-spacing: 2px; margin-bottom: 6px; }
#vidhi-hi-report .cgen { color:#E5B45B; font-size: 12px; margin-top: 60px; }
#vidhi-hi-report .sec { padding: 30px 40px 8px; }
#vidhi-hi-report h2 { font-family:'Playfair Display',serif; color:#61072B; font-size: 22px; border-bottom: 2px solid #E5B45B; display:inline-block; padding-bottom: 4px; margin-bottom: 16px; }
#vidhi-hi-report h3 { color:#61072B; font-size: 16px; margin: 18px 0 4px; }
#vidhi-hi-report .intro, #vidhi-hi-report .sig { color:#786458; font-size: 12px; margin-bottom: 8px; }
#vidhi-hi-report table { width: 100%; border-collapse: collapse; margin: 6px 0 4px; }
#vidhi-hi-report th { background:#61072B; color:#fff; font-size: 11px; padding: 6px 7px; text-align:left; border: 1px solid #e1d6c4; }
#vidhi-hi-report td { font-size: 11px; padding: 5px 7px; border: 1px solid #e1d6c4; color:#2e221c; }
#vidhi-hi-report tbody tr:nth-child(even) td { background:#faf4e8; }
#vidhi-hi-report .cards { display:flex; flex-wrap:wrap; gap: 12px; }
#vidhi-hi-report .card { width: calc(50% - 6px); background:#faf4e8; border:1px solid #E5B45B; border-radius: 8px; padding: 12px 16px; }
#vidhi-hi-report .cl { color:#C7902F; font-size: 12px; margin-bottom: 4px; }
#vidhi-hi-report .cv { color:#61072B; font-family:'Playfair Display',serif; font-size: 20px; }
#vidhi-hi-report .chartwrap { text-align:center; margin: 8px 0; }
#vidhi-hi-report .chartwrap img { width: 320px; height: 320px; }
#vidhi-hi-report .chartwrap.sm img { width: 240px; height: 240px; }
#vidhi-hi-report .varga { margin-bottom: 14px; }
`;

async function ensureFonts(): Promise<void> {
  const id = 'vidhi-hi-fonts';
  if (!document.getElementById(id)) {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&family=Playfair+Display:wght@600;700&family=Inter:wght@400;600&display=swap';
    document.head.appendChild(link);
  }
  try {
    await (document as any).fonts.load('400 14px "Noto Sans Devanagari"');
    await (document as any).fonts.load('700 14px "Noto Sans Devanagari"');
    await (document as any).fonts.ready;
  } catch { /* best effort */ }
  await new Promise((r) => setTimeout(r, 350));
}

export async function generateKundliPdfHindi(profile: Profile, astro: AstroBundle): Promise<void> {
  await ensureFonts();

  const styleEl = document.createElement('style');
  styleEl.textContent = STYLE;
  document.head.appendChild(styleEl);

  const container = document.createElement('div');
  container.id = 'vidhi-hi-report';
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.innerHTML = buildHtml(profile, astro);
  document.body.appendChild(container);

  try {
    await new Promise((r) => setTimeout(r, 200));
    const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });

    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWmm = 210;
    const pageHmm = 297;
    const pxPerMm = canvas.width / pageWmm;
    const pageHpx = Math.floor(pageHmm * pxPerMm);

    let pos = 0;
    let pageIndex = 0;
    while (pos < canvas.height) {
      const sliceH = Math.min(pageHpx, canvas.height - pos);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = sliceH;
      const ctx = slice.getContext('2d');
      if (!ctx) break;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, pos, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      const img = slice.toDataURL('image/jpeg', 0.92);
      const hMm = sliceH / pxPerMm;
      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(img, 'JPEG', 0, 0, pageWmm, hMm);
      pos += pageHpx;
      pageIndex++;
    }

    const total = pdf.getNumberOfPages();
    for (let i = 2; i <= total; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(120, 100, 88);
      pdf.text(`${LABELS.page} ${i} / ${total}`, pageWmm - 12, pageHmm - 6, { align: 'right' });
    }

    const safeName = (profile.name || 'Kundli').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
    pdf.save(`Vidhi-Kundli-Hindi-${safeName}.pdf`);
  } finally {
    document.body.removeChild(container);
    document.head.removeChild(styleEl);
  }
}
