import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formats a raw D&D ability/skill modifier as its signed display string:
 * 3 → "+3", 0 → "+0", -1 → "-1". Pure, so Angular only re-evaluates it
 * when the bound number itself changes.
 */
@Pipe({
  name: 'modifier',
  standalone: false,
})
export class ModifierPipe implements PipeTransform {
  transform(value: number): string {
    return value >= 0 ? `+${value}` : `${value}`;
  }
}
