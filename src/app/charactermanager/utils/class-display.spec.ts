import { classDisplayName } from './class-display';
import { ClassDisplayPipe } from '../pipes/class-display.pipe';

describe('classDisplayName', () => {
  it('shows an Ebon Blade paladin as Death Knight (Paladin)', () => {
    expect(classDisplayName('Paladin', 'Oath of the Ebon Blade')).toBe('Death Knight (Paladin)');
  });

  it('is case-insensitive on the stored base class', () => {
    expect(classDisplayName('paladin', 'Oath of the Ebon Blade')).toBe('Death Knight (Paladin)');
  });

  it('leaves other paladins and classes unchanged', () => {
    expect(classDisplayName('Paladin', 'Oath of Devotion')).toBe('Paladin');
    expect(classDisplayName('Paladin', undefined)).toBe('Paladin');
    expect(classDisplayName('Wizard', null)).toBe('Wizard');
  });

  it('does not relabel a mismatched base class carrying the subclass name', () => {
    expect(classDisplayName('Fighter', 'Oath of the Ebon Blade')).toBe('Fighter');
  });

  it('copes with a missing class', () => {
    expect(classDisplayName(undefined, undefined)).toBe('');
  });

  it('backs the classDisplay pipe', () => {
    const pipe = new ClassDisplayPipe();
    expect(pipe.transform({ clazz: 'Paladin', subclass: 'Oath of the Ebon Blade' })).toBe('Death Knight (Paladin)');
    expect(pipe.transform({ clazz: 'Rogue' })).toBe('Rogue');
    expect(pipe.transform(null)).toBe('');
  });
});
