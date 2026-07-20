import React, { useState } from 'react';
import {
  IconSparkles, IconHeart, IconBriefcase, IconActivity, IconCoin,
  IconCards, IconThumbUp, IconCookie,
} from '@tabler/icons-react';
import { supabase } from '../supabaseClient';
import { trackEvent } from '../utils/analytics';
import styles from './TarotPage.module.css';

type ReadingType = 'daily' | 'yes-no' | 'love' | 'career' | 'fortune';

interface CardImage { classic?: string; artwork?: string; dark?: string; ghibli?: string; }
interface TarotResponse {
  id?: string; name?: string; direction?: string; meaning?: string; description?: string;
  health?: string; relationship?: string; career?: string; finance?: string;
  careerPaths?: string[]; card_image?: CardImage; card_images_back?: CardImage;
}

const READINGS: { key: ReadingType; label: string; blurb: string; icon: React.ReactNode }[] = [
  { key: 'daily', label: 'Daily Pull', blurb: 'One card to guide your whole day', icon: <IconCards size={20} /> },
  { key: 'yes-no', label: 'Yes / No', blurb: 'A clear answer to a burning question', icon: <IconThumbUp size={20} /> },
  { key: 'love', label: 'Love', blurb: 'Insight into your heart and bonds', icon: <IconHeart size={20} /> },
  { key: 'career', label: 'Career', blurb: 'Direction for your work and path', icon: <IconBriefcase size={20} /> },
  { key: 'fortune', label: 'Fortune Cookie', blurb: 'A little spark of daily wisdom', icon: <IconCookie size={20} /> },
];

const CARD_BACK = 'https://s3.ap-south-1.amazonaws.com/images.vedicastroapi/tarot_images/tarot_back/dark.png';

export default function TarotPage() {
  const [selected, setSelected] = useState<ReadingType>('daily');
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ type: ReadingType; data: TarotResponse | string } | null>(null);

  const active = READINGS.find(r => r.key === selected)!;

  const drawCard = async () => {
    setLoading(true); setError(null); setResult(null); setFlipped(false);
    try {
      trackEvent('Tarot Draw', { type: selected });
      const { data, error } = await supabase.functions.invoke('get-tarot-reading', { body: { type: selected } });
      if (error) throw new Error(error.message);
      if (data?.error) { setError('The cards are resting right now. Please try again in a moment.'); return; }
      setResult({ type: selected, data: data.response });
      setTimeout(() => setFlipped(true), 120);
    } catch {
      setError('The cards are resting right now. Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  const cardObj = result && typeof result.data === 'object' ? result.data as TarotResponse : null;
  const cardImg = cardObj?.card_image?.artwork || cardObj?.card_image?.classic || cardObj?.card_image?.dark;

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <div className={styles.kicker}><IconSparkles size={14} /> Tarot Reading</div>
          <h1 className={styles.title}>Draw Your Card</h1>
          <p className={styles.subtitle}>Focus on your intention, choose a spread, and let the cards speak.</p>
        </header>

        <div className={styles.typeGrid}>
          {READINGS.map(r => (
            <button
              key={r.key}
              className={`${styles.typeCard} ${selected === r.key ? styles.typeActive : ''}`}
              onClick={() => { setSelected(r.key); setResult(null); setFlipped(false); setError(null); }}
            >
              <span className={styles.typeIcon}>{r.icon}</span>
              <span className={styles.typeLabel}>{r.label}</span>
              <span className={styles.typeBlurb}>{r.blurb}</span>
            </button>
          ))}
        </div>

        {selected === 'yes-no' && (
          <input
            className={styles.questionInput}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Type your yes/no question (optional)…"
            maxLength={140}
          />
        )}

        <div className={styles.stage}>
          <div className={`${styles.tarotCard} ${flipped ? styles.flipped : ''} ${loading ? styles.shuffling : ''}`}>
            <div className={styles.cardFace + ' ' + styles.cardBack}>
              <img src={CARD_BACK} alt="Tarot card back" />
            </div>
            <div className={styles.cardFace + ' ' + styles.cardFront}>
              {cardImg
                ? <img src={cardImg} alt={cardObj?.name || 'Tarot card'} />
                : <div className={styles.fortunePlaceholder}><IconCookie size={54} /></div>}
            </div>
          </div>

          <button className={styles.drawBtn} onClick={drawCard} disabled={loading}>
            {loading ? 'Shuffling…' : result ? 'Draw Again' : 'Draw Card'}
          </button>
        </div>

        {error && <div className={styles.errorCard}>{error}</div>}

        {result && !error && (
          <div className={styles.reading}>
            {result.type === 'fortune' && typeof result.data === 'string' ? (
              <p className={styles.fortuneText}>“{result.data}”</p>
            ) : cardObj ? (
              <>
                <div className={styles.cardTitle}>
                  <span className={styles.cardName}>{cardObj.name}</span>
                  {cardObj.direction && <span className={styles.cardDir}>{cardObj.direction}</span>}
                  {cardObj.meaning && <span className={styles.answerBadge}>{cardObj.meaning}</span>}
                </div>

                {result.type === 'daily' ? (
                  <div className={styles.aspects}>
                    {cardObj.health && <Aspect icon={<IconActivity size={16} />} label="Health" text={cardObj.health} />}
                    {cardObj.relationship && <Aspect icon={<IconHeart size={16} />} label="Relationship" text={cardObj.relationship} />}
                    {cardObj.career && <Aspect icon={<IconBriefcase size={16} />} label="Career" text={cardObj.career} />}
                    {cardObj.finance && <Aspect icon={<IconCoin size={16} />} label="Finance" text={cardObj.finance} />}
                  </div>
                ) : (
                  <>
                    {cardObj.description && <p className={styles.desc}>{cardObj.description}</p>}
                    {Array.isArray(cardObj.careerPaths) && cardObj.careerPaths.length > 0 && (
                      <div className={styles.pathList}>
                        {cardObj.careerPaths.map((p) => <span key={p} className={styles.pathChip}>{p}</span>)}
                      </div>
                    )}
                  </>
                )}
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function Aspect({ icon, label, text }: { icon: React.ReactNode; label: string; text: string }) {
  return (
    <div className={styles.aspect}>
      <div className={styles.aspectHead}><span className={styles.aspectIcon}>{icon}</span>{label}</div>
      <p>{text}</p>
    </div>
  );
}
