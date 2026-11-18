import { classDisplayName } from './class-display';
import { ClassDisplayPipe } from '../pipes/class-display.pipe';

describe('classDisplayName', () => {
  it('shows an Ebon Blade paladin as Death Knight (Paladin)', () => {
    expect(classDisplayName('Paladin', 'Oath of the Ebon Blade')).toBe('Death Knight (Paladin)');
  });

  it('is case-insensitive on the stored base class', () => {
    expect(classDisplayName('paladin', 'Oath of the Ebon Blade')).toBe('Death Knight (Paladin)');
  });

  it('shows a Demon Hunter ranger as Demon Hunter (Ranger)', () => {
    expect(classDisplayName('Ranger', 'Demon Hunter')).toBe('Demon Hunter (Ranger)');
    expect(classDisplayName('Ranger', 'Hunter')).toBe('Ranger');
    expect(classDisplayName('Paladin', 'Demon Hunter')).toBe('Paladin');
  });

  it('leaves other paladins and classes unchanged', () => {
    expect(classDisplayName('Paladin', 'Oath of Devotion')).toBe('Paladin');
    expect(classDisplayName('Paladin', undefined)).toBe('Paladin');
    expect(classDisplayName('Wizard', null)).toBe('Wizard');
  });

  it('does not relabel a mismatched base class carrying the subclass name', () => {
    expect(classDisplayName('Fighter', 'Oath of the Ebon Blade')).toBe('Fighter');
  });

  it('shows a WoW druid (druid + specialization) as plain Druid', () => {
    expect(classDisplayName('Druid', null, 'Balance')).toBe('Druid');
    expect(classDisplayName('druid', 'Circle of the Moon', 'Guardian')).toBe('Druid');
    expect(classDisplayName('Druid', 'Circle of the Land', null)).toBe('Druid');
    expect(classDisplayName('Druid')).toBe('Druid');
  });

  it('shows a WoW barbarian as Shaman (Barbarian), and a base barbarian unchanged', () => {
    expect(classDisplayName('Barbarian', null, 'Elemental')).toBe('Shaman (Barbarian)');
    expect(classDisplayName('barbarian', 'Path of the Elements', 'Elemental')).toBe('Shaman (Barbarian)');
    expect(classDisplayName('Barbarian', 'Path of the Spiritual Guardian', null)).toBe('Shaman (Barbarian)');
    expect(classDisplayName('Barbarian', 'Path of the World Tree', 'Restoration')).toBe('Shaman (Barbarian)');
    expect(classDisplayName('Barbarian', 'Path of the World Tree', null)).toBe('Barbarian');
    expect(classDisplayName('Barbarian')).toBe('Barbarian');
    const pipe = new ClassDisplayPipe();
    expect(pipe.transform({ clazz: 'Barbarian', subclass: null, specialization: 'Enhancement' })).toBe('Shaman (Barbarian)');
  });

  it('shows a WoW fighter as Warrior (Fighter), and a base fighter unchanged', () => {
    expect(classDisplayName('Fighter', null, 'Arms')).toBe('Warrior (Fighter)');
    expect(classDisplayName('fighter', 'Battle Master', 'Protection')).toBe('Warrior (Fighter)');
    expect(classDisplayName('Fighter', 'Champion', 'Fury')).toBe('Warrior (Fighter)');
    expect(classDisplayName('Fighter', 'Battle Master', null)).toBe('Fighter');
    expect(classDisplayName('Fighter')).toBe('Fighter');
    const pipe = new ClassDisplayPipe();
    expect(pipe.transform({ clazz: 'Fighter', subclass: null, specialization: 'Fury' })).toBe('Warrior (Fighter)');
  });

  it('copes with a missing class', () => {
    expect(classDisplayName(undefined, undefined)).toBe('');
  });

  it('backs the classDisplay pipe', () => {
    const pipe = new ClassDisplayPipe();
    expect(pipe.transform({ clazz: 'Paladin', subclass: 'Oath of the Ebon Blade' })).toBe('Death Knight (Paladin)');
    expect(pipe.transform({ clazz: 'Rogue' })).toBe('Rogue');
    expect(pipe.transform({ clazz: 'Druid', subclass: null, specialization: 'Feral' })).toBe('Druid');
    expect(pipe.transform(null)).toBe('');
  });
});
