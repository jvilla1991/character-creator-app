import { of, throwError } from 'rxjs';
import { SimpleChange } from '@angular/core';
import { PcLogComponent } from './pc-log.component';
import { PCService } from '../../../../services/pc.service';
import { PC } from '../../../../models/pc';
import { PcActivityLogEntry } from '../../../../models/pc-activity-log';

describe('PcLogComponent', () => {
  let pcService: jasmine.SpyObj<PCService>;
  let component: PcLogComponent;

  const pc = (id: number): PC =>
    ({ id, name: 'X', clazz: 'Rogue', level: 2, playerName: 'P' } as PC);

  const entry = (id: number, description: string, createdAt = '2026-07-04T12:00:00Z'): PcActivityLogEntry =>
    ({ id, pcId: 1, actionType: 'LEVEL_UP', description, createdAt });

  beforeEach(() => {
    pcService = jasmine.createSpyObj<PCService>('PCService', ['getLog']);
    component = new PcLogComponent(pcService);
  });

  function bind(newPc: PC, previous?: PC): void {
    component.pc = newPc;
    component.ngOnChanges({ pc: new SimpleChange(previous, newPc, previous == null) });
  }

  it('loads the log entries when a character binds, in server order', () => {
    pcService.getLog.and.returnValue(of([entry(2, 'Bought Rope for 1 gp'), entry(1, 'Leveled up to 3')]));

    bind(pc(1));

    expect(pcService.getLog).toHaveBeenCalledWith(1);
    expect(component.entries.map(e => e.description)).toEqual(['Bought Rope for 1 gp', 'Leveled up to 3']);
  });

  it('does not reload for same-character change events, but does for a new character', () => {
    pcService.getLog.and.returnValue(of([]));
    bind(pc(1));
    bind(pc(1), pc(1)); // live overlay refresh of the same PC
    expect(pcService.getLog).toHaveBeenCalledTimes(1);

    bind(pc(2), pc(1));
    expect(pcService.getLog).toHaveBeenCalledTimes(2);
  });

  it('leaves the list empty when the log is not readable (stranger)', () => {
    pcService.getLog.and.returnValue(throwError(() => new Error('403')));

    bind(pc(1));

    expect(component.entries).toEqual([]);
  });

  describe('entryDate', () => {
    let realDateNow: () => number;

    beforeEach(() => {
      realDateNow = Date.now;
    });

    afterEach(() => {
      Date.now = realDateNow;
    });

    it('labels an entry from today as "Today, <time>"', () => {
      const now = new Date('2026-07-07T18:00:00Z');
      Date.now = () => now.getTime();

      const result = component.entryDate(entry(1, 'x', new Date('2026-07-07T12:00:00Z').toISOString()));

      expect(result).toContain('Today,');
    });

    it('labels an entry from yesterday as "Yesterday, <time>"', () => {
      const now = new Date('2026-07-07T18:00:00Z');
      Date.now = () => now.getTime();

      const result = component.entryDate(entry(1, 'x', new Date('2026-07-06T09:00:00Z').toISOString()));

      expect(result).toContain('Yesterday,');
    });

    it('shows a short date for older entries', () => {
      const now = new Date('2026-07-07T18:00:00Z');
      Date.now = () => now.getTime();

      const result = component.entryDate(entry(1, 'x', new Date('2026-06-01T09:00:00Z').toISOString()));

      expect(result).not.toContain('Today');
      expect(result).not.toContain('Yesterday');
      expect(result.length).toBeGreaterThan(0);
    });

    it('is tolerant of a bad date, returning an empty string', () => {
      const result = component.entryDate(entry(1, 'x', 'not-a-date'));

      expect(result).toBe('');
    });
  });
});
