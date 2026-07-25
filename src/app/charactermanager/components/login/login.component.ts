import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NonNullableFormBuilder, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router, RouterLink } from '@angular/router';

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, ReactiveFormsModule, RouterLink]
})
export class LoginComponent {
  /** Typed reactive form — both fields are required, exactly like the old ngModel form. */
  readonly form = this.fb.group({
    userName: ['', Validators.required],
    password: ['', Validators.required],
  });

  // Signal: set from the auth HTTP callback, which never marks an OnPush view.
  readonly errorMessage = signal('');
  showPassword = false;

  constructor(
    private fb: NonNullableFormBuilder,
    private authService: AuthService,
    private router: Router,
  ) {}

  login(): void {
    this.errorMessage.set(''); // Clear any previous error messages
    const { userName, password } = this.form.getRawValue();
    this.authService.login(userName, password).subscribe({
      next: (response) => {
        if (response && response.success) {
          this.router.navigate(['/charactermanager']);
        } else {
          this.errorMessage.set('Invalid username or password');
        }
      },
      error: (err) => {
        this.errorMessage.set('Login failed. Please try again.');
      }
    });
  }

  /** Enter the no-account demo for portfolio visitors, then open the app. */
  enterDemo(): void {
    this.authService.enterDemoMode();
    this.router.navigate(['/charactermanager']);
  }
}
