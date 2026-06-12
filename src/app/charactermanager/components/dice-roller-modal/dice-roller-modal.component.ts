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
})
export class DiceRollerModalComponent implements OnDestroy {
  /** Optional — only used to personalise the title. */
  @Input() pc: PC | null = null;

  @Output() close = new EventEmitter<void>();

  @ViewChild('arenaEl') arenaRef?: ElementRef<HTMLElement>;

  /** The dice palette shown across the top of the modal. */
  readonly dieTypes: DieSides[] = [4, 6, 8, 10, 12, 20, 100];

  /** Safety cap so the arena never turns into confetti soup. */
  private readonly MAX_DICE = 20;

  staged: StagedDie[] = [];
  phase: Phase = 'staging';

  // ── Pokéball throw gesture ─────────────────────────────────────────────────
  charging = false;
  /** 0 (tap) … 1 (full wind-up). Drives bounce height + ball lift. */
  power = 0;
  private ballStartY = 0;
  /** A full-strength drag spans ~180px of upward travel. */
  private readonly MAX_DRAG = 180;

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

  removeDie(id: number): void {
    if (this.phase !== 'staging') return;
    this.staged = this.staged.filter(d => d.id !== id);
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

  // ── Pokéball charge / release ──────────────────────────────────────────────

  onBallDown(event: PointerEvent): void {
    if (!this.canThrow) return;
    event.preventDefault();
    this.charging = true;
    this.power = 0;
    this.ballStartY = event.clientY;
  }

  @HostListener('document:pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    if (!this.charging) return;
    const dragUp = Math.max(0, this.ballStartY - event.clientY);
    this.power = Math.min(1, dragUp / this.MAX_DRAG);
  }

  @HostListener('document:pointerup')
  onPointerUp(): void {
    if (!this.charging) return;
    this.charging = false;
    // A bare tap (no meaningful drag) still throws, at a gentle default power.
    this.throwDice(this.power < 0.05 ? 0.45 : this.power);
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
    }, lastDelay + flightMs);
  }

  // ── Results ────────────────────────────────────────────────────────────────

  get grandTotal(): number {
    return this.staged.reduce((sum, d) => sum + (d.value ?? 0), 0);
  }

  /** One summary line per die type, e.g. "3d6 → 4, 2, 6". */
  get breakdown(): { label: string; rolls: number[]; subtotal: number }[] {
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
