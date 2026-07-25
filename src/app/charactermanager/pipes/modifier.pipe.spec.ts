import { ModifierPipe } from './modifier.pipe';

describe('ModifierPipe', () => {
  let pipe: ModifierPipe;

  beforeEach(() => {
    pipe = new ModifierPipe();
  });

  it('prefixes positive modifiers with +', () => {
    expect(pipe.transform(3)).toBe('+3');
    expect(pipe.transform(1)).toBe('+1');
  });

  it('prefixes zero with + (never renders bare "0")', () => {
    expect(pipe.transform(0)).toBe('+0');
  });

  it('keeps the built-in minus sign for negative modifiers', () => {
    expect(pipe.transform(-1)).toBe('-1');
    expect(pipe.transform(-4)).toBe('-4');
  });
});
