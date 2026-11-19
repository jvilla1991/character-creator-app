import { Pipe, PipeTransform } from '@angular/core';
import { speciesLabel } from '../models/species';

/**
 * `{{ pc | speciesDisplay }}` — the species to show people, with its lineage
 * where the character has one ("Night Elf", "Tauren (Taunka)"). Pure:
 * re-evaluates only when the bound character object changes.
 */
@Pipe({ name: 'speciesDisplay' })
export class SpeciesDisplayPipe implements PipeTransform {
  transform(pc: { race?: string | null; lineage?: string | null } | null | undefined): string {
    return pc ? speciesLabel(pc.race, pc.lineage) : '';
  }
}
