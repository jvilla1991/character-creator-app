import { DmEditModalComponent } from './dm-edit-modal.component';
import { DmEditRequest } from './dm-edit-request';
import { PC } from '../../../models/pc';

describe('DmEditModalComponent', () => {
  let component: DmEditModalComponent;

  const request = (overrides: Partial<DmEditRequest> = {}): DmEditRequest => ({
    label: 'AC',
    value: 15,
    min: 0,
    max: null,
    apply: (v: number) => ({ ac: v } as PC),
    ...overrides,
  });

  const setRequest = (req: DmEditRequest): void => {
    component.request = req;
    component.ngOnChanges({ request: { currentValue: req, previousValue: null, firstChange: true, isFirstChange: () => true } });
  };

  beforeEach(() => {
    component = new DmEditModalComponent();
  });

  // --- init / auto text ---

  it('initializes the value draft and auto-generated description from the request', () => {
    setRequest(request());
    expect(component.valueDraft).toBe(15);
    // Draft starts equal to the current value, so the auto-text initially reads "same → same".
    expect(component.descDraft).toBe('DM changed AC 15 → 15');
  });

  it('renders a null old value as an em dash, mirroring the backend', () => {
    setRequest(request({ value: null, label: 'gp' }));
    component.valueDraft = 10;
    expect(component.autoText).toBe('DM changed gp — → 10');
  });

  // --- live-update / pin / re-arm ---

  it('live-updates the description as the value changes while untouched', () => {
    setRequest(request());
    component.valueDraft = 18;
    component.onValueChange();
    expect(component.descDraft).toBe('DM changed AC 15 → 18');
  });

  it('pins the description once the DM hand-edits it, and stops auto-updating', () => {
    setRequest(request());
    component.descDraft = 'Took a hit from the trap';
    component.onDescInput();
    expect(component.descTouched).toBeTrue();

    component.valueDraft = 20;
    component.onValueChange();
    expect(component.descDraft).toBe('Took a hit from the trap');
  });

  it('re-arms auto-fill when the DM clears the description back to blank', () => {
    setRequest(request());
    component.descDraft = 'Custom note';
    component.onDescInput();
    expect(component.descTouched).toBeTrue();

    component.descDraft = '';
    component.onDescInput();
    expect(component.descTouched).toBeFalse();

    component.valueDraft = 20;
    component.onValueChange();
    expect(component.descDraft).toBe('DM changed AC 15 → 20');
  });

  it('does not mark touched when the typed text exactly matches the current auto-text', () => {
    setRequest(request());
    component.descDraft = component.autoText;
    component.onDescInput();
    expect(component.descTouched).toBeFalse();
  });

  // --- clamping ---

  it('clamps the draft value using min/max, rounding first', () => {
    setRequest(request({ min: 0, max: 20 }));
    component.valueDraft = 25.6;
    expect(component.clamped).toBe(20);

    component.valueDraft = -3;
    expect(component.clamped).toBe(0);
  });

  it('clamped is null for a blank or non-numeric draft', () => {
    setRequest(request());
    component.valueDraft = null;
    expect(component.clamped).toBeNull();
  });

  // --- canSave ---

  it('canSave is false when the clamped value equals the original', () => {
    setRequest(request({ value: 15 }));
    component.valueDraft = 15;
    expect(component.canSave).toBeFalse();
  });

  it('canSave is true when the clamped value differs from the original', () => {
    setRequest(request({ value: 15 }));
    component.valueDraft = 16;
    expect(component.canSave).toBeTrue();
  });

  it('canSave is false when the draft is invalid', () => {
    setRequest(request());
    component.valueDraft = null;
    expect(component.canSave).toBeFalse();
  });

  // --- save ---

  it('save emits the clamped value and null description when left blank', () => {
    setRequest(request({ value: 15 }));
    component.valueDraft = 18;
    component.descDraft = '   ';
    const emitted = jasmine.createSpy('emitted');
    component.confirm.subscribe(emitted);

    component.save();

    expect(emitted).toHaveBeenCalledWith({ value: 18, description: null });
  });

  it('save emits the trimmed hand-typed description when present', () => {
    setRequest(request({ value: 15 }));
    component.valueDraft = 18;
    component.descDraft = '  Took a hit  ';
    const emitted = jasmine.createSpy('emitted');
    component.confirm.subscribe(emitted);

    component.save();

    expect(emitted).toHaveBeenCalledWith({ value: 18, description: 'Took a hit' });
  });

  it('save does nothing when canSave is false', () => {
    setRequest(request({ value: 15 }));
    component.valueDraft = 15;
    const emitted = jasmine.createSpy('emitted');
    component.confirm.subscribe(emitted);

    component.save();

    expect(emitted).not.toHaveBeenCalled();
  });

  // --- cancel ---

  it('cancel emits close', () => {
    setRequest(request());
    const emitted = jasmine.createSpy('emitted');
    component.close.subscribe(emitted);

    component.cancel();

    expect(emitted).toHaveBeenCalled();
  });
});
