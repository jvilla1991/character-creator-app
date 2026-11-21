import {
  ChangeDetectionStrategy, Component, OnDestroy, computed, effect, inject, input, output, signal, untracked,
} from '@angular/core';
import { PC } from '../../../models/pc';
import { PortraitService, portraitFileProblem } from '../../../services/portrait.service';
import {
  CropBox, CropView, PORTRAIT_ZOOM_MAX, PORTRAIT_ZOOM_MIN, clampView, cropBox, sourceSquare,
} from '../../../utils/portrait-crop';
import { ModalComponent } from '../../modal/modal.component';
import { PortraitSilhouetteComponent } from '../../pc-portrait/portrait-silhouette.component';

/** The stage: a square with the round crop marked inside it. */
export const PORTRAIT_STAGE = 240;
/** The crop circle's diameter on the stage. */
export const PORTRAIT_RING = 200;
/** The saved portrait: a square JPEG this many pixels across. */
export const PORTRAIT_OUTPUT = 512;
/** How far one arrow key moves the picture (Shift: three times as far). */
const NUDGE = 8;

const UNREADABLE = 'Could not read that image. Try another file.';
const SAVE_FAILED = 'Could not save the portrait. Your picture is still here — try again.';
const REMOVE_FAILED = 'Could not remove the portrait. Try again.';

/** The picture on the stage. */
interface StagedImage {
  url: string;
  element: HTMLImageElement;
  /** Chosen in this dialog (its object URL is ours to revoke), not the saved portrait. */
  chosen: boolean;
}

/**
 * Upload, place or remove a character's portrait. The picture is dragged (or
 * nudged with the arrow keys) and zoomed behind a round crop; the two previews
 * show it as the sheet and the roster will. Saving draws the cropped square to
 * a 512px JPEG and uploads that, never the original file.
 *
 * It renders its own backdrop, so a click outside goes through the same guard
 * as Cancel: nothing closes while a save or a removal is on its way.
 */
@Component({
  selector: 'app-portrait-dialog',
  templateUrl: './portrait-dialog.component.html',
  styleUrls: ['./portrait-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, PortraitSilhouetteComponent],
})
export class PortraitDialogComponent implements OnDestroy {
  readonly pc = input.required<PC>();
  /** Closed: cancelled, or the portrait was saved or removed. */
  readonly closed = output<void>();

  private readonly portraits = inject(PortraitService);

  readonly stageSize = PORTRAIT_STAGE;
  readonly ringSize = PORTRAIT_RING;
  readonly ringInset = (PORTRAIT_STAGE - PORTRAIT_RING) / 2;
  readonly zoomMin = PORTRAIT_ZOOM_MIN * 100;
  readonly zoomMax = PORTRAIT_ZOOM_MAX * 100;

  readonly staged = signal<StagedImage | null>(null);
  readonly view = signal<CropView | null>(null);
  /** Something to save: a new picture, or the saved one moved or zoomed. */
  readonly dirty = signal(false);
  /** Why the chosen file was refused, said in the dialog. */
  readonly fileError = signal<string | null>(null);
  /** A save or removal that failed, said in the dialog. */
  readonly actionError = signal<string | null>(null);
  readonly busy = signal<'save' | 'remove' | null>(null);

  readonly hasSaved = computed(() => this.pc().portraitVersion != null);
  readonly canSave = computed(() => this.staged() !== null && this.dirty() && this.busy() === null);

  /** Where the picture sits on the stage, the two previews (inside their rings), as boxes. */
  readonly stageBox = computed(() => this.boxFor(PORTRAIT_RING, this.ringInset));
  readonly sheetBox = computed(() => this.boxFor(84, 0));
  readonly rosterBox = computed(() => this.boxFor(34, 0));
  readonly zoomPercent = computed(() => Math.round((this.view()?.zoom ?? 1) * 100));

  private drag: { pointerId: number; x: number; y: number; offsetX: number; offsetY: number } | null = null;
  private destroyed = false;
  /** Bumped by every load, so a slow decode of an older choice is dropped. */
  private loads = 0;

  constructor() {
    // Show the saved portrait to start with, once its image is in.
    const saved = computed(() => {
      const pc = this.pc();
      return this.portraits.portraitUrl(pc.id, pc.portraitVersion)();
    });
    effect(() => {
      const url = saved();
      if (url) untracked(() => { if (!this.staged()) this.load(url, false); });
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.release(this.staged());
  }

  // ── Choosing a file ────────────────────────────────────────────────────────

  onFileChosen(event: Event): void {
    const field = event.target as HTMLInputElement;
    const file = field.files?.[0];
    // Cleared so choosing the same file again still fires a change.
    field.value = '';
    if (!file) return;
    this.actionError.set(null);
    const problem = portraitFileProblem(file);
    if (problem) {
      this.fileError.set(problem);
      return;
    }
    this.fileError.set(null);
    this.load(URL.createObjectURL(file), true);
  }

  private load(url: string, chosen: boolean): void {
    const load = ++this.loads;
    const element = new Image();
    element.onload = () => {
      if (this.destroyed || load !== this.loads || !element.naturalWidth || !element.naturalHeight) {
        if (chosen) URL.revokeObjectURL(url);
        if (!this.destroyed && load === this.loads) this.fileError.set(UNREADABLE);
        return;
      }
      this.release(this.staged());
      this.staged.set({ url, element, chosen });
      this.view.set({ width: element.naturalWidth, height: element.naturalHeight, zoom: 1, offsetX: 0, offsetY: 0 });
      this.dirty.set(chosen);
    };
    element.onerror = () => {
      if (chosen) URL.revokeObjectURL(url);
      // The saved portrait failing to load is not the player's doing; say nothing.
      if (!this.destroyed && load === this.loads && chosen) this.fileError.set(UNREADABLE);
    };
    element.src = url;
  }

  private release(image: StagedImage | null): void {
    if (image?.chosen) URL.revokeObjectURL(image.url);
  }

  // ── Placing the picture ────────────────────────────────────────────────────

  onZoom(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value) / 100;
    this.update({ zoom: value });
  }

  onPointerDown(event: PointerEvent): void {
    const view = this.view();
    if (!view || this.busy()) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    this.drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, offsetX: view.offsetX, offsetY: view.offsetY };
  }

  onPointerMove(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    this.update({
      offsetX: drag.offsetX + event.clientX - drag.x,
      offsetY: drag.offsetY + event.clientY - drag.y,
    });
  }

  onPointerUp(event: PointerEvent): void {
    if (this.drag?.pointerId === event.pointerId) this.drag = null;
  }

  onStageKey(event: KeyboardEvent): void {
    const view = this.view();
    if (!view || this.busy()) return;
    const step = event.shiftKey ? NUDGE * 3 : NUDGE;
    // The arrow moves the picture the way it points.
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    this.update({ offsetX: view.offsetX + move[0], offsetY: view.offsetY + move[1] });
  }

  private update(change: Partial<CropView>): void {
    const view = this.view();
    if (!view) return;
    const next = clampView({ ...view, ...change }, PORTRAIT_RING);
    if (next.zoom === view.zoom && next.offsetX === view.offsetX && next.offsetY === view.offsetY) return;
    this.view.set(next);
    this.dirty.set(true);
  }

  private boxFor(size: number, inset: number): CropBox | null {
    const view = this.view();
    if (!view) return null;
    const box = cropBox(view, PORTRAIT_RING, size);
    return { ...box, left: box.left + inset, top: box.top + inset };
  }

  // ── Saving and removing ────────────────────────────────────────────────────

  async save(): Promise<void> {
    const staged = this.staged();
    const view = this.view();
    if (!staged || !view || !this.canSave()) return;
    this.busy.set('save');
    this.actionError.set(null);
    const blob = await this.render(staged.element, view).catch(() => null);
    if (this.destroyed) return;
    if (!blob) {
      this.busy.set(null);
      this.actionError.set(SAVE_FAILED);
      return;
    }
    this.portraits.upload(this.pc().id, blob).subscribe({
      next: () => {
        this.busy.set(null);
        this.closed.emit();
      },
      error: () => {
        this.busy.set(null);
        this.actionError.set(SAVE_FAILED);
      },
    });
  }

  remove(): void {
    if (this.busy() || !this.hasSaved()) return;
    this.busy.set('remove');
    this.actionError.set(null);
    this.portraits.remove(this.pc().id).subscribe({
      next: () => {
        this.busy.set(null);
        this.closed.emit();
      },
      error: () => {
        this.busy.set(null);
        this.actionError.set(REMOVE_FAILED);
      },
    });
  }

  /** Cancel, Escape, the close button and a click on the backdrop all come here. */
  dismiss(): void {
    if (this.busy()) return;
    this.closed.emit();
  }

  /** The cropped square, drawn onto an opaque ground (a JPEG has no transparency). */
  private render(element: HTMLImageElement, view: CropView): Promise<Blob> {
    const canvas = document.createElement('canvas');
    canvas.width = PORTRAIT_OUTPUT;
    canvas.height = PORTRAIT_OUTPUT;
    const context = canvas.getContext('2d');
    if (!context) return Promise.reject(new Error('No canvas'));
    // A canvas cannot read the theme tokens, and the saved file is the same in
    // every theme: white is the ground a transparent PNG would show on paper.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, PORTRAIT_OUTPUT, PORTRAIT_OUTPUT);
    const square = sourceSquare(view, PORTRAIT_RING);
    context.imageSmoothingQuality = 'high';
    context.drawImage(element, square.x, square.y, square.size, square.size, 0, 0, PORTRAIT_OUTPUT, PORTRAIT_OUTPUT);
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('No image'))), 'image/jpeg', 0.9);
    });
  }
}
