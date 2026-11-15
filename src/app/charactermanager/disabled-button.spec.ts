/**
 * The disabled `.btn` state lives in global `src/styles.css`, which Karma
 * loads (angular.json → test.styles). These specs render real buttons into the
 * document and read computed styles, so they fail if a variant or :hover rule
 * ever out-ranks the disabled rule again — the bug where a disabled "Next" or
 * "Sign In" looked tappable.
 */
describe('Global .btn disabled state', () => {
  const themes = ['midnight', 'vellum', 'candlelit'];
  const variants = ['', 'primary', 'danger', 'play'];
  let host: HTMLElement;
  const root = document.documentElement;
  const originalTheme = root.getAttribute('data-theme');

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    host.remove();
    if (originalTheme === null) root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', originalTheme);
  });

  function button(variant: string, disabled: boolean): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = ['btn', variant].filter(Boolean).join(' ');
    b.disabled = disabled;
    b.textContent = 'Next';
    // Freeze the .15s transition so computed values are final immediately.
    b.style.transition = 'none';
    host.appendChild(b);
    return b;
  }

  /** --text-dim resolved to rgb() through a probe element. */
  function textDim(): string {
    const probe = document.createElement('span');
    probe.style.color = 'var(--text-dim)';
    host.appendChild(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  }

  for (const theme of themes) {
    for (const variant of variants) {
      const name = variant ? `.btn.${variant}` : '.btn';

      it(`${name} reads as disabled in ${theme}: dashed --text-dim hairline, no fill, no glow`, () => {
        root.setAttribute('data-theme', theme);
        const s = getComputedStyle(button(variant, true));
        const dim = textDim();

        expect(s.borderTopStyle).toBe('dashed');
        expect(s.borderTopColor).toBe(dim);
        expect(s.color).toBe(dim);
        expect(s.backgroundImage).toBe('none');
        expect(s.boxShadow).toBe('none');
        expect(s.cursor).toBe('not-allowed');
      });
    }

    it(`an enabled .btn.primary in ${theme} keeps its solid border and gilded fill`, () => {
      root.setAttribute('data-theme', theme);
      const s = getComputedStyle(button('primary', false));

      expect(s.borderTopStyle).toBe('solid');
      expect(s.backgroundImage).toContain('gradient');
    });
  }
});
