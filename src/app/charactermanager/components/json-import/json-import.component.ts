import {
  ChangeDetectionStrategy, Component, DestroyRef, OnDestroy, OnInit, computed, inject, input, output, signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LootImportPayload } from '../../models/loot';
import { ShopImportPayload } from '../../models/curated-shop';
import { CatalogItem } from '../../models/shop';
import { buildAiBrief } from '../../models/json-import-brief';
import {
  CheckedLine, EMPTY_IMPORT_CHECK, ImportCheck, JsonImportKind, applyKeySuggestion, checkImportJson,
} from '../../models/json-import-check';
import { CatalogLookupService } from '../../services/catalog-lookup.service';
import { environment } from '../../../../environments/environment';

/** What a host receives once a paste has passed the check and been confirmed. */
export interface JsonImportConfirmed {
  /** The normalized lines (and coins) for a grant or a loot list. */
  loot: LootImportPayload | null;
  /** The normalized shop. */
  shop: ShopImportPayload | null;
  /** Catalog items by key, for a host that turns keys into items itself (the grant). */
  catalog: Map<string, CatalogItem>;
}

/** How long typing must pause before the check runs. A paste checks at once. */
export const CHECK_DELAY_MS = 400;

const PLACEHOLDERS: Record<JsonImportKind, string> = {
  grant: JSON.stringify(
    { items: [{ key: 'longsword' }, { key: 'rations', qty: 10 },
              { name: 'Flametongue', category: 'weapon', valueGp: 5000, weight: 3,
                damage: '1d8 slashing + 2d6 fire', notes: 'Ignites on command.' }] }, null, 2),
  loot: JSON.stringify(
    { coinGp: 125.5,
      items: [{ key: 'longsword' }, { key: 'rations', qty: 10 },
              { name: 'Flametongue', category: 'weapon', valueGp: 5000, weight: 3,
                damage: '1d8 slashing + 2d6 fire', notes: 'Ignites on command.' }] }, null, 2),
  shop: JSON.stringify(
    { name: 'The Gilded Flask', settlement: 'Phandalin',
      items: [{ key: 'longsword', priceGp: 12 }, { key: 'rations' }] }, null, 2),
};

const HINTS: Record<JsonImportKind, string> = {
  grant: 'Each item is a catalog "key" (like "longsword") or a custom "name" with optional stats. '
    + 'A loot list\'s Copy JSON pastes straight in.',
  loot: 'Each item is a catalog "key" (like "longsword") or a custom "name" with optional stats; '
    + '"coinGp" adds to the coin pile. Importing adds to the loot below.',
  shop: 'A shop has a "name" and a list of catalog keys; "priceGp" sets this shop\'s own price. '
    + 'Copy JSON on an existing shop shows the format.',
};

/**
 * The one "paste JSON" box, shared by the DM item grant, the curated loot
 * import and the curated shop import. Two things make a paste safe to trust
 * mid-session:
 *
 *  - It checks itself as you go — at once on a paste, and shortly after you
 *    stop typing — and lists every line as it will land plus every problem,
 *    with the closest real item offered for a key the catalog does not have.
 *    The confirm button stays off until the paste is clean.
 *  - "Copy AI instructions" puts the format rules and every valid catalog key
 *    on the clipboard, ready to paste into an AI chat before asking for items.
 *
 * The box owns the text and the check; the host owns the save. It emits the
 * normalized payload on confirm and shows whatever error the host hands back.
 */
@Component({
  selector: 'app-json-import',
  templateUrl: './json-import.component.html',
  styleUrls: ['./json-import.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JsonImportComponent implements OnInit, OnDestroy {
  readonly kind = input.required<JsonImportKind>();
  /** Label for the confirm button. */
  readonly confirmLabel = input('Import');
  /** The host is saving — the confirm button waits. */
  readonly busy = input(false);
  /** The host's save failed; shown until the text changes. */
  readonly serverError = input<string | null>(null);
  /** Whether a Cancel button renders. */
  readonly cancellable = input(false);

  readonly confirmed = output<JsonImportConfirmed>();
  readonly cancelled = output<void>();

  private readonly catalogLookup = inject(CatalogLookupService);
  private readonly destroyRef = inject(DestroyRef);

  /** The demo has no catalog at all — not a failure, just nothing to look up. */
  readonly demoMode = environment.demoMode;

  readonly draft = signal('');
  readonly catalog = signal<CatalogItem[]>([]);
  readonly catalogState = signal<'loading' | 'ready' | 'failed'>('loading');
  readonly check = signal<ImportCheck>(EMPTY_IMPORT_CHECK);
  /** Text has changed since the last check (typing pause, or catalog still loading). */
  readonly checking = signal(false);
  readonly copied = signal(false);

  /** The text the host last tried to save — its error belongs to this text only. */
  private readonly confirmedDraft = signal<string | null>(null);
  private checkTimer: ReturnType<typeof setTimeout> | null = null;
  private copiedTimer: ReturnType<typeof setTimeout> | null = null;
  /** A paste event fired; the input event that follows should check at once. */
  private pasted = false;

  readonly placeholder = computed(() => PLACEHOLDERS[this.kind()]);
  readonly hint = computed(() => HINTS[this.kind()]);
  readonly badLines = computed(() => this.check().lines.filter(l => l.problem));
  readonly goodLines = computed(() => this.check().lines.filter(l => !l.problem));
  /** A shop cannot be written without the catalog, so its instructions wait for it. */
  readonly briefReady = computed(() =>
    this.catalogState() === 'ready' && (this.kind() !== 'shop' || this.catalog().length > 0));
  readonly shownServerError = computed(() =>
    this.confirmedDraft() === this.draft() ? this.serverError() : null);

  /** The one-line verdict above the list. */
  readonly verdict = computed((): { tone: 'idle' | 'good' | 'bad'; text: string } => {
    const check = this.check();
    if (this.checking()) return { tone: 'idle', text: 'Checking…' };
    if (check.state === 'empty') return { tone: 'idle', text: this.hint() };
    if (check.state === 'syntax') return { tone: 'bad', text: check.problems[0] };
    const bad = this.badLines().length;
    const total = check.lines.length;
    if (check.ok) {
      const count = `${total} item${total === 1 ? '' : 's'}`;
      return { tone: 'good', text: total ? `Ready — ${count} checked.` : 'Ready.' };
    }
    if (bad) {
      return { tone: 'bad', text: `${bad} of ${total} line${total === 1 ? '' : 's'} need${bad === 1 ? 's' : ''} fixing.` };
    }
    return { tone: 'bad', text: 'This needs fixing before it can be saved.' };
  });

  ngOnInit(): void {
    this.loadCatalog();
  }

  ngOnDestroy(): void {
    if (this.checkTimer) clearTimeout(this.checkTimer);
    if (this.copiedTimer) clearTimeout(this.copiedTimer);
  }

  loadCatalog(): void {
    this.catalogState.set('loading');
    this.catalogLookup.all().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: items => {
        this.catalog.set(items);
        this.catalogState.set('ready');
        this.runCheck();
      },
      error: () => {
        this.catalogState.set('failed');
        this.runCheck();
      },
    });
  }

  onPaste(): void {
    this.pasted = true;
  }

  /** The text changed: check now after a paste, otherwise once typing pauses. */
  onInput(value: string): void {
    this.draft.set(value);
    if (this.checkTimer) clearTimeout(this.checkTimer);
    this.checkTimer = null;
    if (this.pasted || !value.trim()) {
      this.pasted = false;
      this.runCheck();
      return;
    }
    this.checking.set(true);
    this.checkTimer = setTimeout(() => this.runCheck(), CHECK_DELAY_MS);
  }

  /** Check the text as it stands. Waits for the catalog, which decides which keys are real. */
  runCheck(): void {
    if (this.checkTimer) clearTimeout(this.checkTimer);
    this.checkTimer = null;
    if (this.catalogState() === 'loading') {
      this.checking.set(!!this.draft().trim());
      return;
    }
    // No usable catalog (the demo, or a failed load) is passed as null, so the
    // check can say "cannot look this up" instead of "unknown key".
    const usable = this.catalogState() === 'ready' && !this.demoMode ? this.catalog() : null;
    this.check.set(checkImportJson(this.kind(), this.draft(), usable));
    this.checking.set(false);
  }

  /** Swap a line's key for the suggested one, then check again. */
  useSuggestion(line: CheckedLine): void {
    if (!line.suggestion) return;
    this.draft.set(applyKeySuggestion(this.draft(), line.n, line.suggestion.key));
    this.runCheck();
  }

  confirm(): void {
    if (this.busy()) return;
    this.runCheck();              // a click inside the typing pause still gets a fresh check
    const check = this.check();
    if (this.checking() || !check.ok) return;
    this.confirmedDraft.set(this.draft());
    this.confirmed.emit({
      loot: check.loot,
      shop: check.shop,
      catalog: new Map(this.catalog().map(i => [i.itemKey, i] as [string, CatalogItem])),
    });
  }

  cancel(): void {
    this.cancelled.emit();
  }

  /** Put the format rules and every valid key on the clipboard for an AI chat. */
  copyBrief(): void {
    if (!this.briefReady()) return;
    navigator.clipboard?.writeText(buildAiBrief(this.kind(), this.demoMode ? [] : this.catalog()));
    this.copied.set(true);
    if (this.copiedTimer) clearTimeout(this.copiedTimer);
    this.copiedTimer = setTimeout(() => this.copied.set(false), 1500);
  }
}
