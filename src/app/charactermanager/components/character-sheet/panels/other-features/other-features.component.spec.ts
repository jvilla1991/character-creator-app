import { OtherFeaturesComponent } from './other-features.component';
import { PC } from '../../../../models/pc';

describe('OtherFeaturesComponent', () => {
  let component: OtherFeaturesComponent;

  beforeEach(() => {
    component = new OtherFeaturesComponent();
    component.pc = { id: 1, name: 'X', clazz: 'Fighter', level: 4, playerName: 'P' } as PC;
  });

  // --- Category filtering ---

  it('shows only entries tagged category other', () => {
    component.pc = {
      ...component.pc,
      features: [
        { name: 'Action Surge', source: 'Fighter 2', desc: 'Extra action.' },
        { name: 'Darkvision', source: 'Species', desc: 'See in the dark.', category: 'other' },
        { name: 'Second Wind', source: 'Fighter 1', desc: 'Heal.', category: 'class' },
      ],
    };
    expect(component.otherFeatures).toEqual([
      { name: 'Darkvision', source: 'Species', desc: 'See in the dark.', category: 'other' },
    ]);
  });

  it('is empty when the pc has no features at all', () => {
    component.pc = { ...component.pc, features: undefined };
    expect(component.otherFeatures).toEqual([]);
  });

  it('is empty when every feature is a class feature (legacy untagged data)', () => {
    component.pc = {
      ...component.pc,
      features: [{ name: 'Rage', source: 'Barbarian 1', desc: 'Fury.' }],
    };
    expect(component.otherFeatures).toEqual([]);
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
    component.openGrantForm();
    const emitted = jasmine.createSpy('emitted');
    component.featureGranted.subscribe(emitted);

    component.nameDraft = '   ';
    component.submitGrant();

    expect(emitted).not.toHaveBeenCalled();
    expect(component.grantFormOpen).toBeTrue(); // form stays open
  });

  it('emits a trimmed payload with the default source and resets the form', () => {
    component.openGrantForm();
    const emitted = jasmine.createSpy('emitted');
    component.featureGranted.subscribe(emitted);

    component.nameDraft = '  Cloak of Billowing  ';
    component.descDraft = '  Billows dramatically on command.  ';
    component.submitGrant();

    expect(emitted).toHaveBeenCalledWith({
      name: 'Cloak of Billowing',
      source: 'DM Grant',
      desc: 'Billows dramatically on command.',
    });
    expect(component.grantFormOpen).toBeFalse();
    expect(component.nameDraft).toBe('');
    expect(component.sourceDraft).toBe('DM Grant');
    expect(component.descDraft).toBe('');
  });

  it('emits a custom source when the DM overrides it', () => {
    component.openGrantForm();
    const emitted = jasmine.createSpy('emitted');
    component.featureGranted.subscribe(emitted);

    component.nameDraft = 'Stone Sense';
    component.sourceDraft = '  Dwarven Boon  ';
    component.submitGrant();

    expect(emitted).toHaveBeenCalledWith({
      name: 'Stone Sense',
      source: 'Dwarven Boon',
      desc: '',
    });
  });

  it('resets the form on cancel without emitting', () => {
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
