import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PC } from '../../../../models/pc';
import { VESTIGE_DOMAINS, VESTIGE_TYPES, VestigeDomain, VestigeType } from '../../../../models/arcana-subclasses';
import { VESTIGE_FROM_LEVEL, isVestigePatron } from '../../../../models/vestige-companion';
import { PCService } from '../../../../services/pc.service';
import { NotificationService } from '../../../../services/notification.service';

let nextPanelId = 0;

/**
 * A Vestige Patron's two choices, on the Followers tab above the list: what
 * its companion is, and the Cleric domain of its Vestige Spells.
 *
 * The type can be changed at any time by the owner and by the DM: one press,
 * saved through the subclass-choices endpoint. The server then rebuilds the
 * companion (or creates it, for a character whose DM set the subclass by hand
 * and who has none yet) and PCService tells the follower list to read again.
 * The domain is chosen once: it is offered here only while it is unset.
 *
 * Renders nothing for any other character and below Warlock 3.
 */
@Component({
  selector: 'app-vestige-panel',
  templateUrl: './vestige-panel.component.html',
  styleUrls: ['./vestige-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
})
export class VestigePanelComponent {
  readonly pc = input.required<PC>();
  /** The viewer owns this character. */
  readonly ownSheet = input(false);
  /** The DM's cross-link view. */
  readonly asDm = input(false);

  private readonly pcService = inject(PCService);
  private readonly notifications = inject(NotificationService);

  readonly types = VESTIGE_TYPES;
  readonly domains = VESTIGE_DOMAINS;
  readonly domainSelectId = `vestige-domain-${++nextPanelId}`;

  /** A write is on its way to the server. */
  readonly saving = signal(false);
  /** The domain picked in the select, not saved yet. */
  domainDraft: VestigeDomain | null = null;

  readonly shown = computed(() => isVestigePatron(this.pc()) && (this.pc().level ?? 1) >= VESTIGE_FROM_LEVEL);
  readonly canEdit = computed(() => this.ownSheet() || this.asDm());
  readonly type = computed(() => this.pc().subclassChoices?.vestigeType ?? null);
  readonly domain = computed(() => this.pc().subclassChoices?.vestigeDomain ?? null);

  /** Choose the companion's type, or change it: saved at once. */
  setType(type: VestigeType): void {
    if (!this.canEdit() || this.saving() || type === this.type()) return;
    this.save({ vestigeType: type }, 'Could not change the Vestige type. Try again.');
  }

  /** Save the domain picked in the select. */
  setDomain(): void {
    const domain = this.domainDraft;
    if (!this.canEdit() || this.saving() || !domain || this.domain()) return;
    this.save({ vestigeDomain: domain }, 'Could not set the Vestige Spells domain. Try again.');
  }

  private save(choices: { vestigeType?: VestigeType; vestigeDomain?: VestigeDomain }, failed: string): void {
    this.saving.set(true);
    this.pcService.setSubclassChoices(this.pc().id, choices, this.asDm()).subscribe({
      next: () => {
        this.saving.set(false);
        this.domainDraft = null;
      },
      error: err => {
        this.saving.set(false);
        this.notifications.error(failed, err);
      },
    });
  }
}
