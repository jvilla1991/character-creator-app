import { EditableNumberComponent } from './editable-number.component';

describe('EditableNumberComponent', () => {
  let component: EditableNumberComponent;

  beforeEach(() => {
    component = new EditableNumberComponent();
  });

  it('start() does nothing when not editable, intercept or not', () => {
    component.editable = false;
    component.intercept = true;
    const emitted = jasmine.createSpy('emitted');
    component.editRequested.subscribe(emitted);

    component.start();

    expect(emitted).not.toHaveBeenCalled();
    expect(component.editing).toBeFalse();
  });

  it('start() emits editRequested and skips the inline editor when intercept is true', () => {
    component.editable = true;
    component.intercept = true;
    const emitted = jasmine.createSpy('emitted');
    component.editRequested.subscribe(emitted);

    component.start();

    expect(emitted).toHaveBeenCalled();
    expect(component.editing).toBeFalse();
  });

  it('start() opens the inline editor as before when intercept is false (default)', () => {
    component.editable = true;
    component.value = 15;
    const emitted = jasmine.createSpy('emitted');
    component.editRequested.subscribe(emitted);

    component.start();

    expect(emitted).not.toHaveBeenCalled();
    expect(component.editing).toBeTrue();
    expect(component.draft).toBe(15);
  });
});
