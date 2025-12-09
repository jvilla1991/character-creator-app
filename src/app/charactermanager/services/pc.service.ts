import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { EventEmitter, Injectable } from '@angular/core';
import { PC } from '../models/pc';
import { AuthService } from './auth.service';
import { BehaviorSubject, delay, Observable, of } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class PCService {
  PCs: PC[] = [];

  private activePCSubject = new BehaviorSubject<PC | null>(null);
  activePC$ = this.activePCSubject.asObservable();

  // Mock data for demo mode
  private mockPCs: PC[] = [
    { id: 1, name: 'Aragorn', clazz: 'Fighter', level: 5, playerName: 'Demo Player' },
    { id: 2, name: 'Gandalf', clazz: 'Wizard', level: 10, playerName: 'Demo Player' },
    { id: 3, name: 'Legolas', clazz: 'Ranger', level: 7, playerName: 'Demo Player' }
  ];

  constructor(private authService: AuthService, private http: HttpClient) {
    // Initialize mock data in demo mode
    if (environment.demoMode) {
      this.PCs = [...this.mockPCs];
    }
  }

  readonly pcUrl = 'http://localhost:8080/api/v1/pc/';

  setPCs(pcs: PC[]) {
    this.PCs = pcs;
  }

  getPCs() {
    if (environment.demoMode) {
      return of(this.PCs) // Simulate network delay
    }

    const token = this.authService.getToken();

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    
    return this.http.get<PC[]>(this.pcUrl + 'all', { headers });
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
    if (environment.demoMode) {
      // Add to mock data in demo mode
      const maxId = this.PCs.length > 0 ? Math.max(...this.PCs.map(pc => pc.id)) : 0;
      const pcWithId: PC = {
        ...newPC,
        id: maxId + 1,
        level: newPC.level || 1
      };
      this.PCs.push(pcWithId);
      return of(pcWithId).pipe(delay(300)); // Simulate network delay
    }

    const token = this.authService.getToken();

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    return this.http.post<PC>(this.pcUrl + 'add', newPC, { headers });
  }

  deletePC(id: number){
    if (environment.demoMode) {
      // Remove from mock data in demo mode
      this.PCs = this.PCs.filter(pc => pc.id !== id);
      return of(this.PCs).pipe(delay(300)); // Simulate network delay
    }

    const token = this.authService.getToken();

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    
    return this.http.delete<PC[]>(this.pcUrl + 'delete/' + id, { headers });
  }

}
