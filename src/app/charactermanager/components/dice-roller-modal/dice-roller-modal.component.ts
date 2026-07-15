import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { PC } from '../../models/pc';
import { SessionService } from '../../services/session.service';

/** The seven polyhedral dice a player can summon. */
export type DieSides = 4 | 6 | 8 | 10 | 12 | 20 | 100;

interface StagedDie {
  id: number;
  sides: DieSides;
  /** Final rolled face once thrown (undefined while staging). */
  value?: number;
  /** Face currently shown — scrambles during flight, then locks to `value`. */
  display: number;
  // ── Per-die flight choreography (consumed as CSS custom properties) ──────
  dx: number;     // horizontal drift, px
  peak: number;   // ceiling-strike height, px (negative = up toward the top)
  rest: number;   // resting height above the shelf at the end, px (negative = up)
  spin: number;   // total tumble, deg
  delay: number;  // launch stagger, ms
}

type Phase = 'staging' | 'rolling' | 'result';

@Component({
    selector: 'app-dice-roller-modal',
    templateUrl: './dice-roller-modal.component.html',
    styleUrls: ['./dice-roller-modal.component.scss'],
    standalone: false
})
export class DiceRollerModalComponent implements OnDestroy {
  /** Optional — only used to personalise the title. */
  @Input() pc: PC | null = null;

  /** When both are set, a settled roll is logged to this live session's Roll Log. */
  @Input() sessionId: number | string | null = null;
  @Input() participantId: number | null = null;

  @Output() close = new EventEmitter<void>();

  @ViewChild('arenaEl') arenaRef?: ElementRef<HTMLElement>;

  constructor(private sessionService: SessionService) {}

  /** The dice palette shown across the top of the modal. */
  readonly dieTypes: DieSides[] = [4, 6, 8, 10, 12, 20, 100];

  /** Safety cap so the arena never turns into confetti soup. */
  private readonly MAX_DICE = 20;

  staged: StagedDie[] = [];
  phase: Phase = 'staging';

  power = 0;

  // ── Grab-and-throw gesture: the staged dice cluster itself is the drag
  // target (Pokemon Go pokeball feel) — drag it around the arena (clamped to
  // arena bounds), dice spin while held, release with a velocity flick to
  // throw (speed → power); a slow release just drops the cluster in place.
  @ViewChild('shelfEl') shelfRef?: ElementRef<HTMLElement>;

  dragging = false;
  /** Cluster's current offset from its resting position, px — drives the CSS transform. */
  clusterX = 0;
  clusterY = 0;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartClientX = 0;
  private dragStartClientY = 0;
  private dragStartTime = 0;
  /** Rolling buffer of recent pointer samples for release-velocity — {x, y, t}[]. */
  private pointerSamples: { x: number; y: number; t: number }[] = [];
  private readonly VELOCITY_WINDOW_MS = 100; // only samples within the last 100ms count toward release velocity
  private readonly TAP_MOVE_THRESHOLD = 8;   // px — under this, a pointerup is a tap not a drag
  private readonly TAP_TIME_THRESHOLD = 300; // ms
  private readonly FLICK_MIN_VELOCITY = 0.5; // px/ms — below this, release = drop in place, not throw
  private readonly FLICK_MAX_VELOCITY = 2.5; // px/ms — at/above this, power = 1

  private nextId = 1;
  private scrambleTimer?: number;
  private settleTimer?: number;

  // ── Staging ────────────────────────────────────────────────────────────────

  get totalDice(): number {
    return this.staged.length;
  }

  /** Count per type, for the little badge on each palette die. */
  countOf(sides: DieSides): number {
    return this.staged.filter(d => d.sides === sides).length;
  }

  /** Click *or* drag-drop both funnel through here. */
  addDie(sides: DieSides): void {
    if (this.phase !== 'staging') this.reset();
    if (this.staged.length >= this.MAX_DICE) return;
    this.staged.push({
      id: this.nextId++,
      sides,
      display: this.randomFace(sides),
      dx: 0,
      peak: 0,
      rest: 0,
      spin: 0,
      delay: 0,
    });
  }

  /** Drop from the palette into the arena adds a fresh die of that type. */
  onDrop(event: CdkDragDrop<unknown>): void {
    if (event.previousContainer === event.container) return;
    const sides = event.item.data as DieSides;
    if (sides) this.addDie(sides);
  }

  clear(): void {
    this.reset();
    this.staged = [];
  }

  /** Wipe rolled values but keep the same dice, ready to throw again. */
  private reset(): void {
    this.cancelTimers();
    this.phase = 'staging';
    this.staged = this.staged.map(d => ({
      ...d,
      value: undefined,
      display: this.randomFace(d.sides),
      dx: 0,
      peak: 0,
      rest: 0,
      spin: 0,
      delay: 0,
    }));
  }

  // ── Grab-and-throw cluster gesture ──────────────────────────────────────────
  // The staged dice cluster (.dice-shelf) is the grab target itself. Drag it
  // around the arena (clamped to bounds), release with a velocity flick to
  // throw — speed maps to power. A tap still rolls at a gentle default; a slow
  // release just drops the cluster where it was let go, no roll.

  onClusterPointerDown(event: PointerEvent): void {
    if (this.phase !== 'staging') return;
    event.preventDefault();
    // Keeps moves/up bound to this element even if the pointer leaves it —
    // critical for a fast flick on a small touch target.
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    this.dragging = true;
    this.dragStartClientX = event.clientX;
    this.dragStartClientY = event.clientY;
    this.dragStartX = this.clusterX;
    this.dragStartY = this.clusterY;
    this.dragStartTime = performance.now();
    this.pointerSamples = [{ x: event.clientX, y: event.clientY, t: this.dragStartTime }];
  }

  onClusterPointerMove(event: PointerEvent): void {
    if (!this.dragging) return;
    const now = performance.now();
    const dx = event.clientX - this.dragStartClientX;
    const dy = event.clientY - this.dragStartClientY;

    // Clamp so the cluster can't be dragged out of the arena — same
    // rect-measurement approach as throwDice's flight clamping.
    const arenaRect = this.arenaRef?.nativeElement.getBoundingClientRect();
    const shelfRect = this.shelfRef?.nativeElement.getBoundingClientRect();
    let clampedDx = dx;
    let clampedDy = dy;
    if (arenaRect && shelfRect) {
      const margin = 10;
      const minDx = arenaRect.left - shelfRect.left + margin;
      const maxDx = arenaRect.right - shelfRect.right - margin;
      const minDy = arenaRect.top - shelfRect.top + margin;
      const maxDy = arenaRect.bottom - shelfRect.bottom - margin;
      clampedDx = Math.min(maxDx, Math.max(minDx, dx));
      clampedDy = Math.min(maxDy, Math.max(minDy, dy));
    }
    this.clusterX = this.dragStartX + clampedDx;
    this.clusterY = this.dragStartY + clampedDy;

    this.pointerSamples.push({ x: event.clientX, y: event.clientY, t: now });
    const cutoff = now - this.VELOCITY_WINDOW_MS;
    while (this.pointerSamples.length > 2 && this.pointerSamples[0].t < cutoff) {
      this.pointerSamples.shift();
    }
  }

  onClusterPointerUp(event: PointerEvent): void {
    if (!this.dragging) return;
    this.dragging = false;

    const now = performance.now();
    const totalDx = event.clientX - this.dragStartClientX;
    const totalDy = event.clientY - this.dragStartClientY;
    const totalDist = Math.hypot(totalDx, totalDy);
    const elapsed = now - this.dragStartTime;

    if (totalDist < this.TAP_MOVE_THRESHOLD && elapsed < this.TAP_TIME_THRESHOLD) {
      // Tap: roll at the existing gentle default — the cluster never moved.
      this.throwDice(0.45);
      return;
    }

    const speed = this.computeVelocity(this.pointerSamples, { x: event.clientX, y: event.clientY, t: now });

    if (speed < this.FLICK_MIN_VELOCITY) {
      // Slow release: drop in place (cluster stays wherever it was let go; no roll).
      return;
    }

    const power = Math.min(1, (speed - this.FLICK_MIN_VELOCITY) / (this.FLICK_MAX_VELOCITY - this.FLICK_MIN_VELOCITY));
    // Reset the drag offset before throwDice runs, so its dx/peak/rest math
    // (which assumes dice start at their resting shelf position) is
    // undisturbed by wherever the cluster was dragged to.
    this.clusterX = 0;
    this.clusterY = 0;
    this.throwDice(power);
  }

  onClusterPointerCancel(): void {
    // iOS fires this on OS interruptions (e.g. a notification banner) —
    // abandon the drag and snap the cluster home; never throw.
    this.dragging = false;
    this.clusterX = 0;
    this.clusterY = 0;
  }

  /**
   * Straight-line release velocity in px/ms, from the OLDEST sample still in
   * the trailing window to the release point — not a sum of per-frame deltas,
   * which would overweight jittery high-frequency samples. A pure function so
   * it's directly unit-testable without mocking performance.now()/the DOM.
   */
  computeVelocity(
    samples: { x: number; y: number; t: number }[],
    release: { x: number; y: number; t: number },
  ): number {
    if (!samples.length) return 0;
    const oldest = samples[0];
    const dt = Math.max(1, release.t - oldest.t); // avoid div-by-zero on a single-sample window
    const vx = (release.x - oldest.x) / dt;
    const vy = (release.y - oldest.y) / dt;
    return Math.hypot(vx, vy);
  }

  /** Keyboard / click fallback for the throw. */
  throwButton(): void {
    if (this.canThrow) this.throwDice(0.6);
  }

  get canThrow(): boolean {
    return this.phase === 'staging' && this.staged.length > 0;
  }

  // ── The throw ──────────────────────────────────────────────────────────────

  private throwDice(power: number): void {
    if (!this.canThrow) return;
    this.cancelTimers();

    const arenaEl = this.arenaRef?.nativeElement;
    const arenaRect = arenaEl?.getBoundingClientRect();
    const arenaWidth = arenaEl?.clientWidth ?? 480;
    const arenaHeight = arenaEl?.clientHeight ?? 340;
    const spread = arenaWidth * 0.34;

    // Measure each resting die so its flight can be clamped inside the arena.
    const dieEls = arenaEl
      ? Array.from(arenaEl.querySelectorAll<HTMLElement>('.arena-die'))
      : [];
    // Spinning dice poke a few px past their box corners — keep a margin so nothing clips an edge.
    const EDGE = 14;
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

    // Roll the real numbers up front; the animation just reveals them.
    this.staged = this.staged.map((d, i) => {
      const rect = dieEls[i]?.getBoundingClientRect();

      // How far this die may travel before its edge would leave the arena.
      let dxMin = -spread;
      let dxMax = spread;
      let upMax = arenaHeight * 0.84; // available headroom toward the ceiling
      if (rect && arenaRect) {
        dxMax = Math.max(0, arenaRect.right - rect.right - EDGE);
        dxMin = Math.min(0, arenaRect.left - rect.left + EDGE);
        upMax = Math.max(0, rect.top - arenaRect.top - EDGE);
      }

      return {
        ...d,
        value: this.randomFace(d.sides),
        dx: Math.round(clamp((Math.random() * 2 - 1) * spread, dxMin, dxMax)),
        // Strike near the ceiling (harder with more power) but never past it.
        peak: -Math.round(upMax * Math.min(1, 0.7 + power * 0.3)),
        // Settle partway up, always below the ceiling strike.
        rest: -Math.round(Math.min(upMax * 0.55, arenaHeight * (0.26 + Math.random() * 0.18))),
        spin: Math.round((Math.random() < 0.5 ? -1 : 1) * (540 + Math.random() * 720)),
        delay: i * 70,
      };
    });
    this.power = power;
    this.phase = 'rolling';

    // Scramble the faces mid-flight for that "tumbling" read.
    this.scrambleTimer = window.setInterval(() => {
      this.staged = this.staged.map(d =>
        d.value === undefined ? d : { ...d, display: this.randomFace(d.sides) }
      );
    }, 70);

    const lastDelay = (this.staged.length - 1) * 70;
    const flightMs = 1150 + Math.round(power * 450);
    this.settleTimer = window.setTimeout(() => {
      this.cancelTimers();
      // Lock every face to its rolled value.
      this.staged = this.staged.map(d => ({ ...d, display: d.value ?? d.display }));
      this.phase = 'result';
      this.logRollToSession();
    }, lastDelay + flightMs);
  }

  /**
   * Fire-and-forget log of the settled roll to this live session's Roll Log —
   * only when the caller supplied both a session and a participant (a
   * standalone/no-session roll never posts anywhere). A failed log never
   * blocks or reverts the result the player already saw.
   */
  private logRollToSession(): void {
    if (this.sessionId == null || this.participantId == null) return;
    const groups = this.breakdown.map(row => ({ sides: row.sides, rolls: row.rolls }));
    this.sessionService.logRoll(this.sessionId, this.participantId, groups).subscribe({
      error: err => console.error('Failed to log roll', err),
    });
  }

  // ── Results ────────────────────────────────────────────────────────────────

  get grandTotal(): number {
    return this.staged.reduce((sum, d) => sum + (d.value ?? 0), 0);
  }

  /** One summary line per die type, e.g. "3d6 → 4, 2, 6". */
  get breakdown(): { label: string; sides: DieSides; rolls: number[]; subtotal: number }[] {
    const groups = new Map<DieSides, number[]>();
    for (const d of this.staged) {
      if (d.value === undefined) continue;
      const arr = groups.get(d.sides) ?? [];
      arr.push(d.value);
      groups.set(d.sides, arr);
    }
    return this.dieTypes
      .filter(s => groups.has(s))
      .map(s => {
        const rolls = groups.get(s)!;
        return {
          label: `${rolls.length}d${s}`,
          sides: s,
          rolls,
          subtotal: rolls.reduce((a, b) => a + b, 0),
        };
      });
  }

  // ── Plumbing ───────────────────────────────────────────────────────────────

  trackById(_: number, d: StagedDie): number {
    return d.id;
  }

  cancel(): void {
    this.close.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.cancel();
  }

  private randomFace(sides: DieSides): number {
    return Math.floor(Math.random() * sides) + 1;
  }

  private cancelTimers(): void {
    if (this.scrambleTimer) {
      clearInterval(this.scrambleTimer);
      this.scrambleTimer = undefined;
    }
    if (this.settleTimer) {
      clearTimeout(this.settleTimer);
      this.settleTimer = undefined;
    }
  }

  ngOnDestroy(): void {
    this.cancelTimers();
  }
}
