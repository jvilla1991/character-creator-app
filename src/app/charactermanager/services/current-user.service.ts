import { Injectable } from '@angular/core';
import { CurrentUser } from '../models/campaign';

/**
 * Source of the signed-in user shown in the account row / settings header.
 *
 * Phase 1 returns a demo DM. The seam is deliberate: Phase 3+ will populate
 * this from the real auth/session (the JWT principal) without any caller change.
 */
@Injectable({ providedIn: 'root' })
export class CurrentUserService {
  private user: CurrentUser = {
    name: 'Quill Ashford',
    email: 'quill@tablemimic.app',
    initials: 'QA',
    tint: 'gold',
    title: 'Keeper of Chronicles',
    member_since: 'Spring 2023',
  };

  getUser(): CurrentUser {
    return this.user;
  }
}
