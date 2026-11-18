import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ClassFeatureProgressionEntry } from '../models/class-feature';

/**
 * Reads the class-feature roadmap: every feature a class (plus an optional
 * subclass and World of Warcraft specialization) gains from level 2 to 20.
 * The character sheet uses it to show the features a character has yet to
 * unlock.
 *
 * The catalog is reference data that only changes with a backend deploy, so
 * each class/subclass/specialization combination is fetched once and replayed.
 */
@Injectable({ providedIn: 'root' })
export class ClassFeatureService {

  private readonly url = `${environment.characterApiUrl}/api/v1/catalog/class-features`;
  private readonly cache = new Map<string, Observable<ClassFeatureProgressionEntry[]>>();

  constructor(private http: HttpClient) {}

  /**
   * The roadmap for a class. Never errors: demo mode (no backend), a missing
   * class and a failed request all yield an empty list, so the sheet simply
   * shows no locked features. A failed request is not cached — the next sheet
   * visit tries again.
   */
  progression(clazz: string | null | undefined, subclass?: string | null,
              specialization?: string | null): Observable<ClassFeatureProgressionEntry[]> {
    if (environment.demoMode || !clazz) return of([]);

    const key = `${clazz}|${subclass ?? ''}|${specialization ?? ''}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    let params = new HttpParams().set('clazz', clazz);
    if (subclass) params = params.set('subclass', subclass);
    if (specialization) params = params.set('specialization', specialization);

    const request = this.http.get<ClassFeatureProgressionEntry[]>(this.url, { params }).pipe(
      catchError(() => {
        this.cache.delete(key);
        return of([] as ClassFeatureProgressionEntry[]);
      }),
      shareReplay(1),
    );
    this.cache.set(key, request);
    return request;
  }
}
