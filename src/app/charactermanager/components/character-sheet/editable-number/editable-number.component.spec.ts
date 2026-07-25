import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditableNumberComponent } from './editable-number.component';

describe('EditableNumberComponent', () => {
  let fixture: ComponentFixture<EditableNumberComponent>;
  let component: EditableNumberComponent;

  beforeEach(() => {
    fixture = TestBed.createComponent(EditableNumberComponent);
    component = fixture.componentInstance;
  });

  it('start() does nothing when not editable, intercept or not', () => {
    fixture.componentRef.setInput('editable', false);
    fixture.componentRef.setInput('intercept', true);
    const emitted = jasmine.createSpy('emitted');
    component.editRequested.subscribe(emitted);

    component.start();

    expect(emitted).not.toHaveBeenCalled();
    expect(component.editing).toBeFalse();
  });

  it('start() emits editRequested and skips the inline editor when intercept is true', () => {
    fixture.componentRef.setInput('editable', true);
    fixture.componentRef.setInput('intercept', true);
    const emitted = jasmine.createSpy('emitted');
    component.editRequested.subscribe(emitted);

    component.start();

    expect(emitted).toHaveBeenCalled();
    expect(component.editing).toBeFalse();
  });

  it('start() opens the inline editor as before when intercept is false (default)', () => {
    fixture.componentRef.setInput('editable', true);
    fixture.componentRef.setInput('value', 15);
    const emitted = jasmine.createSpy('emitted');
    component.editRequested.subscribe(emitted);

    component.start();

    expect(emitted).not.toHaveBeenCalled();
    expect(component.editing).toBeTrue();
    expect(component.draft).toBe(15);
  });
});
