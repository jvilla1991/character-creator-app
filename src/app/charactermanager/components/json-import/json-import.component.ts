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

const EXAMPLE_ITEM = {
  name: 'Flametongue Longsword', category: 'weapon', valueGp: 5000, weight: 3, bulk: 2,
  damage: '1d8 slashing + 2d6 fire', notes: 'Requires: attunement. Ignites on command.',
};

const PLACEHOLDERS: Record<JsonImportKind, string> = {
  grant: JSON.stringify(
    { items: [EXAMPLE_ITEM, { name: 'Potion of Greater Healing', category: 'gear', qty: 3,
                              valueGp: 150, weight: 0.5, bulk: 1 }] }, null, 2),
  loot: JSON.stringify(
    { coinGp: 125.5,
      items: [EXAMPLE_ITEM, { name: 'Potion of Greater Healing', category: 'gear', qty: 3,
                              valueGp: 150, weight: 0.5, bulk: 1 }] }, null, 2),
  shop: JSON.stringify(
    { name: 'The Gilded Flask', settlement: 'Phandalin',
      items: [{ name: 'Flametongue Longsword', category: 'weapon', priceGp: 5000, weight: 3, bulk: 2,
                damage: '1d8 slashing + 2d6 fire', notes: 'Requires: attunement. Ignites on command.' },
              { key: 'rations' }] }, null, 2),
};

/** What a paste for each box looks like — the first half of the empty-box hint. */
const FORMAT_HINTS: Record<JsonImportKind, string> = {
  grant: 'Each item is written out: a "name", a "category" and its stats ("damage" for a weapon, '
    + '"armorClass" for armor, "weight", "bulk", "valueGp", "notes").',
  loot: 'Each item is written out: a "name", a "category" and its stats ("damage" for a weapon, '
    + '"armorClass" for armor, "weight", "bulk", "valueGp", "notes"); "coinGp" is the coin pile.',
  shop: 'A shop has a "name" and its items. Each item is written out with a "name", a "category", '
    + 'a "priceGp" and its stats.',
};

/** What the paste does where the box usually lives — the second half, unless the host says otherwise. */
const USUAL_PURPOSE: Record<JsonImportKind, string> = {
  grant: 'A catalog "key" like "longsword" works too.',
  loot: 'A catalog "key" works too. Importing adds to the loot below.',
  shop: 'A catalog "key" works too. Copy JSON on an existing shop shows the format.',
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
 *  - "Copy AI instructions" puts the format rules on the clipboard, ready to
 *    paste into an AI chat along with the items to format. They tell the AI to
 *    write each item out in full — name, stats, weight, bulk, description —
 *    and never to swap one for something else.
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
  /**
   * A sentence for the empty box about what THIS paste does, in place of the
   * kind's usual closing words ("Importing adds to the loot below" is wrong
   * where the paste starts a new pool).
   */
  readonly purpose = input<string | null>(null);

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
  readonly hint = computed(() =>
    `${FORMAT_HINTS[this.kind()]} ${this.purpose() ?? USUAL_PURPOSE[this.kind()]}`);
  readonly badLines = computed(() => this.check().lines.filter(l => l.problem));
  readonly goodLines = computed(() => this.check().lines.filter(l => !l.problem));
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

  /** Put the format rules on the clipboard, ready to paste into an AI chat with the items. */
  copyBrief(): void {
    navigator.clipboard?.writeText(buildAiBrief(this.kind()));
    this.copied.set(true);
    if (this.copiedTimer) clearTimeout(this.copiedTimer);
    this.copiedTimer = setTimeout(() => this.copied.set(false), 1500);
  }
}
