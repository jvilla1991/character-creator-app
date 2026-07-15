import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss'],
    standalone: false
})
export class LoginComponent {
  userName = '';
  password = '';
  errorMessage = '';
  showPassword = false;

  constructor(private authService: AuthService, private router: Router) {}

  login(): void {
    this.errorMessage = ''; // Clear any previous error messages
    this.authService.login(this.userName, this.password).subscribe({
      next: (response) => {
        if (response && response.success) {
          this.router.navigate(['/charactermanager']);
        } else {
          this.errorMessage = 'Invalid username or password';
        }
      },
      error: (err) => {
        this.errorMessage = 'Login failed. Please try again.';
      }
    });
  }

  /** Enter the no-account demo for portfolio visitors, then open the app. */
  enterDemo(): void {
    this.authService.enterDemoMode();
    this.router.navigate(['/charactermanager']);
  }
}
