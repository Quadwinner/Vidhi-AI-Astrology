import styles from './OfferBanner.module.css';

export default function OfferBanner() {
  return (
    <section className={styles.mobileAppBanner}>
      <div className={styles.bannerContainer}>
        {/* Left Content */}
        <div className={styles.leftContent}>
          <div className={styles.badge}>
            <span>📱 Mobile Experience</span>
          </div>
          
          <h2 className={styles.mainTitle}>
            Take Your Cosmic Journey Anywhere
          </h2>
          
          <p className={styles.description}>
            Access personalized horoscopes, birth chart readings, and cosmic guidance right from your pocket. Our mobile app brings the universe to your fingertips.
          </p>
          
          <div className={styles.comingSoon}>
            APP LIVE NOW
          </div>
          
          <div className={styles.storeButtons}>
            <button className={styles.storeButton}>
              <svg className={styles.appleIcon} viewBox="0 0 18 24" fill="white">
                <path d="M17.769 12.382c-.012-1.089.485-2.098 1.247-2.864-.735-.95-1.877-1.508-3.079-1.508-1.316 0-1.91.625-2.849.625-.963 0-1.689-.619-2.844-.619-1.698 0-3.462 1.424-3.462 4.111 0 1.666.649 3.433 1.451 4.553.716 1.001 1.334 1.821 2.333 1.821.938 0 1.217-.598 2.364-.598 1.158 0 1.388.598 2.338.598 1.012 0 1.694-.919 2.316-1.832.719-1.043.99-2.068.998-2.122-.066-.028-1.912-.73-1.925-2.895zm-2.395-7.482c.548-.672.918-1.605.817-2.539-.792.039-1.737.539-2.303 1.219-.51.608-.957 1.583-.838 2.508.887.017 1.787-.448 2.324-1.188z"/>
              </svg>
              <div className={styles.storeButtonText}>
                <span className={styles.storeSmall}>Download on the</span>
                <span className={styles.storeLarge}>App Store</span>
              </div>
            </button>
            
            <button className={styles.storeButton}>
              <svg className={styles.playIcon} viewBox="0 0 24 24" fill="white">
                <path d="M3.609 1.814L13.792 12 3.61 22.186c-.165-.123-.305-.273-.418-.445l-.001-.001c-.163-.249-.261-.552-.261-.877V3.137c0-.325.098-.628.261-.877l.001-.001c.113-.172.253-.322.418-.445zM14.853 13.06l-1.06-1.06 3.267-3.267 2.947 1.704c.474.274.791.783.791 1.36 0 .577-.317 1.086-.791 1.36l-2.947 1.704-2.207-2.207v.406zm-5.555 6.912l5.555-5.555 1.768 1.768-6.909 3.991c-.138.08-.291.126-.448.126-.154 0-.305-.045-.442-.122l-.001-.001c-.181-.1-.338-.233-.462-.39l-.001-.001c-.128-.162-.227-.346-.286-.545-.062-.212-.095-.434-.095-.662 0-.326.078-.634.217-.906l.001-.002zm-.618-10.958L14.792 3l2.947 1.704c.474.274.791.783.791 1.36 0 .577-.317 1.086-.791 1.36L14.792 9.14 8.68 3.028z"/>
              </svg>
              <div className={styles.storeButtonText}>
                <span className={styles.storeSmall}>Get it on</span>
                <span className={styles.storeLarge}>Google Play</span>
              </div>
            </button>
          </div>
        </div>
        
        {/* Right Content - Phone Mockups Placeholder */}
        <div className={styles.rightContent}>
          <div className={styles.phoneMockup}>
            <div className={styles.phoneScreen}>
              <div className={styles.mockupText}>📱</div>
              <p className={styles.mockupLabel}>App Live Now</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
