// Production values are injected by the CI/CD workflow at build time.
// Do not hardcode API URLs here — they are written by deploy.yml using
// the AUTH_SERVICE_URL and CHARACTER_SERVICE_URL GitHub Actions secrets.
// localStorage key holding a visitor's "Explore the Demo" opt-in. When set to
// 'true', the app runs entirely on in-memory seed data with no backend calls.
export const DEMO_MODE_KEY = 'demoMode';

export const environment = {
  production: true,
  // Runtime-driven, not baked at build time: a portfolio visitor opts into demo
  // mode from the login screen, so this must be read live on every access.
  get demoMode(): boolean {
    try {
      return localStorage.getItem(DEMO_MODE_KEY) === 'true';
    } catch {
      return false;
    }
  },
  authApiUrl: '',
  characterApiUrl: '',
};
