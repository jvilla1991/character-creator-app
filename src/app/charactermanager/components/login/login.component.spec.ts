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
    const authSpy = jasmine.createSpyObj('AuthService', ['login']);
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      declarations: [LoginComponent],
      imports: [FormsModule], // Needed for [(ngModel)]
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    fixture.detectChanges();
  });

  it('should create the login form', () => {
    expect(component).toBeTruthy();
    const compiled = fixture.nativeElement;
    expect(compiled.querySelector('h2').textContent).toContain('Login');
  });

  it('should call AuthService.login when form is submitted', () => {
    component.userName = 'admin';
    component.password = 'password';
    authService.login.and.returnValue(of({ success: true }));

    component.login();

    expect(authService.login).toHaveBeenCalledWith('admin', 'password');
  });

  it('should show error message if login fails', () => {
    authService.login.and.returnValue(throwError(() => new Error('Login failed')));

    component.login();
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    expect(compiled.querySelector('.error').textContent).toContain('Login failed');
  });

  it('should navigate to dashboard on successful login', () => {
    authService.login.and.returnValue(of({ success: true }));

    component.login();

    expect(router.navigate).toHaveBeenCalledWith(['/charactermanager']);
  });

  it('should disable login button when username or password is empty', () => {
    component.userName = '';
    component.password = '';
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button');
    expect(button.disabled).toBeTruthy();
  });
});
