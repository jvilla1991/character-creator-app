// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

// localStorage key holding a visitor's "Explore the Demo" opt-in. When set to
// 'true', the app runs entirely on in-memory seed data with no backend calls.
export const DEMO_MODE_KEY = 'demoMode';

export const environment = {
  production: false,
  // Runtime-driven, not baked at build time: a portfolio visitor opts into demo
  // mode from the login screen, so this must be read live on every access.
  get demoMode(): boolean {
    try {
      return localStorage.getItem(DEMO_MODE_KEY) === 'true';
    } catch {
      return false;
    }
  },
  authApiUrl: 'http://localhost:8085',
  characterApiUrl: 'http://localhost:8080'
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
