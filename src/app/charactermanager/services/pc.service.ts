import { HttpClient, HttpParams } from '@angular/common/http';
import { EventEmitter, Injectable } from '@angular/core';
import { PC } from '../models/pc';

@Injectable({
  providedIn: 'root'
})
export class PCService {
  PCs: PC[] = [];

  constructor(private http: HttpClient) {
  }

  activePCUpdatedEvent = new EventEmitter<number>;

  readonly pcUrl = 'http://localhost:8080/api/v1/pc/';

  setPCs(pcs: PC[]) {
    this.PCs = pcs;
  }

  getPCs() {
    return this.PCs;
  }

  PCById(params: HttpParams) {
    return this.http.get<PC>(this.pcUrl + "find/", { params });
  }

  getPCById(id: number) {
    return this.PCs.find(x => x.id == id);
  }

}
