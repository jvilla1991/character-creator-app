import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '../charactermanager/services/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authService: jasmine.SpyObj<AuthService>;

  const AUTH_URL = 'https://api.test/api/v1/auth/login';
  const PROTECTED_URL = 'https://api.test/api/v1/pc';

  beforeEach(() => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['getToken', 'logout']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authService },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('never attaches a token to an auth-service request', () => {
    authService.getToken.and.returnValue('a.b.c');

    http.post(AUTH_URL, {}).subscribe();

    const req = httpMock.expectOne(AUTH_URL);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('attaches a Bearer token to a non-auth request when the token is a valid 3-part JWT', () => {
    authService.getToken.and.returnValue('a.b.c');

    http.get(PROTECTED_URL).subscribe();

    const req = httpMock.expectOne(PROTECTED_URL);
    expect(req.request.headers.get('Authorization')).toBe('Bearer a.b.c');
    req.flush({});
  });

  it('sends the request unmodified when there is no token', () => {
    authService.getToken.and.returnValue(null);

    http.get(PROTECTED_URL).subscribe();

    const req = httpMock.expectOne(PROTECTED_URL);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('guards against a stale non-JWT token (e.g. an old demo-mode value)', () => {
    authService.getToken.and.returnValue('demo-token-12345');

    http.get(PROTECTED_URL).subscribe();

    const req = httpMock.expectOne(PROTECTED_URL);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('logs out on a 401 with an expired-JWT message', () => {
    authService.getToken.and.returnValue('a.b.c');

    http.get(PROTECTED_URL).subscribe({ error: () => undefined });

    const req = httpMock.expectOne(PROTECTED_URL);
    req.flush({ message: 'JWT expired at 2026-01-01' }, { status: 401, statusText: 'Unauthorized' });

    expect(authService.logout).toHaveBeenCalled();
  });

  it('logs out on a 400 with an expired-JWT message', () => {
    authService.getToken.and.returnValue('a.b.c');

    http.get(PROTECTED_URL).subscribe({ error: () => undefined });

    const req = httpMock.expectOne(PROTECTED_URL);
    req.flush({ message: 'JWT expired' }, { status: 400, statusText: 'Bad Request' });

    expect(authService.logout).toHaveBeenCalled();
  });

  it('does not log out on a 401 without an expired-JWT message', () => {
    authService.getToken.and.returnValue('a.b.c');

    http.get(PROTECTED_URL).subscribe({ error: () => undefined });

    const req = httpMock.expectOne(PROTECTED_URL);
    req.flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });

    expect(authService.logout).not.toHaveBeenCalled();
  });

  it('does not log out on an unrelated server error', () => {
    authService.getToken.and.returnValue('a.b.c');

    http.get(PROTECTED_URL).subscribe({ error: () => undefined });

    const req = httpMock.expectOne(PROTECTED_URL);
    req.flush({ message: 'Internal error' }, { status: 500, statusText: 'Server Error' });

    expect(authService.logout).not.toHaveBeenCalled();
  });

  it('propagates the error after handling it', () => {
    authService.getToken.and.returnValue('a.b.c');
    let captured: unknown;

    http.get(PROTECTED_URL).subscribe({ error: err => (captured = err) });

    const req = httpMock.expectOne(PROTECTED_URL);
    req.flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });

    expect(captured).toBeTruthy();
  });
});
