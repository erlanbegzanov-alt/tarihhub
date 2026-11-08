/**
 * The arithmetic behind the full-screen map viewer (`components/ZoomableImage.tsx`),
 * kept out of the component so it can be tested without a DOM: vitest here
 * runs in node and only collects `.test.ts`.
 *
 * Every point is in CSS pixels from the centre of the viewer. The image is
 * laid out at its fitted size, centred, and moved with
 * `translate(x, y) scale(scale)` around its own centre — so `IDENTITY` is the
 * image exactly as fitted, and every view these functions return is one the
 * reader can get back from.
 */

export const MIN_SCALE = 1
export const MAX_SCALE = 4
/** Where a double tap goes from 1×: enough to read a city name on a phone. */
export const DOUBLE_TAP_SCALE = 2.5
/** One press of «+» or «−». */
export const STEP_SCALE = 1.5

export interface Size {
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

export interface ZoomView {
  scale: number
  x: number
  y: number
}

export const IDENTITY: ZoomView = { scale: 1, x: 0, y: 0 }

/** `|| 0` folds both NaN and -0 into a plain 0. */
const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value)) || 0

export function clampScale(scale: number): number {
  return Number.isFinite(scale) ? clamp(scale, MIN_SCALE, MAX_SCALE) : MIN_SCALE
}

/** The largest size with the image's proportions that fits inside `viewport`. */
export function fitSize(image: Size, viewport: Size): Size {
  if (image.width <= 0 || image.height <= 0 || viewport.width <= 0 || viewport.height <= 0) {
    return { width: 0, height: 0 }
  }
  const k = Math.min(viewport.width / image.width, viewport.height / image.height)
  return { width: image.width * k, height: image.height * k }
}

/**
 * The view moved back inside what the reader is allowed to reach. Along an
 * axis where the scaled image is narrower than the viewer it stays centred;
 * where it is wider, its edge may come up to the viewer's edge and no further.
 * So the map always covers the screen along that axis and cannot be flung off
 * it, which on a phone is the difference between panning and losing the map.
 */
export function clampView(view: ZoomView, fitted: Size, viewport: Size): ZoomView {
  const scale = clampScale(view.scale)
  const reachX = Math.max(0, (fitted.width * scale - viewport.width) / 2)
  const reachY = Math.max(0, (fitted.height * scale - viewport.height) / 2)
  return { scale, x: clamp(view.x, -reachX, reachX), y: clamp(view.y, -reachY, reachY) }
}

/**
 * The view at `nextScale` with the image point that was under `from` now under
 * `to`. With `to` left out that is zooming around a fixed point — the cursor
 * for the wheel, the tapped spot for a double tap. Not clamped: pass the
 * result through `clampView`.
 */
export function zoomAround(view: ZoomView, nextScale: number, from: Point, to: Point = from): ZoomView {
  const scale = clampScale(nextScale)
  const k = scale / view.scale
  return { scale, x: to.x - (from.x - view.x) * k, y: to.y - (from.y - view.y) * k }
}

/**
 * A two-finger gesture measured against where it started: the spread sets the
 * scale and the midpoint drags the map along with it, so the spot between the
 * fingers stays between them. Not clamped.
 */
export function pinch(start: ZoomView, from: [Point, Point], to: [Point, Point]): ZoomView {
  const spread = (p: [Point, Point]) => Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y)
  const mid = (p: [Point, Point]): Point => ({ x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 })
  const before = spread(from)
  const ratio = before > 0 ? spread(to) / before : 1
  return zoomAround(start, start.scale * ratio, mid(from), mid(to))
}

/** Double tap / double click: in to `DOUBLE_TAP_SCALE` at the spot, or back out to 1×. */
export function toggleZoom(view: ZoomView, at: Point): ZoomView {
  return view.scale > MIN_SCALE + 0.01 ? IDENTITY : zoomAround(view, DOUBLE_TAP_SCALE, at)
}

/**
 * The scale after one wheel event. `deltaMode` 1 counts lines and 2 pages
 * (Firefox sends lines); `pinch` is a trackpad pinch, which browsers report as
 * a wheel with Ctrl held and much smaller deltas, so it gets a steeper curve.
 */
export function wheelScale(scale: number, deltaY: number, deltaMode = 0, pinchGesture = false): number {
  const px = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 800 : deltaY
  return clampScale(scale * Math.exp(-px * (pinchGesture ? 0.01 : 0.002)))
}

export interface Tap {
  /** Milliseconds, any clock — only differences are compared. */
  time: number
  at: Point
}

/** Two taps close enough in time and place to be one double tap. */
export function isDoubleTap(previous: Tap | null, next: Tap): boolean {
  if (!previous) return false
  const dt = next.time - previous.time
  return dt >= 0 && dt <= 320 && Math.hypot(next.at.x - previous.at.x, next.at.y - previous.at.y) <= 32
}
