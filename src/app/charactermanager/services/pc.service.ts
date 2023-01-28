import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { PC } from '../models/pc';

@Injectable({
  providedIn: 'root'
})
export class PCService {

  constructor(private http: HttpClient) {
  }

 readonly pcUrl = 'http://localhost:8080/api/v1/pc/';

 PCById(id: number) {
    return this.http.get<PC>(this.pcUrl + "find/" + id);
  }
}
