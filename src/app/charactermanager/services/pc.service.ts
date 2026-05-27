import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { PC } from '../models/pc';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PCService {
  PCs: PC[] = [];

  private activePCSubject = new BehaviorSubject<PC | null>(null);
  activePC$ = this.activePCSubject.asObservable();

  constructor(private http: HttpClient) {}

  readonly pcUrl = 'http://localhost:8080/api/v1/pc/';

  setPCs(pcs: PC[]) {
    this.PCs = pcs;
  }

  getPCs() {
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

  getActivePC(): Observable<PC | null> {
    return this.activePC$;
  }

  addPC(newPC: PC) {
    return this.http.post<PC>(this.pcUrl + 'add', newPC);
  }

  deletePC(id: number) {
    return this.http.delete<PC[]>(this.pcUrl + 'delete/' + id);
  }
}
