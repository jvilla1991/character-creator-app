import { of, throwError } from 'rxjs';

import { GrantService } from './grant.service';
import { PCService } from './pc.service';
import { PC } from '../models/pc';

function makePcServiceSpy(): jasmine.SpyObj<PCService> {
  return jasmine.createSpyObj<PCService>('PCService', ['getPCByIdAsDm', 'updatePCAsDm']);
}

function makePC(overrides: Partial<PC> = {}): PC {
  return { id: 7, name: 'Throk', clazz: 'Barbarian', level: 4, playerName: 'Ben', ...overrides };
}

describe('GrantService', () => {
  let service: GrantService;
  let pcService: jasmine.SpyObj<PCService>;

  beforeEach(() => {
    pcService = makePcServiceSpy();
    service = new GrantService(pcService);
  });

  it('passes the freshly-fetched PC (not the caller\'s copy) into the mutator', () => {
    const fetched = makePC({ name: 'Fresh Throk' });
    const staleCallerCopy = makePC({ name: 'Stale Throk' });
    pcService.getPCByIdAsDm.and.returnValue(of(fetched));
    pcService.updatePCAsDm.and.returnValue(of(fetched));
    const mutate = jasmine.createSpy('mutate').and.callFake((pc: PC) => pc);

    service.grantToPc(7, mutate).subscribe();

    expect(pcService.getPCByIdAsDm).toHaveBeenCalledWith(7);
    expect(mutate).toHaveBeenCalledWith(fetched);
    expect(mutate).not.toHaveBeenCalledWith(staleCallerCopy);
  });

  it('saves the mutator\'s output via updatePCAsDm', () => {
    const fetched = makePC();
    const mutated = makePC({ level: 5 });
    pcService.getPCByIdAsDm.and.returnValue(of(fetched));
    pcService.updatePCAsDm.and.returnValue(of(mutated));

    service.grantToPc(7, () => mutated).subscribe();

    expect(pcService.updatePCAsDm).toHaveBeenCalledWith(mutated);
  });

  it('short-circuits on a GET error without calling updatePCAsDm', () => {
    pcService.getPCByIdAsDm.and.returnValue(throwError(() => new Error('network down')));
    const mutate = jasmine.createSpy('mutate');
    const errorSpy = jasmine.createSpy('error');

    service.grantToPc(7, mutate).subscribe({ error: errorSpy });

    expect(mutate).not.toHaveBeenCalled();
    expect(pcService.updatePCAsDm).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('emits the PUT result', () => {
    const fetched = makePC();
    const saved = makePC({ level: 6 });
    pcService.getPCByIdAsDm.and.returnValue(of(fetched));
    pcService.updatePCAsDm.and.returnValue(of(saved));
    const emitted = jasmine.createSpy('emitted');

    service.grantToPc(7, pc => pc).subscribe(emitted);

    expect(emitted).toHaveBeenCalledWith(saved);
  });
});
