// src/components/DecorativeFooter.tsx
import styles from './DecorativeFooter.module.css';

// Import all 8 of your decorative images
import atom from '../assets/atom.svg'
import card from '../assets/Card.svg'
import heartIcon from '../assets/HeartIcon.svg';
import gift from '../assets/gift.png'
import BagIcon from '../assets/BagIcon.svg';
import BudhaIcon from '../assets/BuddhaIcon.svg';
import wheel from '../assets/wheelIcon.png'


export default function DecorativeFooter() {
  return (
    <div className={styles.Bounce}>
                  <div className={styles.floating}>
                      <img src={atom} alt="alt" className={styles.halfAtom}/>
                       <div className={styles.shadow}></div>
                  </div>
                  <div className={styles.floating}>
                     <img src={card} alt="alt" className={styles.card} />
                       <div className={styles.shadow}></div>
                  </div>
                  <div className={styles.floating}>
                      <img src={heartIcon} alt="alt" className={styles.heartIcon} />
                    <div className={styles.shadow}></div>
                  </div>
                  <div className={styles.floating}>
                       <img src={gift} alt="gift" className={styles.gift}/>
                    <div className={styles.shadow}></div>
                  </div>
                   <div className={styles.floating}>
                      <img src={atom} alt="alt" className={styles.atom} />
                       <div className={styles.shadow}></div>
                  </div>
                  <div className={styles.floating}>
                       <img src={BagIcon} alt="alt" className={styles.BagIcon} />
                    <div className={styles.shadow}></div>
                  </div>
                    <div className={styles.floating}>
                     <img src={BudhaIcon} alt="alt" className={styles.BudhaIcon} />
                    <div className={styles.shadow}></div>
                  </div>
                    <div className={styles.floating}>
                      <img src={wheel} alt="alt" className={styles.wheel} />
                    <div className={styles.shadow}></div>
                  </div>
                </div>
  );
}