import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';

/**
 * Landing page for an admin-issued reset link
 * (/reset-password?token=...). The user picks a new password; on success
 * they're pointed back to the normal sign-in. Unrouted-token and expired
 * cases share one generic error, matching the backend.
 */
@Component({
    selector: 'app-reset-password',
    templateUrl: './reset-password.component.html',
    styleUrls: ['./reset-password.component.scss'],
    standalone: false
})
export class ResetPasswordComponent implements OnInit {
  token = '';
  newPassword = '';
  confirmPassword = '';
  showPassword = false;
  errorMessage = '';
  done = false;
  submitting = false;

  constructor(private route: ActivatedRoute, private authService: AuthService) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.errorMessage = 'This reset link is incomplete — ask your DM for a new one.';
    }
  }

  submit(): void {
    this.errorMessage = '';
    if (this.newPassword.length < 8) {
      this.errorMessage = 'Password must be at least 8 characters.';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }
    this.submitting = true;
    this.authService.resetPassword(this.token, this.newPassword).subscribe(response => {
      this.submitting = false;
      if (response.success) {
        this.done = true;
      } else {
        this.errorMessage = 'This reset link is invalid or has expired — ask your DM for a new one.';
      }
    });
  }
}
