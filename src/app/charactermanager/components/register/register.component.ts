import { Component } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { passwordsMatch, requiredTrimmed } from '../../utils/auth-validators';

@Component({
    selector: 'app-register',
    templateUrl: './register.component.html',
    styleUrls: ['./register.component.scss'],
    standalone: false
})
export class RegisterComponent {
  /**
   * Typed reactive form. The rules mirror the old hand-rolled `formValid`
   * getter exactly:
   *  - names / email / username must be non-blank after trimming
   *  - password needs at least 6 characters
   *  - confirm may stay empty, but once typed it must match the password
   *    (enforced by the group-level `passwordsMatch` validator)
   */
  readonly form = this.fb.group(
    {
      firstName:       ['', requiredTrimmed],
      lastName:        ['', requiredTrimmed],
      email:           ['', requiredTrimmed],
      userName:        ['', requiredTrimmed],
      password:        ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: [''],
    },
    { validators: passwordsMatch('password', 'confirmPassword') },
  );

  showPassword = false;
  errorMessage = '';
  loading      = false;

  constructor(
    private fb: NonNullableFormBuilder,
    private authService: AuthService,
    private router: Router,
  ) {}

  /** True when the confirm field has content that differs from the password. */
  get passwordMismatch(): boolean {
    return this.form.hasError('passwordMismatch');
  }

  register(): void {
    if (this.form.invalid || this.loading) return;

    this.errorMessage = '';
    this.loading      = true;

    const { firstName, lastName, email, userName, password } = this.form.getRawValue();

    this.authService.register(
      firstName.trim(),
      lastName.trim(),
      email.trim(),
      userName.trim(),
      password
    ).subscribe({
      next: response => {
        this.loading = false;
        if (response?.success) {
          this.router.navigate(['/charactermanager']);
        } else {
          this.errorMessage = 'Registration failed. The username or email may already be in use.';
        }
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Registration failed. Please try again.';
      }
    });
  }
}
