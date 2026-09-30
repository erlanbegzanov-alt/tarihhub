/**
 * Working out an SVG frame from the shapes that have to fit inside it.
 *
 * The app's geo coordinate space (`src/data/geo.ts`) covers far more of Eurasia
 * than any one map wants to show, so every map here starts by cropping the
 * frame to its own content rather than by hand-tuning a `viewBox` string that
 * silently stops being right the moment a shape moves.
 *
 * Lifted out of `KazakhstanMap.tsx`, which had it privately, once the ҰБТ mock
 * needed the same frame for its map stimulus: two copies of a bounding box
 * drift apart, and a frame that disagrees between two screens puts the same
 * marker in two different places.
 */

export interface View {
  minX: number
  minY: number
  width: number
  height: number
}

/**
 * Every `x,y` pair in a path's `d` attribute. The paths in `geo.ts` are
 * pre-projected and written as plain comma-joined numbers, so reading their
 * coordinates back out needs no SVG parser.
 */
const COORD_RE = /(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g

/**
 * The smallest frame holding every coordinate in `paths`, plus `pad` on each
 * side. A bare `x,y` string counts as a path of one point, which is how a
 * label's anchor is kept inside the frame alongside the shapes.
 */
export function pathsView(paths: string[], pad: number): View {
  const points = paths.flatMap((path) => [...path.matchAll(COORD_RE)])
  const xs = points.map((m) => Number(m[1]))
  const ys = points.map((m) => Number(m[2]))
  const minX = Math.min(...xs) - pad
  const minY = Math.min(...ys) - pad
  return {
    minX,
    minY,
    width: Math.max(...xs) + pad - minX,
    height: Math.max(...ys) + pad - minY,
  }
}
