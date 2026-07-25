import { FormBuilder } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { RegisterComponent } from './register.component';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

/**
 * Plain-class tests (no TestBed): the typed reactive form lets us assert the
 * validity rules directly on component.form.
 */
describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  /** All fields filled in a way the old hand-rolled formValid accepted. */
  function fillValid(): void {
    component.form.setValue({
      firstName: 'Sera',
      lastName: 'Goldveil',
      email: 'sera@example.com',
      userName: 'seraphina',
      password: 'secret6',
      confirmPassword: 'secret6',
    });
  }

  beforeEach(() => {
    authService = jasmine.createSpyObj('AuthService', ['register']);
    router      = jasmine.createSpyObj('Router', ['navigate']);
    component   = new RegisterComponent(
      new FormBuilder().nonNullable,
      authService as unknown as AuthService,
      router as unknown as Router,
    );
  });

  it('starts invalid', () => {
    expect(component.form.invalid).toBeTrue();
  });

  it('is valid when every field is filled correctly', () => {
    fillValid();
    expect(component.form.valid).toBeTrue();
  });

  it('rejects whitespace-only names, email and username', () => {
    fillValid();
    for (const field of ['firstName', 'lastName', 'email', 'userName'] as const) {
      component.form.controls[field].setValue('   ');
      expect(component.form.controls[field].hasError('required'))
        .withContext(field)
        .toBeTrue();
      component.form.controls[field].setValue('ok');
    }
  });

  it('requires a password of at least 6 characters', () => {
    fillValid();
    component.form.controls.password.setValue('five5');
    component.form.controls.confirmPassword.setValue('five5');
    expect(component.form.controls.password.hasError('minlength')).toBeTrue();
    expect(component.form.invalid).toBeTrue();
  });

  it('allows an empty confirm field (legacy behavior)', () => {
    fillValid();
    component.form.controls.confirmPassword.setValue('');
    expect(component.passwordMismatch).toBeFalse();
    expect(component.form.valid).toBeTrue();
  });

  it('flags a mismatch once the confirm field differs', () => {
    fillValid();
    component.form.controls.confirmPassword.setValue('different');
    expect(component.passwordMismatch).toBeTrue();
    expect(component.form.hasError('passwordMismatch')).toBeTrue();
    expect(component.form.invalid).toBeTrue();
  });

  it('clears the mismatch when the passwords agree again', () => {
    fillValid();
    component.form.controls.confirmPassword.setValue('different');
    component.form.controls.confirmPassword.setValue('secret6');
    expect(component.passwordMismatch).toBeFalse();
  });

  it('does not call the backend while the form is invalid', () => {
    component.register();
    expect(authService.register).not.toHaveBeenCalled();
  });

  it('registers with trimmed values and navigates on success', () => {
    fillValid();
    component.form.controls.firstName.setValue('  Sera  ');
    authService.register.and.returnValue(of({ success: true }));

    component.register();

    expect(authService.register).toHaveBeenCalledWith(
      'Sera', 'Goldveil', 'sera@example.com', 'seraphina', 'secret6');
    expect(router.navigate).toHaveBeenCalledWith(['/charactermanager']);
  });

  it('shows the duplicate-account message when the backend says no', () => {
    fillValid();
    authService.register.and.returnValue(of({ success: false }));

    component.register();

    expect(component.loading).toBeFalse();
    expect(component.errorMessage).toContain('already be in use');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('shows the generic message when the request errors', () => {
    fillValid();
    authService.register.and.returnValue(throwError(() => new Error('boom')));

    component.register();

    expect(component.loading).toBeFalse();
    expect(component.errorMessage).toContain('try again');
  });

  it('ignores register() while a request is in flight', () => {
    fillValid();
    component.loading = true;

    component.register();

    expect(authService.register).not.toHaveBeenCalled();
  });
});
