import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from 'src/environments/environment';
import { PCService } from './pc.service';
import { PORTRAIT_MAX_BYTES, PortraitService, portraitFileProblem } from './portrait.service';

describe('PortraitService', () => {
  let service: PortraitService;
  let http: HttpTestingController;
  let pcService: jasmine.SpyObj<PCService>;
  const url = (id: number) => `${environment.characterApiUrl}/api/v1/pc/${id}/portrait`;
  const image = () => new Blob(['img'], { type: 'image/jpeg' });

  beforeEach(() => {
    pcService = jasmine.createSpyObj<PCService>('PCService', ['applyPortraitVersion', 'getPCById']);
    TestBed.configureTestingModule({
      providers: [
        { provide: PCService, useValue: pcService },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(PortraitService);
    http = TestBed.inject(HttpTestingController);
    spyOn(URL, 'createObjectURL').and.callFake(() => 'blob:portrait-' + Math.random());
    spyOn(URL, 'revokeObjectURL');
  });

  afterEach(() => http.verify());

  it('a character with no portrait asks for nothing', () => {
    expect(service.portraitUrl(7, null)()).toBeNull();
    expect(service.portraitUrl(7, undefined)()).toBeNull();
    http.expectNone(() => true);
  });

  it('fetches the image as a blob once per version, shared by every caller', () => {
    const sheet = service.portraitUrl(7, 3);
    const roster = service.portraitUrl(7, 3);
    const req = http.expectOne(r => r.url === url(7));
    expect(req.request.params.get('v')).toBe('3');
    expect(req.request.responseType).toBe('blob');
    expect(sheet()).toBeNull(); // still loading

    req.flush(image());

    expect(sheet()).toMatch(/^blob:portrait-/);
    expect(roster()).toBe(sheet());
    // A re-render or a poll with the same version asks for nothing new.
    expect(service.portraitUrl(7, 3)()).toBe(sheet());
    http.expectNone(() => true);
  });

  it('a new version replaces the cached image and frees the old one', () => {
    service.portraitUrl(7, 3);
    http.expectOne(r => r.url === url(7)).flush(image());
    const old = service.portraitUrl(7, 3)();

    const next = service.portraitUrl(7, 4);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(old!);
    http.expectOne(r => r.params.get('v') === '4').flush(image());
    expect(next()).not.toBe(old);
  });

  it('a missing portrait (404) shows the fallback and is not asked for again', () => {
    const portrait = service.portraitUrl(7, 3);
    http.expectOne(r => r.url === url(7)).flush(new Blob(['none']), { status: 404, statusText: 'Not Found' });

    expect(portrait()).toBeNull();
    service.portraitUrl(7, 3);
    http.expectNone(() => true);
  });

  it('a network failure shows the fallback, and the next request tries again', () => {
    const portrait = service.portraitUrl(7, 3);
    http.expectOne(r => r.url === url(7)).error(new ProgressEvent('offline'));

    expect(portrait()).toBeNull();
    service.portraitUrl(7, 3);
    http.expectOne(r => r.url === url(7)).flush(image());
  });

  it('upload PUTs the raw image, and the sheet and roster show it at once without a download', () => {
    const blob = image();
    let version: number | undefined;
    service.upload(7, blob).subscribe(v => (version = v));

    const req = http.expectOne(url(7));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toBe(blob);
    expect(req.request.headers.get('Content-Type')).toBe('image/jpeg');
    req.flush({ portraitVersion: 9 });

    expect(version).toBe(9);
    expect(pcService.applyPortraitVersion).toHaveBeenCalledOnceWith(7, 9);
    expect(service.portraitUrl(7, 9)()).toMatch(/^blob:portrait-/);
    http.expectNone(() => true);
  });

  it('a failed upload changes nothing on the character', () => {
    let failed = false;
    service.upload(7, image()).subscribe({ error: () => (failed = true) });
    http.expectOne(url(7)).flush('too big', { status: 413, statusText: 'Payload Too Large' });

    expect(failed).toBeTrue();
    expect(pcService.applyPortraitVersion).not.toHaveBeenCalled();
  });

  it('remove DELETEs the portrait, clears the version and frees the image', () => {
    service.portraitUrl(7, 3);
    http.expectOne(r => r.url === url(7)).flush(image());
    const shown = service.portraitUrl(7, 3)();

    service.remove(7).subscribe();
    const req = http.expectOne(url(7));
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(pcService.applyPortraitVersion).toHaveBeenCalledOnceWith(7, null);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(shown!);
  });

  describe('demo mode', () => {
    beforeEach(() => spyOnProperty(environment, 'demoMode', 'get').and.returnValue(true));

    it('keeps the picture in memory, bumps the version and makes no request', fakeAsync(() => {
      pcService.getPCById.and.returnValue({ id: 7, name: 'Lyra', portraitVersion: null } as never);
      let version: number | undefined;
      service.upload(7, image()).subscribe(v => (version = v));
      tick(50);

      expect(version).toBe(1);
      expect(pcService.applyPortraitVersion).toHaveBeenCalledOnceWith(7, 1);
      expect(service.portraitUrl(7, 1)()).toMatch(/^blob:portrait-/);

      service.upload(7, image()).subscribe(v => (version = v));
      tick(50);
      expect(version).toBe(2);

      service.remove(7).subscribe();
      tick(50);
      expect(pcService.applyPortraitVersion).toHaveBeenCalledWith(7, null);
      expect(service.portraitUrl(7, 2)()).toBeNull();
      http.expectNone(() => true);
    }));

    it('a version this tab never made has no picture, and is never fetched', () => {
      expect(service.portraitUrl(7, 4)()).toBeNull();
      http.expectNone(() => true);
    });
  });

  describe('portraitFileProblem', () => {
    it('takes JPG, PNG and WebP up to 2 MB', () => {
      expect(portraitFileProblem({ type: 'image/png', size: 10 })).toBeNull();
      expect(portraitFileProblem({ type: 'image/webp', size: PORTRAIT_MAX_BYTES })).toBeNull();
    });

    it('says why anything else is refused', () => {
      expect(portraitFileProblem({ type: 'image/gif', size: 10 })).toBe('That file is not a JPG, PNG or WebP image.');
      expect(portraitFileProblem({ type: 'image/jpeg', size: PORTRAIT_MAX_BYTES + 1 }))
        .toBe('That image is larger than 2 MB. Choose a smaller one.');
    });
  });
});
