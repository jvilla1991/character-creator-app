import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Shared validators for the auth screens (login / register / reset-password).
 *
 * These mirror the hand-rolled rules the components used before the
 * reactive-forms conversion, so the user-visible behavior is unchanged.
 */

/**
 * Like Validators.required, but a whitespace-only value also fails.
 *
 * The old template-driven forms checked `value.trim()` before submitting,
 * so "   " must stay invalid here too (plain Validators.required would
 * accept it).
 */
export const requiredTrimmed: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = typeof control.value === 'string' ? control.value : '';
  return value.trim() ? null : { required: true };
};

/**
 * Cross-field (group-level) validator: the confirm field must match the
 * password field — but only once the confirm field has something in it.
 *
 * An empty confirm field is deliberately NOT an error: the old forms only
 * flagged a mismatch after the user started typing the confirmation, and
 * the register screen even allowed submitting with confirm left blank.
 */
export function passwordsMatch(passwordKey: string, confirmKey: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password = group.get(passwordKey)?.value ?? '';
    const confirm = group.get(confirmKey)?.value ?? '';
    return confirm && password !== confirm ? { passwordMismatch: true } : null;
  };
}
