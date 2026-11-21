import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, Signal, WritableSignal, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay, map, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { PCService } from './pc.service';

/** The largest picture the server takes (and the dialog accepts). */
export const PORTRAIT_MAX_BYTES = 2 * 1024 * 1024;
/** The picture types the server takes. */
export const PORTRAIT_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];

/** One character's portrait image, as an object URL, for one portrait version. */
interface PortraitEntry {
  version: number;
  url: WritableSignal<string | null>;
}

const NO_PORTRAIT: Signal<string | null> = signal<string | null>(null).asReadonly();

/**
 * Character portraits. The image needs the same Authorization header as every
 * other call, so an `<img src>` cannot point at the endpoint: it is fetched
 * here as a blob and shown through an object URL.
 *
 * One fetch per character and portrait version: the roster and the sheet ask
 * for the same signal, and a re-render or a poll that brings the same version
 * asks for nothing new. A new version replaces (and revokes) the old URL. A
 * failed fetch leaves the signal null, so the caller shows its fallback; only
 * a network failure (not a 404) is tried again on the next request.
 *
 * Demo mode keeps the pictures in memory and makes no request.
 */
@Injectable({ providedIn: 'root' })
export class PortraitService {
  private readonly http = inject(HttpClient);
  private readonly pcService = inject(PCService);

  private readonly base = `${environment.characterApiUrl}/api/v1/pc/`;
  private readonly entries = new Map<number, PortraitEntry>();

  /**
   * The object URL of a character's portrait at `version`, or null while it
   * loads, when it has none, or when it could not be fetched. Safe to call from
   * a `computed`: it reads no signal and writes none synchronously.
   */
  portraitUrl(pcId: number, version: number | null | undefined): Signal<string | null> {
    if (version == null) return NO_PORTRAIT;
    const known = this.entries.get(pcId);
    if (known && known.version === version) return known.url.asReadonly();
    // Demo pictures only exist in memory: a version this tab did not make has no picture.
    if (environment.demoMode) return NO_PORTRAIT;
    if (known) this.forget(pcId);
    const entry: PortraitEntry = { version, url: signal<string | null>(null) };
    this.entries.set(pcId, entry);
    this.http.get(`${this.base}${pcId}/portrait`, { params: { v: String(version) }, responseType: 'blob' })
      .subscribe({
        next: blob => {
          if (this.entries.get(pcId) !== entry) return; // replaced while loading
          entry.url.set(URL.createObjectURL(blob));
        },
        error: (err: unknown) => {
          // Offline: let the next request try again. A refusal (404, 403) stays put.
          if (err instanceof HttpErrorResponse && err.status === 0 && this.entries.get(pcId) === entry) {
            this.entries.delete(pcId);
          }
        },
      });
    return entry.url.asReadonly();
  }

  /**
   * Save a new portrait (the dialog's 512px JPEG). Answers with the new
   * version, which is also put on the character so the sheet and roster show
   * the picture at once — from this blob, with no second download.
   */
  upload(pcId: number, image: Blob): Observable<number> {
    if (environment.demoMode) {
      const version = (this.entries.get(pcId)?.version ?? this.currentVersion(pcId) ?? 0) + 1;
      this.remember(pcId, version, image);
      return of(version).pipe(delay(50));
    }
    return this.http.put<{ portraitVersion: number }>(`${this.base}${pcId}/portrait`, image, {
      headers: { 'Content-Type': image.type || 'image/jpeg' },
    }).pipe(
      map(res => {
        // A 200 without a version is not something the sheet can show.
        const version = res?.portraitVersion;
        if (typeof version !== 'number') throw new Error('The server did not say which portrait it saved');
        return version;
      }),
      tap(version => this.remember(pcId, version, image)),
    );
  }

  /** Remove the character's portrait; the sheet goes back to the silhouette. */
  remove(pcId: number): Observable<void> {
    const done = () => {
      this.forget(pcId);
      this.pcService.applyPortraitVersion(pcId, null);
    };
    if (environment.demoMode) {
      done();
      return of(undefined).pipe(delay(50));
    }
    return this.http.delete<void>(`${this.base}${pcId}/portrait`).pipe(
      tap(() => done()),
      map(() => undefined),
    );
  }

  private remember(pcId: number, version: number, image: Blob): void {
    this.forget(pcId);
    this.entries.set(pcId, { version, url: signal<string | null>(URL.createObjectURL(image)) });
    this.pcService.applyPortraitVersion(pcId, version);
  }

  private forget(pcId: number): void {
    const old = this.entries.get(pcId);
    if (!old) return;
    this.entries.delete(pcId);
    const url = old.url();
    if (url) URL.revokeObjectURL(url);
  }

  private currentVersion(pcId: number): number | null {
    return this.pcService.getPCById(pcId)?.portraitVersion ?? null;
  }
}

/** Why a chosen file cannot be a portrait, in the dialog's words; null when it can. */
export function portraitFileProblem(file: Pick<File, 'type' | 'size'>): string | null {
  if (!PORTRAIT_TYPES.includes(file.type)) return 'That file is not a JPG, PNG or WebP image.';
  if (file.size > PORTRAIT_MAX_BYTES) return 'That image is larger than 2 MB. Choose a smaller one.';
  return null;
}

