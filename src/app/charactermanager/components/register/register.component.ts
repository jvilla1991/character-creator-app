import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-register',
    templateUrl: './register.component.html',
    styleUrls: ['./register.component.scss'],
    standalone: false
})
export class RegisterComponent {
  firstName       = '';
  lastName        = '';
  email           = '';
  userName        = '';
  password        = '';
  confirmPassword = '';
  showPassword    = false;

  errorMessage = '';
  loading      = false;

  constructor(private authService: AuthService, private router: Router) {}

  get passwordMismatch(): boolean {
    return !!this.confirmPassword && this.password !== this.confirmPassword;
  }

  get formValid(): boolean {
    return !!(
      this.firstName.trim() &&
      this.lastName.trim()  &&
      this.email.trim()     &&
      this.userName.trim()  &&
      this.password.length >= 6 &&
      !this.passwordMismatch
    );
  }

  register(): void {
    if (!this.formValid || this.loading) return;

    this.errorMessage = '';
    this.loading      = true;

    this.authService.register(
      this.firstName.trim(),
      this.lastName.trim(),
      this.email.trim(),
      this.userName.trim(),
      this.password
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
