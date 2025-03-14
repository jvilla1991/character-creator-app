import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DndResourcesService {
  private dndResourceUrl = 'https://www.dnd5eapi.co/api/2014/';
  constructor(private http: HttpClient) { }

  getClassNames(): Observable<string[]> {
    return this.http.get<any>(this.dndResourceUrl + 'classes').pipe(
      map(response => response.results.map((item: any) => item.name))
    );
  }

}
