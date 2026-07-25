import { Component, OnInit } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
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
  /**
   * Typed reactive form. Only `required` gates the submit button — the
   * min-length and match rules are deliberately checked in submit() so
   * their messages still appear on click, exactly like the old
   * template-driven form did.
   */
  readonly form = this.fb.group({
    newPassword:     ['', Validators.required],
    confirmPassword: ['', Validators.required],
  });

  token = '';
  showPassword = false;
  errorMessage = '';
  done = false;
  submitting = false;

  constructor(
    private fb: NonNullableFormBuilder,
    private route: ActivatedRoute,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.errorMessage = 'This reset link is incomplete — ask your DM for a new one.';
    }
  }

  submit(): void {
    this.errorMessage = '';
    const { newPassword, confirmPassword } = this.form.getRawValue();
    if (newPassword.length < 8) {
      this.errorMessage = 'Password must be at least 8 characters.';
      return;
    }
    if (newPassword !== confirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }
    this.submitting = true;
    this.authService.resetPassword(this.token, newPassword).subscribe(response => {
      this.submitting = false;
      if (response.success) {
        this.done = true;
      } else {
        this.errorMessage = 'This reset link is invalid or has expired — ask your DM for a new one.';
      }
    });
  }
}
