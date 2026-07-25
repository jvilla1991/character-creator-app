import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn, Router } from '@angular/router';
import { HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { PC } from '../models/pc';
import { PCService } from '../services/pc.service';

/**
 * Resolves the PC named by the character-sheet route's ':id' param before the
 * route activates, and mirrors it into PCService's activePC$ — the single
 * source of truth the sheet already reads (MainContentComponent never
 * fetches on its own; it just subscribes to activePC$). This makes a deep
 * link or a hard refresh on `/charactermanager/:id` show the right character
 * immediately instead of landing on the empty state.
 *
 * On a malformed id, a not-found response (demo mode returns `{}` rather
 * than erroring), or a network error, redirects to the bare character-list
 * route (`/charactermanager`) instead of activating with nothing resolved.
 */
export const characterResolver: ResolveFn<PC | null> = (
  route: ActivatedRouteSnapshot
): Observable<PC | null> => {
  const pcService = inject(PCService);
  const router = inject(Router);

  const idParam = route.paramMap.get('id');
  const id = idParam != null ? Number(idParam) : NaN;

  if (!idParam || isNaN(id)) {
    router.navigate(['/charactermanager']);
    return of(null);
  }

  return pcService.PCById(new HttpParams().set('id', idParam)).pipe(
    map(pc => {
      if (!pc || pc.id == null) {
        router.navigate(['/charactermanager']);
        return null;
      }
      pcService.setActivePC(pc);
      return pc;
    }),
    catchError(() => {
      router.navigate(['/charactermanager']);
      return of(null);
    })
  );
};
