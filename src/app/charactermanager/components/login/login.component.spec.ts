import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoginComponent } from './login.component';
import { AuthService } from '../../services/auth.service';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authService: jasmine.SpyObj<AuthService>;
  let router: Router;

  beforeEach(async () => {
    const authSpy = jasmine.createSpyObj('AuthService', ['login']);

    // Standalone LoginComponent brings RouterLink with it, and RouterLink needs
    // the real router wiring (ActivatedRoute etc.) — so provide an empty real
    // router and spy on `navigate` instead of substituting a bare Router mock.
    await TestBed.configureTestingModule({
    imports: [LoginComponent],
    providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authSpy },
    ],
}).compileComponents();

    fixture     = TestBed.createComponent(LoginComponent);
    component   = fixture.componentInstance;
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    router      = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts invalid: both fields are required', () => {
    expect(component.form.invalid).toBeTrue();
    expect(component.form.controls.userName.hasError('required')).toBeTrue();
    expect(component.form.controls.password.hasError('required')).toBeTrue();
  });

  it('becomes valid once both fields are filled', () => {
    component.form.setValue({ userName: 'admin', password: 'password' });
    expect(component.form.valid).toBeTrue();
  });

  it('calls AuthService.login with provided credentials', () => {
    component.form.setValue({ userName: 'admin', password: 'password' });
    authService.login.and.returnValue(of({ success: true }));

    component.login();

    expect(authService.login).toHaveBeenCalledWith('admin', 'password');
  });

  it('sets errorMessage when login fails', () => {
    authService.login.and.returnValue(throwError(() => new Error('Login failed')));

    component.login();

    expect(component.errorMessage).toBeTruthy();
  });

  it('shows .login-error element when errorMessage is set', async () => {
    authService.login.and.returnValue(throwError(() => new Error('Bad credentials')));
    component.login();
    fixture.detectChanges();
    await fixture.whenStable();

    const errorEl = fixture.nativeElement.querySelector('.login-error');
    expect(errorEl).toBeTruthy();
  });

  it('navigates to /charactermanager on successful login', () => {
    authService.login.and.returnValue(of({ success: true }));
    component.form.setValue({ userName: 'admin', password: 'password' });

    component.login();

    expect(router.navigate).toHaveBeenCalledWith(['/charactermanager']);
  });
});
