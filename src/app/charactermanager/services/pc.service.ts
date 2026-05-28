import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { PC } from '../models/pc';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class PCService {
  PCs: PC[] = [];

  private pcsSubject = new BehaviorSubject<PC[]>([]);
  pcs$ = this.pcsSubject.asObservable();

  private activePCSubject = new BehaviorSubject<PC | null>(null);
  activePC$ = this.activePCSubject.asObservable();

  constructor(private http: HttpClient) {}

  readonly pcUrl = 'http://localhost:8080/api/v1/pc/';

  // Pushes a known list into the reactive stream (used by external loaders)
  setPCs(pcs: PC[]) {
    this.PCs = pcs;
    this.pcsSubject.next(pcs);
  }

  // Fetches PCs from the backend and pushes the result into pcs$
  refreshPCs(): void {
    if (environment.demoMode) {
      this.pcsSubject.next(this.PCs);
      return;
    }
    this.http.get<PC[]>(this.pcUrl + 'all').subscribe({
      next: (pcs) => {
        this.PCs = pcs;
        this.pcsSubject.next(pcs);
      },
      error: (err) => console.error('Failed to load PCs', err)
    });
  }

  getPCs() {
    if (environment.demoMode) {
      return of(this.PCs).pipe(delay(300));
    }
    return this.http.get<PC[]>(this.pcUrl + 'all');
  }

  PCById(params: HttpParams) {
    if (environment.demoMode) {
      const idParam = params.get('id');
      if (idParam) {
        const pc = this.PCs.find(p => p.id === parseInt(idParam, 10));
        return of(pc || {} as PC).pipe(delay(300));
      }
      return of({} as PC).pipe(delay(300));
    }
    return this.http.get<PC>(this.pcUrl + 'find/', { params });
  }

  getPCById(id: number) {
    return this.PCs.find((x) => x.id == id);
  }

  setActivePC(pc: PC): void {
    this.activePCSubject.next(pc);
  }

  clearActivePC(): void {
    this.activePCSubject.next(null);
  }

  getActivePC(): Observable<PC | null> {
    return this.activePC$;
  }

  addPC(newPC: PC) {
    if (environment.demoMode) {
      const mockPC: PC = { ...newPC, id: Date.now(), level: 1 };
      this.PCs = [...this.PCs, mockPC];
      this.pcsSubject.next(this.PCs);
      return of(mockPC).pipe(delay(300));
    }
    return this.http.post<PC>(this.pcUrl + 'add', newPC);
  }

  deletePC(id: number) {
    if (environment.demoMode) {
      this.PCs = this.PCs.filter(p => p.id !== id);
      this.pcsSubject.next(this.PCs);
      return of([] as PC[]).pipe(delay(300));
    }
    return this.http.delete<PC[]>(this.pcUrl + 'delete/' + id);
  }
}
