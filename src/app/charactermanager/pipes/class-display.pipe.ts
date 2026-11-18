import { Pipe, PipeTransform } from '@angular/core';
import { classDisplayName } from '../utils/class-display';

/**
 * `{{ pc | classDisplay }}` — the class name to show people (e.g.
 * "Death Knight (Paladin)" for an Ebon Blade paladin). Pure: re-evaluates only
 * when the bound character object changes.
 */
@Pipe({ name: 'classDisplay' })
export class ClassDisplayPipe implements PipeTransform {
  transform(pc: { clazz?: string | null; subclass?: string | null; specialization?: string | null } | null | undefined): string {
    return pc ? classDisplayName(pc.clazz, pc.subclass, pc.specialization) : '';
  }
}
