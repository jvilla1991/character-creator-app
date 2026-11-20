import { Injectable } from '@angular/core';
import { Observable, forkJoin, throwError } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { CatalogItem, ShopCategory } from '../models/shop';
import { ShopService } from './shop.service';

/** Every category the catalog endpoint serves — it only answers one at a time. */
export const CATALOG_CATEGORIES: ReadonlyArray<ShopCategory> =
  ['WEAPON', 'ARMOR', 'MATERIAL_COMPONENT', 'GEAR', 'TRANSPORT'];

/**
 * The whole item catalog in one list, for anything that has to recognise a
 * catalog key wherever it lives (the JSON paste check, the AI instructions).
 * The catalog is fixed reference data, so the first successful load is kept
 * for the life of the app; a failed load is forgotten, so the next caller
 * tries again. Demo mode has no catalog and yields an empty list.
 */
@Injectable({ providedIn: 'root' })
export class CatalogLookupService {
  private all$: Observable<CatalogItem[]> | null = null;

  constructor(private shopService: ShopService) {}

  all(): Observable<CatalogItem[]> {
    if (!this.all$) {
      this.all$ = forkJoin(CATALOG_CATEGORIES.map(c => this.shopService.getCatalog(c))).pipe(
        map(lists => lists.flat()),
        catchError(err => {
          this.all$ = null;
          return throwError(() => err);
        }),
        shareReplay(1),
      );
    }
    return this.all$;
  }
}
