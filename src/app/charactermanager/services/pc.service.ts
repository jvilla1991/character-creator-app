import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { EventEmitter, Injectable } from '@angular/core';
import { PC } from '../models/pc';
import { AuthService } from './auth.service';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PCService {
  PCs: PC[] = [];

  private activePCSubject = new BehaviorSubject<PC | null>(null);
  activePC$ = this.activePCSubject.asObservable();

  constructor(private authService: AuthService, private http: HttpClient) {}

  readonly pcUrl = 'http://localhost:8080/api/v1/pc/';

  setPCs(pcs: PC[]) {
    this.PCs = pcs;
  }

  getPCs() {
    const token = this.authService.getToken();

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    
    return this.http.get<PC[]>(this.pcUrl + 'all', { headers });
  }

  PCById(params: HttpParams) {
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

}
