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
});
