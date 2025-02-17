import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  userName = '';
  password = '';
  errorMessage = '';

  constructor(private authService: AuthService, private router: Router) {}

  login(): void {
    this.authService.login(this.userName, this.password).subscribe({
      next: (response) => {
        if (response) {
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
}