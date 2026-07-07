import { PC } from '../../../models/pc';

/**
 * A DM's request to edit one numeric value on a character sheet, captured by
 * an `app-editable-number` in intercept mode instead of opening its own
 * inline editor. `label` matches the backend diff vocabulary in
 * PcActivityLogService (e.g. 'AC', 'current HP', 'STR', 'gp', 'level') so the
 * modal's auto-generated description reads the same as the server's own
 * before/after diff. `apply` is a pure builder — spreads the current PC with
 * the edited field set, mirroring the existing `set*`/`request*` mutators on
 * each surface component.
 */
export interface DmEditRequest {
  label: string;
  value: number | null;
  min: number | null;
  max: number | null;
  apply: (value: number) => PC;
}
