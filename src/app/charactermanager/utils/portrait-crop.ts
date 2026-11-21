/**
 * The geometry of the portrait dialog's round crop, kept pure so it can be
 * tested without a canvas.
 *
 * The picture sits behind a circle of diameter `ring`. At zoom 1 its shorter
 * side exactly spans the circle (the smallest size that leaves no empty space
 * inside it); zoom scales up from there. The position is the offset of the
 * picture's centre from the circle's centre, in stage pixels. Every function
 * here clamps that offset so the circle never shows anything but the picture.
 */

export const PORTRAIT_ZOOM_MIN = 1;
export const PORTRAIT_ZOOM_MAX = 3;

/** The size of the picture as drawn, and where it is. */
export interface CropView {
  /** Natural size of the picture, in its own pixels. */
  width: number;
  height: number;
  zoom: number;
  /** Offset of the picture's centre from the circle's centre, in stage pixels. */
  offsetX: number;
  offsetY: number;
}

/** Where to draw the picture inside a square that the circle exactly fills. */
export interface CropBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** A square region of the picture, in its own pixels. */
export interface SourceSquare {
  x: number;
  y: number;
  size: number;
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return PORTRAIT_ZOOM_MIN;
  return Math.min(PORTRAIT_ZOOM_MAX, Math.max(PORTRAIT_ZOOM_MIN, zoom));
}

/** Stage pixels per picture pixel. */
export function cropScale(view: Pick<CropView, 'width' | 'height' | 'zoom'>, ring: number): number {
  const shorter = Math.min(view.width, view.height);
  return shorter > 0 ? (ring / shorter) * clampZoom(view.zoom) : 0;
}

/** The same view, with the zoom in range and the picture covering the circle. */
export function clampView(view: CropView, ring: number): CropView {
  const zoom = clampZoom(view.zoom);
  const scale = cropScale({ ...view, zoom }, ring);
  const spareX = Math.max(0, (view.width * scale - ring) / 2);
  const spareY = Math.max(0, (view.height * scale - ring) / 2);
  const clamp = (v: number, spare: number) =>
    Number.isFinite(v) ? Math.min(spare, Math.max(-spare, v)) : 0;
  return { ...view, zoom, offsetX: clamp(view.offsetX, spareX), offsetY: clamp(view.offsetY, spareY) };
}

/**
 * Where the picture goes inside a square of side `box` that the circle fills
 * (the stage's ring, or a preview circle). `ring` is the circle's diameter on
 * the stage, which the offsets are measured in.
 */
export function cropBox(view: CropView, ring: number, box: number): CropBox {
  const v = clampView(view, ring);
  const f = box / ring;
  const scale = cropScale(v, ring) * f;
  const width = v.width * scale;
  const height = v.height * scale;
  return {
    left: box / 2 + v.offsetX * f - width / 2,
    top: box / 2 + v.offsetY * f - height / 2,
    width,
    height,
  };
}

/** The square of the picture that the circle covers — what gets saved. */
export function sourceSquare(view: CropView, ring: number): SourceSquare {
  const v = clampView(view, ring);
  const scale = cropScale(v, ring);
  if (scale <= 0) return { x: 0, y: 0, size: 0 };
  const size = ring / scale;
  return {
    x: v.width / 2 - v.offsetX / scale - size / 2,
    y: v.height / 2 - v.offsetY / scale - size / 2,
    size,
  };
}
