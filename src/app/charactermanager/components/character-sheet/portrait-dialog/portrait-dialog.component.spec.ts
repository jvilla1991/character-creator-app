import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';
import { PC } from '../../../models/pc';
import { PortraitService } from '../../../services/portrait.service';
import { PORTRAIT_OUTPUT, PortraitDialogComponent } from './portrait-dialog.component';

/** A real picture of the given size, as a file the dialog can decode. */
async function pngFile(width = 400, height = 200, name = 'hero.png'): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgb(200, 40, 40)';
  ctx.fillRect(0, 0, width, height);
  const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
  return new File([blob], name, { type: 'image/png' });
}

/** Wait (on the real clock) until the condition holds. */
async function until(check: () => boolean, ms = 3000): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise(r => setTimeout(r, 10));
  }
}

describe('PortraitDialogComponent', () => {
  let fixture: ComponentFixture<PortraitDialogComponent>;
  let component: PortraitDialogComponent;
  let portraits: { portraitUrl: jasmine.Spy; upload: jasmine.Spy; remove: jasmine.Spy };
  let closed: number;

  const el = (): HTMLElement => fixture.nativeElement;
  const text = () => el().textContent!.replace(/\s+/g, ' ');
  const button = (label: string) =>
    Array.from(el().querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent!.trim() === label);
  const save = () => button('Save Portrait') ?? button('Saving…')!;

  function create(pc: Partial<PC> = {}): void {
    fixture = TestBed.createComponent(PortraitDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('pc', { id: 7, name: 'Lyra', clazz: 'Wizard', level: 3, ...pc } as PC);
    closed = 0;
    component.closed.subscribe(() => closed++);
    fixture.detectChanges();
  }

  function choose(file: File | { type: string; size: number }): void {
    component.onFileChosen({ target: { files: [file], value: 'C:\\fake' } } as unknown as Event);
    fixture.detectChanges();
  }

  beforeEach(() => {
    portraits = {
      portraitUrl: jasmine.createSpy('portraitUrl').and.returnValue(signal<string | null>(null)),
      upload: jasmine.createSpy('upload').and.returnValue(of(4)),
      remove: jasmine.createSpy('remove').and.returnValue(of(undefined)),
    };
    TestBed.configureTestingModule({
      imports: [PortraitDialogComponent],
      providers: [{ provide: PortraitService, useValue: portraits }],
    });
  });

  afterEach(() => fixture?.destroy());

  it('is the celestial "Character Portrait" dialog with the hint, exactly', () => {
    create();
    expect(el().querySelector('.modal.tone-celestial .modal-title')!.textContent).toContain('Character Portrait');
    expect(el().querySelector('#portrait-hint')!.textContent!.trim().replace(/\s+/g, ' '))
      .toBe('Drag the picture to place it inside the circle. JPG, PNG or WebP, up to 2 MB.');
  });

  it('with no portrait shows the silhouette, a prompt, no Remove, and Save disabled', () => {
    create();
    expect(el().querySelector('.portrait-stage app-portrait-silhouette')).not.toBeNull();
    expect(text()).toContain('Choose an image to start.');
    expect(button('Remove Portrait')).toBeUndefined();
    expect(save().disabled).toBeTrue();
  });

  it('the file picker takes only JPG, PNG and WebP and is labelled', () => {
    create();
    const input = el().querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(input.accept).toBe('image/jpeg,image/png,image/webp');
    expect(input.getAttribute('aria-label')).toBe('Portrait image file');
  });

  it('refuses the wrong type, in words in the dialog', () => {
    create();
    choose({ type: 'image/gif', size: 100 });
    expect(text()).toContain('That file is not a JPG, PNG or WebP image.');
    expect(save().disabled).toBeTrue();
  });

  it('refuses a picture over 2 MB', () => {
    create();
    choose({ type: 'image/jpeg', size: 3 * 1024 * 1024 });
    expect(text()).toContain('That image is larger than 2 MB. Choose a smaller one.');
  });

  it('says so when the picture cannot be read', async () => {
    create();
    choose(new File(['not an image'], 'x.png', { type: 'image/png' }));
    await until(() => component.fileError() !== null);
    fixture.detectChanges();
    expect(text()).toContain('Could not read that image. Try another file.');
    expect(save().disabled).toBeTrue();
  });

  it('a chosen picture fills the stage and both previews, and enables Save', async () => {
    create();
    choose(await pngFile());
    await until(() => component.staged() !== null);
    fixture.detectChanges();

    expect(el().querySelector('.portrait-stage img.crop-img')).not.toBeNull();
    expect(el().querySelectorAll('.preview-circle img').length).toBe(2);
    expect(save().disabled).toBeFalse();
  });

  it('the zoom and the arrow keys move the picture, but never off the circle', async () => {
    create();
    choose(await pngFile(400, 200));
    await until(() => component.staged() !== null);
    fixture.detectChanges();

    const stage = el().querySelector<HTMLElement>('.portrait-stage')!;
    for (let i = 0; i < 40; i++) {
      stage.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    }
    // 400×200 drawn at 400×200 behind a 200px ring: 100px of room each way.
    expect(component.view()!.offsetX).toBe(100);
    stage.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(component.view()!.offsetY).toBe(0);

    const zoom = el().querySelector<HTMLInputElement>('#portrait-zoom')!;
    zoom.value = '300';
    zoom.dispatchEvent(new Event('input'));
    expect(component.view()!.zoom).toBe(3);
    expect(component.view()!.offsetX).toBe(100); // still in range at 3×
  });

  it('saves a 512px JPEG of the crop and closes', async () => {
    create();
    choose(await pngFile());
    await until(() => component.staged() !== null);
    fixture.detectChanges();

    await component.save();

    expect(portraits.upload).toHaveBeenCalledTimes(1);
    const [pcId, blob] = portraits.upload.calls.mostRecent().args as [number, Blob];
    expect(pcId).toBe(7);
    expect(blob.type).toBe('image/jpeg');
    const bitmap = await createImageBitmap(blob);
    expect(bitmap.width).toBe(PORTRAIT_OUTPUT);
    expect(bitmap.height).toBe(PORTRAIT_OUTPUT);
    expect(closed).toBe(1);
  });

  it('shows the busy state while uploading and ignores a second Save or a dismiss', async () => {
    const answer = new Subject<number>();
    portraits.upload.and.returnValue(answer);
    create();
    choose(await pngFile());
    await until(() => component.staged() !== null);

    const first = component.save();
    await first;
    fixture.detectChanges();
    expect(save().textContent!.trim()).toBe('Saving…');
    expect(save().disabled).toBeTrue();
    await component.save();
    component.dismiss();
    expect(portraits.upload).toHaveBeenCalledTimes(1);
    expect(closed).toBe(0);

    answer.next(4);
    expect(closed).toBe(1);
  });

  it('a failed save keeps the dialog and the picture, and says what happened', async () => {
    portraits.upload.and.returnValue(throwError(() => new Error('413')));
    create();
    choose(await pngFile());
    await until(() => component.staged() !== null);

    await component.save();
    fixture.detectChanges();

    expect(closed).toBe(0);
    expect(component.staged()).not.toBeNull();
    expect(text()).toContain('Could not save the portrait. Your picture is still here — try again.');
    expect(save().disabled).toBeFalse();
  });

  it('with a saved portrait shows it, offers Remove, and Remove removes and closes', async () => {
    const saved = await pngFile(512, 512);
    const url = URL.createObjectURL(saved);
    portraits.portraitUrl.and.returnValue(signal<string | null>(url));
    create({ portraitVersion: 2 });
    await until(() => component.staged() !== null);
    fixture.detectChanges();

    expect(portraits.portraitUrl).toHaveBeenCalledWith(7, 2);
    expect(el().querySelector<HTMLImageElement>('.portrait-stage img')!.src).toBe(url);
    // Nothing to save until it is moved or another picture is chosen.
    expect(save().disabled).toBeTrue();

    button('Remove Portrait')!.click();
    expect(portraits.remove).toHaveBeenCalledOnceWith(7);
    expect(closed).toBe(1);
    URL.revokeObjectURL(url);
  });

  it('Cancel closes without saving', () => {
    create();
    button('Cancel')!.click();
    expect(closed).toBe(1);
    expect(portraits.upload).not.toHaveBeenCalled();
  });
});
