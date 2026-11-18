import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ClassFeatureService } from './class-feature.service';
import { ClassFeatureProgressionEntry } from '../models/class-feature';
import { DEMO_MODE_KEY, environment } from '../../../environments/environment';

describe('ClassFeatureService', () => {
  let service: ClassFeatureService;
  let http: HttpTestingController;
  const url = `${environment.characterApiUrl}/api/v1/catalog/class-features`;
  const ROADMAP: ClassFeatureProgressionEntry[] = [
    { level: 2, name: 'Action Surge', desc: 'One more action.', subclass: false },
  ];

  beforeEach(() => {
    localStorage.removeItem(DEMO_MODE_KEY);
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ClassFeatureService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem(DEMO_MODE_KEY);
  });

  it('requests the roadmap with class, subclass and specialization', () => {
    let result: ClassFeatureProgressionEntry[] | undefined;
    service.progression('Paladin', 'Oath of the Ebon Blade', 'Frost').subscribe(r => (result = r));

    const req = http.expectOne(r => r.url === url);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('clazz')).toBe('Paladin');
    expect(req.request.params.get('subclass')).toBe('Oath of the Ebon Blade');
    expect(req.request.params.get('specialization')).toBe('Frost');
    req.flush(ROADMAP);
    expect(result).toEqual(ROADMAP);
  });

  it('leaves out subclass and specialization when the character has none', () => {
    service.progression('Fighter', undefined, null).subscribe();
    const req = http.expectOne(r => r.url === url);
    expect(req.request.params.keys()).toEqual(['clazz']);
    req.flush([]);
  });

  it('fetches each class/subclass combination once and replays it', () => {
    const seen: ClassFeatureProgressionEntry[][] = [];
    service.progression('Fighter', 'Champion').subscribe(r => seen.push(r));
    http.expectOne(r => r.url === url).flush(ROADMAP);
    service.progression('Fighter', 'Champion').subscribe(r => seen.push(r));
    http.expectNone(r => r.url === url);
    expect(seen).toEqual([ROADMAP, ROADMAP]);

    service.progression('Fighter', 'Battle Master').subscribe();
    http.expectOne(r => r.url === url).flush([]);
  });

  it('yields an empty roadmap on a failed request, and tries again next time', () => {
    let result: ClassFeatureProgressionEntry[] | undefined;
    service.progression('Fighter').subscribe(r => (result = r));
    http.expectOne(r => r.url === url).flush('boom', { status: 500, statusText: 'Server Error' });
    expect(result).toEqual([]);

    service.progression('Fighter').subscribe(r => (result = r));
    http.expectOne(r => r.url === url).flush(ROADMAP);
    expect(result).toEqual(ROADMAP);
  });

  it('makes no request without a class', () => {
    let result: ClassFeatureProgressionEntry[] | undefined;
    service.progression('').subscribe(r => (result = r));
    http.expectNone(r => r.url === url);
    expect(result).toEqual([]);
  });

  it('makes no request in demo mode', () => {
    localStorage.setItem(DEMO_MODE_KEY, 'true');
    let result: ClassFeatureProgressionEntry[] | undefined;
    service.progression('Fighter', 'Champion').subscribe(r => (result = r));
    http.expectNone(r => r.url === url);
    expect(result).toEqual([]);
  });
});
