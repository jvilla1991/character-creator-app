import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { SpellRefreshService } from './spell-refresh.service';
import { DndResourcesService } from './dnd-resources.service';
import { DndSpell } from '../models/dnd-api.types';
import { PcSpell } from '../models/pc';

const TBD = 'TBD: full text coming in the World of Warcraft spells update.';

function dndSpell(o: Partial<DndSpell> = {}): DndSpell {
  return {
    name: 'Rune Strike', level: 1, school: 'evocation', classes: [], actionType: 'action',
    concentration: false, ritual: false, range: 'Self', components: ['v', 's'],
    duration: 'Instantaneous', description: 'Your weapon flares with runes.', ...o,
  };
}

const stale = (o: Partial<PcSpell> = {}): PcSpell => ({
  lvl: 1, name: 'Rune Strike', school: 'necromancy', time: 'action', prepared: true,
  range: 'TBD', duration: 'TBD', description: TBD, ...o,
});

describe('SpellRefreshService', () => {
  let dndResources: jasmine.SpyObj<DndResourcesService>;

  beforeEach(() => {
    dndResources = jasmine.createSpyObj<DndResourcesService>('DndResourcesService', ['getSpells']);
    dndResources.getSpells.and.returnValue(of([dndSpell()]));
    TestBed.configureTestingModule({
      providers: [{ provide: DndResourcesService, useValue: dndResources }],
    });
  });

  const create = (): SpellRefreshService => TestBed.inject(SpellRefreshService);

  it('does not fetch the catalog until load() is called, and shows the saved spell meanwhile', () => {
    const service = create();
    const saved = stale();

    expect(service.refresh(saved)).toBe(saved);
    expect(dndResources.getSpells).not.toHaveBeenCalled();
  });

  it('after load(), shows the catalog text for a stale placeholder', () => {
    const service = create();
    service.load();

    const shown = service.refresh(stale());
    expect(shown.description).toBe('Your weapon flares with runes.');
    expect(shown.range).toBe('Self');
    expect(shown.duration).toBe('Instantaneous');
  });

  it('fetches the catalog only once however often load() is called', () => {
    const service = create();
    service.load();
    service.load();

    expect(dndResources.getSpells).toHaveBeenCalledTimes(1);
  });

  it('keeps the saved spell after a failed load, and retries on the next load()', () => {
    dndResources.getSpells.and.returnValue(throwError(() => new Error('offline')));
    const service = create();
    const saved = stale();

    service.load();
    expect(service.refresh(saved)).toBe(saved);

    dndResources.getSpells.and.returnValue(of([dndSpell()]));
    service.load();
    expect(dndResources.getSpells).toHaveBeenCalledTimes(2);
    expect(service.refresh(saved).description).toBe('Your weapon flares with runes.');
  });
});
