// Production values are injected by the CI/CD workflow at build time.
// Do not hardcode API URLs here — they are written by deploy.yml using
// the AUTH_SERVICE_URL and CHARACTER_SERVICE_URL GitHub Actions secrets.
export const environment = {
  production: true,
  demoMode: false,
  authApiUrl: '',
  characterApiUrl: '',
};
