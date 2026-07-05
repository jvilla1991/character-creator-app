import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { PC } from '../models/pc';
import { PCService } from './pc.service';

/**
 * Single choke point for a DM granting something (a feature, spell, item, …) to a
 * campaign member's character. PC has no optimistic locking, so we never PUT the
 * sheet's possibly-stale local copy — instead we refetch a fresh PC, apply a pure
 * mutation, and save that. This shrinks (but does not close) the last-write-wins
 * window against a concurrent player edit.
 *
 * Mutator purity contract: in demo mode getPCByIdAsDm returns the *live* local-store
 * object (pc.service.ts:159-163), not a copy. Mutators must therefore be spread-based
 * (`{ ...fresh, … }`) and never mutate `fresh` in place — an in-place mutation would
 * corrupt the store before updatePCAsDm has a chance to run.
 */
@Injectable({
  providedIn: 'root',
})
export class GrantService {
  constructor(private pcService: PCService) {}

  grantToPc(pcId: number, mutate: (fresh: PC) => PC): Observable<PC> {
    return this.pcService.getPCByIdAsDm(pcId).pipe(
      map(fresh => mutate(fresh)),
      switchMap(updated => this.pcService.updatePCAsDm(updated))
    );
  }
}
