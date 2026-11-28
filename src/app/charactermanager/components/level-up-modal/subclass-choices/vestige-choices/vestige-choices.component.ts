import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
  VESTIGE_DOMAINS, VESTIGE_TYPES, VestigeChoicesOwed, VestigeDomain, VestigeType,
} from '../../../../models/arcana-subclasses';
import { VESTIGE_DAMAGE } from '../../../../models/vestige-companion';
import { VESTIGE_DOMAIN_SPELLS } from '../../../../models/vestige-spells';

/** What the player has picked for the vestige so far. */
export interface VestigePicks {
  vestigeType?: VestigeType;
  vestigeDomain?: VestigeDomain;
}

/** The Divine Power option each type's vestige has. */
const DIVINE_POWER: Readonly<Record<VestigeType, string>> = {
  Celestial: 'Healing Touch', Fiend: 'Fiendish Swap', Undead: 'Cursed Invocation',
};

/**
 * A Vestige Patron's two choices in the level-up dialog, one radio group each:
 * what its companion is (Celestial, Fiend or Undead) and which Cleric domain
 * its Vestige Spells come from (Life, Light, Trickery or War). Only the group
 * that is still owed is shown.
 *
 * It holds no state and no rules: the host (app-subclass-choices) says what is
 * owed and what is picked, and gets every pick back. The dialog lists the
 * picked domain's spells itself, under Always Prepared.
 */
@Component({
  selector: 'app-vestige-choices',
  templateUrl: './vestige-choices.component.html',
  styleUrls: ['./vestige-choices.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VestigeChoicesComponent {
  /** Which of the two choices to ask for. */
  readonly owed = input.required<VestigeChoicesOwed>();
  /** The picks so far. */
  readonly picks = input<VestigePicks>({});
  /** The player picked a type or a domain; carries both picks. */
  readonly picksChange = output<VestigePicks>();

  readonly types = VESTIGE_TYPES.map(name => ({
    name, desc: `${VESTIGE_DAMAGE[name]} damage and resistance. Divine Power: ${DIVINE_POWER[name]}.`,
  }));

  /** Each domain with the spells it hands over first, at Warlock 3. */
  readonly domains = VESTIGE_DOMAINS.map(name => ({
    name, desc: VESTIGE_DOMAIN_SPELLS[name][0].spells.join(', '),
  }));

  pickType(vestigeType: VestigeType): void {
    this.picksChange.emit({ ...this.picks(), vestigeType });
  }

  pickDomain(vestigeDomain: VestigeDomain): void {
    this.picksChange.emit({ ...this.picks(), vestigeDomain });
  }
}
