import { EscapeCloseDirective } from './escape-close.directive';

describe('EscapeCloseDirective', () => {
  let directive: EscapeCloseDirective;

  beforeEach(() => {
    directive = new EscapeCloseDirective();
  });

  it('emits escapeClose when the document escape keydown fires', () => {
    const emitted = jasmine.createSpy('emitted');
    directive.escapeClose.subscribe(emitted);

    directive.onEscape();

    expect(emitted).toHaveBeenCalled();
  });

  it('emits once per call (no accumulation across repeated presses)', () => {
    const emitted = jasmine.createSpy('emitted');
    directive.escapeClose.subscribe(emitted);

    directive.onEscape();
    directive.onEscape();

    expect(emitted).toHaveBeenCalledTimes(2);
  });
});
