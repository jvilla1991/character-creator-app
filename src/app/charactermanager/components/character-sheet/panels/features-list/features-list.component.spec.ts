import { FeaturesListComponent } from './features-list.component';
import { DndResourcesService } from '../../../../services/dnd-resources.service';
import { PC } from '../../../../models/pc';

describe('FeaturesListComponent', () => {
  let component: FeaturesListComponent;
  let dndResources: jasmine.SpyObj<DndResourcesService>;

  beforeEach(() => {
    dndResources = jasmine.createSpyObj<DndResourcesService>('DndResourcesService', ['getFeatDescription']);
    dndResources.getFeatDescription.and.returnValue('Looked-up feat text.');
    component = new FeaturesListComponent(dndResources);
    component.pc = { id: 1, name: 'X', clazz: 'Fighter', level: 4, playerName: 'P' } as PC;
  });

  it('uses a class feature\'s own description', () => {
    const desc = component.descFor({ name: 'Action Surge', source: 'Fighter 2', desc: 'Extra action.' });
    expect(desc).toBe('Extra action.');
    expect(dndResources.getFeatDescription).not.toHaveBeenCalled();
  });

  it('falls back to the feat lookup for a feat with no description', () => {
    const desc = component.descFor({ name: 'Sentinel', source: 'Feat (Level 4)', desc: '' });
    expect(desc).toBe('Looked-up feat text.');
    expect(dndResources.getFeatDescription).toHaveBeenCalledWith('Sentinel');
  });

  it('returns empty for a non-feat with no description', () => {
    const desc = component.descFor({ name: 'Mystery', source: 'Background', desc: '' });
    expect(desc).toBe('');
    expect(dndResources.getFeatDescription).not.toHaveBeenCalled();
  });

  // --- DM grant form ---

  it('keeps the grant form closed by default and hidden when addAllowed is false', () => {
    expect(component.addAllowed).toBeFalse();
    expect(component.grantFormOpen).toBeFalse();
  });

  it('opens the grant form on request', () => {
    component.addAllowed = true;
    component.openGrantForm();
    expect(component.grantFormOpen).toBeTrue();
  });

  it('blocks submission with a blank name', () => {
    component.addAllowed = true;
    component.openGrantForm();
    const emitted = jasmine.createSpy('emitted');
    component.featureGranted.subscribe(emitted);

    component.nameDraft = '   ';
    component.submitGrant();

    expect(emitted).not.toHaveBeenCalled();
    expect(component.grantFormOpen).toBeTrue(); // form stays open
  });

  it('emits a trimmed payload with the default source and resets the form', () => {
    component.addAllowed = true;
    component.openGrantForm();
    const emitted = jasmine.createSpy('emitted');
    component.featureGranted.subscribe(emitted);

    component.nameDraft = '  Blessing of the Old Gods  ';
    component.descDraft = '  Grants advantage on death saves.  ';
    component.submitGrant();

    expect(emitted).toHaveBeenCalledWith({
      name: 'Blessing of the Old Gods',
      source: 'DM Grant',
      desc: 'Grants advantage on death saves.',
    });
    expect(component.grantFormOpen).toBeFalse();
    expect(component.nameDraft).toBe('');
    expect(component.sourceDraft).toBe('DM Grant');
    expect(component.descDraft).toBe('');
  });

  it('emits a custom source when the DM overrides it', () => {
    component.addAllowed = true;
    component.openGrantForm();
    const emitted = jasmine.createSpy('emitted');
    component.featureGranted.subscribe(emitted);

    component.nameDraft = 'Boon of Vitality';
    component.sourceDraft = '  Divine Boon  ';
    component.submitGrant();

    expect(emitted).toHaveBeenCalledWith({
      name: 'Boon of Vitality',
      source: 'Divine Boon',
      desc: '',
    });
  });

  it('resets the form on cancel without emitting', () => {
    component.addAllowed = true;
    component.openGrantForm();
    const emitted = jasmine.createSpy('emitted');
    component.featureGranted.subscribe(emitted);

    component.nameDraft = 'Half-typed';
    component.cancelGrant();

    expect(emitted).not.toHaveBeenCalled();
    expect(component.grantFormOpen).toBeFalse();
    expect(component.nameDraft).toBe('');
  });
});
