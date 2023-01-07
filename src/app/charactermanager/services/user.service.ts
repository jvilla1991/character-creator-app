import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { User } from '../models/user';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  constructor(private http: HttpClient) {
  }

 private user: User | undefined;
 readonly userUrl = 'http://localhost:8080/api/v1/user/';

  getUser() {
    return this.http.get<User>(this.userUrl + "find/6cdb5672-e58e-4ef8-bac1-7e8703971c90");
  }
}
