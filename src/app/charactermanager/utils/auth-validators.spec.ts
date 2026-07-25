import { FormControl, FormGroup } from '@angular/forms';
import { passwordsMatch, requiredTrimmed } from './auth-validators';

describe('requiredTrimmed', () => {
  it('fails on empty and whitespace-only values', () => {
    expect(requiredTrimmed(new FormControl(''))).toEqual({ required: true });
    expect(requiredTrimmed(new FormControl('   '))).toEqual({ required: true });
  });

  it('passes on any value with non-whitespace content', () => {
    expect(requiredTrimmed(new FormControl('a'))).toBeNull();
    expect(requiredTrimmed(new FormControl('  padded  '))).toBeNull();
  });

  it('treats non-string values (e.g. null) as empty', () => {
    expect(requiredTrimmed(new FormControl(null))).toEqual({ required: true });
  });
});

describe('passwordsMatch', () => {
  function group(password: string, confirm: string): FormGroup {
    return new FormGroup(
      {
        password: new FormControl(password),
        confirm: new FormControl(confirm),
      },
      { validators: passwordsMatch('password', 'confirm') },
    );
  }

  it('is silent while the confirm field is empty', () => {
    expect(group('secret', '').errors).toBeNull();
  });

  it('flags a filled confirm field that differs', () => {
    expect(group('secret', 'other').errors).toEqual({ passwordMismatch: true });
  });

  it('passes when both fields agree', () => {
    expect(group('secret', 'secret').errors).toBeNull();
  });

  it('re-validates when either field changes', () => {
    const g = group('secret', 'secret');
    g.get('password')!.setValue('changed');
    expect(g.errors).toEqual({ passwordMismatch: true });
    g.get('confirm')!.setValue('changed');
    expect(g.errors).toBeNull();
  });
});
