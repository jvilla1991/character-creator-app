import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, convertToParamMap } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Observable, of, throwError } from 'rxjs';

import { characterResolver } from './character.resolver';
import { PCService } from '../services/pc.service';
import { PC } from '../models/pc';

/** Minimal snapshot stub carrying just the ':id' param the resolver reads. */
function snapshotWithId(id: string | null): ActivatedRouteSnapshot {
  return { paramMap: convertToParamMap(id != null ? { id } : {}) } as ActivatedRouteSnapshot;
}

/** The resolver always returns an Observable (never a bare value/Promise). */
function resolve(id: string | null): Observable<PC | null> {
  return TestBed.runInInjectionContext(() =>
    characterResolver(snapshotWithId(id), {} as never)
  ) as Observable<PC | null>;
}

const PC_FIXTURE: PC = {
  id: 42,
  name: 'Aelindra',
  clazz: 'Wizard',
  level: 3,
} as PC;

describe('characterResolver', () => {
  let pcService: jasmine.SpyObj<PCService>;
  let router: Router;

  beforeEach(() => {
    pcService = jasmine.createSpyObj<PCService>('PCService', ['PCById', 'setActivePC']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: PCService, useValue: pcService },
      ],
    });

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  it('fetches the PC by the route id and mirrors it into PCService as the active PC', done => {
    pcService.PCById.and.returnValue(of(PC_FIXTURE));

    resolve('42').subscribe(pc => {
      expect(pc).toEqual(PC_FIXTURE);
      expect(pcService.setActivePC).toHaveBeenCalledWith(PC_FIXTURE);
      expect(router.navigate).not.toHaveBeenCalled();
      done();
    });
  });

  it('redirects to the character list and resolves null on a missing/empty id param', done => {
    resolve(null).subscribe(pc => {
      expect(pc).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/charactermanager']);
      expect(pcService.PCById).not.toHaveBeenCalled();
      done();
    });
  });

  it('redirects to the character list on a non-numeric id param', done => {
    resolve('not-a-number').subscribe(pc => {
      expect(pc).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/charactermanager']);
      expect(pcService.PCById).not.toHaveBeenCalled();
      done();
    });
  });

  it('redirects to the character list when the lookup resolves an empty object (demo-mode not-found)', done => {
    pcService.PCById.and.returnValue(of({} as PC));

    resolve('999').subscribe(pc => {
      expect(pc).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/charactermanager']);
      expect(pcService.setActivePC).not.toHaveBeenCalled();
      done();
    });
  });

  it('redirects to the character list when the lookup errors (e.g. 404)', done => {
    pcService.PCById.and.returnValue(throwError(() => new Error('404')));

    resolve('42').subscribe(pc => {
      expect(pc).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/charactermanager']);
      expect(pcService.setActivePC).not.toHaveBeenCalled();
      done();
    });
  });
});
