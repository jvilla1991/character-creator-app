import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResetPasswordComponent } from './reset-password.component';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

describe('ResetPasswordComponent', () => {
  let component: ResetPasswordComponent;
  let fixture: ComponentFixture<ResetPasswordComponent>;
  let authService: jasmine.SpyObj<AuthService>;

  async function setup(token: string | null): Promise<void> {
    const authSpy = jasmine.createSpyObj('AuthService', ['resetPassword']);

    await TestBed.configureTestingModule({
      declarations: [ResetPasswordComponent],
      imports: [FormsModule],
      providers: [
        { provide: AuthService, useValue: authSpy },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(token === null ? {} : { token }) } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    fixture.detectChanges();
  }

  it('reads the token from the query string', async () => {
    await setup('abc123');
    expect(component.token).toBe('abc123');
    expect(component.errorMessage).toBe('');
  });

  it('shows an error when the link has no token', async () => {
    await setup(null);
    expect(component.errorMessage).toBeTruthy();
  });

  it('rejects a short password without calling the backend', async () => {
    await setup('abc123');
    component.newPassword = component.confirmPassword = 'short';

    component.submit();

    expect(component.errorMessage).toBeTruthy();
    expect(authService.resetPassword).not.toHaveBeenCalled();
  });

  it('rejects mismatched passwords without calling the backend', async () => {
    await setup('abc123');
    component.newPassword = 'longenough1';
    component.confirmPassword = 'different1';

    component.submit();

    expect(component.errorMessage).toBeTruthy();
    expect(authService.resetPassword).not.toHaveBeenCalled();
  });

  it('submits the token and new password, then shows the done state', async () => {
    await setup('abc123');
    authService.resetPassword.and.returnValue(of({ success: true }));
    component.newPassword = component.confirmPassword = 'longenough1';

    component.submit();

    expect(authService.resetPassword).toHaveBeenCalledWith('abc123', 'longenough1');
    expect(component.done).toBeTrue();
  });

  it('shows the invalid-or-expired error when the backend rejects the token', async () => {
    await setup('abc123');
    authService.resetPassword.and.returnValue(of({ success: false }));
    component.newPassword = component.confirmPassword = 'longenough1';

    component.submit();

    expect(component.done).toBeFalse();
    expect(component.errorMessage).toContain('invalid or has expired');
  });
});
