import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoginComponent } from './login.component';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    const authSpy   = jasmine.createSpyObj('AuthService', ['login']);
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      declarations: [LoginComponent],
      imports: [FormsModule],
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: Router,      useValue: routerSpy },
      ],
    }).compileComponents();

    fixture     = TestBed.createComponent(LoginComponent);
    component   = fixture.componentInstance;
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    router      = TestBed.inject(Router)      as jasmine.SpyObj<Router>;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('calls AuthService.login with provided credentials', () => {
    component.userName = 'admin';
    component.password = 'password';
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

    component.login();

    expect(router.navigate).toHaveBeenCalledWith(['/charactermanager']);
  });
});
