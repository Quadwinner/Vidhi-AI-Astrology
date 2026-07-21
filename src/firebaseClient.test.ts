const mockInitializeApp = jest.fn(() => ({ name: 'test-app' }));

jest.mock('firebase/app', () => ({
  initializeApp: (...args: any[]) => mockInitializeApp(...args),
}));

jest.mock('firebase/analytics', () => ({
  getAnalytics: jest.fn(() => ({})),
  isSupported: jest.fn().mockResolvedValue(false),
}));

describe('firebaseClient', () => {
  it('initializes Firebase with the astro-500910 project config', () => {
    const mod = require('./firebaseClient');

    expect(mockInitializeApp).toHaveBeenCalledTimes(1);

    const config = mockInitializeApp.mock.calls[0][0] as Record<string, string>;
    expect(config.projectId).toBe('astro-500910');
    expect(config.authDomain).toBe('astro-500910.firebaseapp.com');
    expect(config.storageBucket).toBe('astro-500910.firebasestorage.app');
    expect(config.messagingSenderId).toBe('747140773728');
    expect(config.appId).toBe('1:747140773728:web:036763dd454eeb1da49005');
    expect(config.apiKey).toBeTruthy();

    expect(config.projectId).not.toContain('astroauraai');
    expect(typeof mod.initFirebaseAnalytics).toBe('function');
  });

  it('does not throw and returns null when analytics is unsupported', async () => {
    const mod = require('./firebaseClient');
    await expect(mod.initFirebaseAnalytics()).resolves.toBeNull();
  });
});
