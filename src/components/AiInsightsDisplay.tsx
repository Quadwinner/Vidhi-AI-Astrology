import React from 'react';
import ReactMarkdown from 'react-markdown';
import styles from './AiInsightsDisplay.module.css';

interface AiInsightsDisplayProps {
  insights: { analyst_report: string; } | null;
}

// Renders a "influence" value that may be a string, an array of {planet,influence}
// entries, or an object with planetInfluence[] / houseInfluence{} sub-sections.
function renderInfluenceBlock(content: any, lines: string[]): void {
  if (content == null) return;
  if (typeof content === 'string') { lines.push(content + '\n'); return; }

  // planetInfluence: array of { planet, influence }
  const planetArr = Array.isArray(content) ? content : content.planetInfluence;
  if (Array.isArray(planetArr) && planetArr.length > 0) {
    for (const p of planetArr) {
      if (typeof p === 'string') { lines.push('- ' + p + '\n'); continue; }
      if (p && (p.planet || p.influence)) {
        lines.push(`- **${p.planet || ''}** ${p.influence || ''}`.trim() + '\n');
      }
    }
  }

  // houseInfluence: object keyed by house number -> text
  const houseObj = content.houseInfluence;
  if (houseObj && typeof houseObj === 'object') {
    for (const [house, text] of Object.entries(houseObj)) {
      const clean = typeof text === 'string' ? text.replace(/^→\s*/, '') : JSON.stringify(text);
      lines.push(`- **House ${house}:** ${clean}\n`);
    }
  }

  // Fallback: a plain object of key -> string (no known sub-sections)
  if (!Array.isArray(content) && !planetArr && !houseObj && typeof content === 'object') {
    for (const [k, v] of Object.entries(content)) {
      if (typeof v === 'string') lines.push(`- **${k}:** ${v}\n`);
    }
  }
}

function jsonReportToMarkdown(raw: string): string {
  try {
    const data = JSON.parse(raw);
    const lines: string[] = [];

    const ov = data.overview || {};

    // Characteristics
    if (ov.characteristics) {
      lines.push('## Your Core Nature\n');
      lines.push(ov.characteristics + '\n');
    }

    // Key Insights
    if (ov.insights && Array.isArray(ov.insights)) {
      lines.push('\n## Key Insights\n');
      for (const item of ov.insights) {
        lines.push(typeof item === 'string' ? item + '\n' : '');
      }
    } else if (ov.insights && typeof ov.insights === 'string') {
      lines.push('\n## Key Insights\n');
      lines.push(ov.insights + '\n');
    }

    // Cautions
    if (ov.cautions && Array.isArray(ov.cautions)) {
      lines.push('\n## Cautions\n');
      for (const item of ov.cautions) {
        lines.push(typeof item === 'string' ? item + '\n' : '');
      }
    }

    // Planet Influence (D1)
    if (ov.planetInfluence && Array.isArray(ov.planetInfluence)) {
      lines.push('\n## Planetary Influence\n');
      for (const p of ov.planetInfluence) {
        if (p.planet) lines.push(`### ${p.planet}\n`);
        if (p.influence) lines.push(p.influence + '\n');
        if (p.aspects) lines.push(`*Aspects: ${p.aspects}*\n`);
      }
    }

    // D9 Planet Influence
    if (ov.d9PlanetInfluence && Array.isArray(ov.d9PlanetInfluence)) {
      lines.push('\n## Navamsa (D9) Planetary Influence\n');
      for (const p of ov.d9PlanetInfluence) {
        if (p.planet) lines.push(`### ${p.planet}\n`);
        if (p.influence) lines.push(p.influence + '\n');
      }
    }

    // D10 Planet Influence
    if (ov.d10PlanetInfluence && Array.isArray(ov.d10PlanetInfluence)) {
      lines.push('\n## Dasamsa (D10) Career Influence\n');
      for (const p of ov.d10PlanetInfluence) {
        if (p.planet) lines.push(`### ${p.planet}\n`);
        if (p.influence) lines.push(p.influence + '\n');
      }
    }

    // House Influence
    if (ov.houseInfluence && typeof ov.houseInfluence === 'object') {
      lines.push('\n## House Analysis\n');
      for (const [house, content] of Object.entries(ov.houseInfluence)) {
        lines.push(`### House ${house}\n`);
        lines.push((typeof content === 'string' ? content : JSON.stringify(content)) + '\n');
      }
    }

    // D9 House Influence
    if (ov.d9HouseInfluence && typeof ov.d9HouseInfluence === 'object') {
      lines.push('\n## Navamsa House Analysis\n');
      for (const [house, content] of Object.entries(ov.d9HouseInfluence)) {
        lines.push(`### House ${house}\n`);
        lines.push((typeof content === 'string' ? content : JSON.stringify(content)) + '\n');
      }
    }

    // D10 House Influence
    if (ov.d10HouseInfluence && typeof ov.d10HouseInfluence === 'object') {
      lines.push('\n## Dasamsa House Analysis\n');
      for (const [house, content] of Object.entries(ov.d10HouseInfluence)) {
        lines.push(`### House ${house}\n`);
        lines.push((typeof content === 'string' ? content : JSON.stringify(content)) + '\n');
      }
    }

    // Varga Influences — each chart value can be a plain string OR a nested
    // object with planetInfluence[] / houseInfluence{}. Render those readably
    // instead of dumping raw JSON.
    if (ov.vargaInfluences && typeof ov.vargaInfluences === 'object') {
      lines.push('\n## Divisional Chart Insights\n');
      for (const [chart, content] of Object.entries(ov.vargaInfluences)) {
        lines.push(`### ${chart}\n`);
        renderInfluenceBlock(content, lines);
      }
    }

    // Varga Tap Content
    if (ov.varga_tap_content && typeof ov.varga_tap_content === 'object') {
      for (const [, val] of Object.entries(ov.varga_tap_content as Record<string, any>)) {
        if (val && typeof val === 'object' && val.title) {
          lines.push(`\n### ${val.title}\n`);
          if (val.body) lines.push(val.body + '\n');
        }
      }
    }

    // Timeline
    const timeline = data.timeline;
    if (timeline) {
      const months = timeline.months || timeline;
      if (Array.isArray(months) && months.length > 0) {
        lines.push('\n## 12-Month Forecast\n');
        for (const m of months) {
          const name = m.monthName || m.month || m.period || '';
          const highlight = m.highlight || '';
          lines.push(`### ${name}\n`);
          if (highlight) lines.push(`**${highlight}**\n`);
          if (m.categories && Array.isArray(m.categories)) {
            for (const cat of m.categories) {
              if (cat.categoryName) lines.push(`#### ${cat.categoryName}\n`);
              if (cat.description) lines.push(cat.description + '\n');
              if (cat.items && Array.isArray(cat.items)) {
                for (const item of cat.items) {
                  lines.push((typeof item === 'string' ? item : item.text || item.content || '') + '\n');
                }
              }
            }
          }
          if (m.prediction || m.description) {
            lines.push((m.prediction || m.description) + '\n');
          }
        }
      }
    }

    // FAQ / Life Answers (used by destiny_blueprint and others)
    const faq = data.faq;
    if (faq) {
      const faqItems = Array.isArray(faq) ? faq : faq.items;
      if (Array.isArray(faqItems) && faqItems.length > 0) {
        lines.push('\n## Life Answers\n');
        for (const item of faqItems) {
          if (item.question) lines.push(`**${item.question}**\n`);
          if (item.answer) lines.push(item.answer + '\n');
        }
      }
    }

    // Guidance
    const guidance = data.guidance;
    if (guidance) {
      const sections = guidance.sections || guidance;
      if (Array.isArray(sections) && sections.length > 0) {
        lines.push('\n## Guidance & Life Answers\n');
        for (const sec of sections) {
          if (sec.title) lines.push(`### ${sec.title}\n`);
          if (sec.items && Array.isArray(sec.items)) {
            for (const item of sec.items) {
              if (item.question) lines.push(`**${item.question}**\n`);
              if (item.answer) lines.push(item.answer + '\n');
            }
          }
          if (typeof sec === 'string') lines.push(sec + '\n');
        }
      }
    }

    return lines.length > 2 ? lines.join('\n') : raw;
  } catch {
    return raw;
  }
}

export default function AiInsightsDisplay({ insights }: AiInsightsDisplayProps) {
  if (!insights || !insights.analyst_report) {
    return null;
  }

  let content = insights.analyst_report
    .replace(/^```(?:markdown|json)?\s*/, '')
    .replace(/```$/, '')
    .trim();

  if (content.startsWith('{') || content.startsWith('[')) {
    content = jsonReportToMarkdown(content);
  }

  return (
    <div className={styles.container}>
      <div className={styles.analystReport}>
        <ReactMarkdown>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
