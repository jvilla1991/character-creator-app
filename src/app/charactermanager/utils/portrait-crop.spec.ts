import { clampView, clampZoom, cropBox, cropScale, sourceSquare, CropView } from './portrait-crop';

describe('portrait crop', () => {
  const RING = 200;
  /** A landscape picture, twice as wide as it is tall. */
  const wide = (over: Partial<CropView> = {}): CropView =>
    ({ width: 800, height: 400, zoom: 1, offsetX: 0, offsetY: 0, ...over });

  it('at zoom 1 the shorter side exactly spans the circle', () => {
    expect(cropScale(wide(), RING)).toBe(0.5);
    expect(cropScale({ width: 300, height: 900, zoom: 1 }, RING)).toBeCloseTo(200 / 300);
  });

  it('keeps the zoom between 1 and 3', () => {
    expect(clampZoom(0.2)).toBe(1);
    expect(clampZoom(7)).toBe(3);
    expect(clampZoom(Number.NaN)).toBe(1);
    expect(clampView(wide({ zoom: 9 }), RING).zoom).toBe(3);
  });

  it('never lets the picture be dragged so the circle shows empty space', () => {
    // 800×400 at zoom 1 is drawn 400×200: 100px spare each side, none up or down.
    const v = clampView(wide({ offsetX: 500, offsetY: -80 }), RING);
    expect(v.offsetX).toBe(100);
    expect(v.offsetY).toBe(0);
    expect(clampView(wide({ offsetX: -500 }), RING).offsetX).toBe(-100);
  });

  it('zooming in gives more room to move; zooming back out pulls the picture back in', () => {
    const zoomed = clampView(wide({ zoom: 2, offsetX: 1000, offsetY: 1000 }), RING);
    // Drawn 800×400: 300px spare across, 100px down.
    expect(zoomed.offsetX).toBe(300);
    expect(zoomed.offsetY).toBe(100);
    const out = clampView({ ...zoomed, zoom: 1 }, RING);
    expect(out.offsetX).toBe(100);
    expect(out.offsetY).toBe(0);
  });

  it('places the picture so the circle covers its centre at rest', () => {
    const box = cropBox(wide(), RING, RING);
    expect(box).toEqual({ left: -100, top: 0, width: 400, height: 200 });
    // A preview is the same picture scaled to its own circle.
    const preview = cropBox(wide(), RING, 84);
    expect(preview.width).toBeCloseTo(168);
    expect(preview.left).toBeCloseTo(-42);
  });

  it('saves the square of the picture the circle covers', () => {
    expect(sourceSquare(wide(), RING)).toEqual({ x: 200, y: 0, size: 400 });
    // Dragged fully right: the circle shows the picture's left edge.
    expect(sourceSquare(wide({ offsetX: 100 }), RING)).toEqual({ x: 0, y: 0, size: 400 });
    // Zoom 2 halves the square.
    expect(sourceSquare(wide({ zoom: 2 }), RING)).toEqual({ x: 300, y: 100, size: 200 });
  });

  it('the saved square never leaves the picture, wherever it was dragged', () => {
    for (const offsetX of [-999, -50, 0, 50, 999]) {
      for (const zoom of [1, 1.7, 3]) {
        const sq = sourceSquare(wide({ zoom, offsetX, offsetY: offsetX }), RING);
        expect(sq.x).toBeGreaterThanOrEqual(-1e-9);
        expect(sq.y).toBeGreaterThanOrEqual(-1e-9);
        expect(sq.x + sq.size).toBeLessThanOrEqual(800 + 1e-9);
        expect(sq.y + sq.size).toBeLessThanOrEqual(400 + 1e-9);
      }
    }
  });
});
