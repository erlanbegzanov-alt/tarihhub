import { describe, expect, it } from 'vitest'
import {
  DOUBLE_TAP_SCALE,
  IDENTITY,
  MAX_SCALE,
  MIN_SCALE,
  clampScale,
  clampView,
  fitSize,
  isDoubleTap,
  pinch,
  toggleZoom,
  wheelScale,
  zoomAround,
} from './zoom'
import type { Point, ZoomView } from './zoom'

/** A landscape map fitted into a portrait phone: 390 wide, 292.5 tall. */
const phone = { width: 390, height: 700 }
const fitted = fitSize({ width: 2000, height: 1500 }, phone)

/** Which image point (in fitted, unscaled pixels from its centre) sits under `p`. */
const under = (view: ZoomView, p: Point): Point => ({
  x: (p.x - view.x) / view.scale,
  y: (p.y - view.y) / view.scale,
})

describe('clampScale', () => {
  it('keeps the scale between 1× and 4×', () => {
    expect(clampScale(0.4)).toBe(MIN_SCALE)
    expect(clampScale(9)).toBe(MAX_SCALE)
    expect(clampScale(2.2)).toBe(2.2)
  })

  it('falls back to 1× instead of passing NaN or Infinity into a transform', () => {
    expect(clampScale(Number.NaN)).toBe(1)
    expect(clampScale(Number.POSITIVE_INFINITY)).toBe(1)
  })
})

describe('fitSize', () => {
  it('fits by the tighter side and keeps the proportions', () => {
    expect(fitted).toEqual({ width: 390, height: 292.5 })
    expect(fitSize({ width: 2000, height: 1500 }, { width: 1600, height: 900 })).toEqual({
      width: 1200,
      height: 900,
    })
  })

  it('returns an empty box before the viewer has been measured', () => {
    expect(fitSize({ width: 2000, height: 1500 }, { width: 0, height: 0 })).toEqual({ width: 0, height: 0 })
    expect(fitSize({ width: 0, height: 1500 }, phone)).toEqual({ width: 0, height: 0 })
  })
})

describe('clampView', () => {
  it('pins the image to the centre while it is no bigger than the viewer', () => {
    // The y here comes out of Math.min(0, -0) as -0 unless it is folded, and
    // toEqual tells -0 from 0 — so this also guards the "-0px" transform.
    expect(clampView({ scale: 1, x: 120, y: -80 }, fitted, phone)).toEqual(IDENTITY)
  })

  it('lets a zoomed map travel exactly until its edge meets the screen edge', () => {
    // At 2× the map is 780 wide on a 390 screen: 195 of travel each way. It is
    // 585 tall on a 700 screen, so vertically it still fits and stays put.
    const right = clampView({ scale: 2, x: 5000, y: 300 }, fitted, phone)
    expect(right).toEqual({ scale: 2, x: 195, y: 0 })
    const left = clampView({ scale: 2, x: -5000, y: -300 }, fitted, phone)
    expect(left).toEqual({ scale: 2, x: -195, y: 0 })
    // The map's left edge sits on the screen's left edge, not past it.
    expect(right.x - (fitted.width * right.scale) / 2).toBe(-phone.width / 2)
  })

  it('opens up vertical travel once the zoomed map is taller than the screen', () => {
    // 4×: 1170 tall on 700 → 235 each way.
    expect(clampView({ scale: 4, x: 0, y: -9999 }, fitted, phone)).toEqual({ scale: 4, x: 0, y: -235 })
  })

  it('clamps the scale too, so nothing outside 1–4× reaches the screen', () => {
    expect(clampView({ scale: 12, x: 0, y: 0 }, fitted, phone).scale).toBe(MAX_SCALE)
    expect(clampView({ scale: 0.2, x: 50, y: 50 }, fitted, phone)).toEqual(IDENTITY)
  })
})

describe('zoomAround', () => {
  it('keeps the point under the cursor under the cursor', () => {
    const view = { scale: 2, x: 30, y: -10 }
    const cursor = { x: 100, y: 50 }
    const next = zoomAround(view, 3, cursor)
    expect(next.scale).toBe(3)
    expect(under(next, cursor)).toEqual(under(view, cursor))
  })

  it('zooms straight in when the point is the centre', () => {
    expect(zoomAround(IDENTITY, 2, { x: 0, y: 0 })).toEqual({ scale: 2, x: 0, y: 0 })
  })

  it('does not overshoot the limits on the way', () => {
    expect(zoomAround({ scale: 3, x: 0, y: 0 }, 10, { x: 40, y: 40 }).scale).toBe(MAX_SCALE)
  })
})

describe('pinch', () => {
  it('scales with the spread of the fingers and keeps the spot between them', () => {
    const start = { scale: 1, x: 0, y: 0 }
    const from: [Point, Point] = [
      { x: -20, y: 10 },
      { x: 20, y: 10 },
    ]
    const to: [Point, Point] = [
      { x: -40, y: 10 },
      { x: 40, y: 10 },
    ]
    const next = pinch(start, from, to)
    expect(next.scale).toBe(2)
    expect(under(next, { x: 0, y: 10 })).toEqual(under(start, { x: 0, y: 10 }))
  })

  it('pans with two fingers that move together without spreading', () => {
    const start = { scale: 2, x: 0, y: 0 }
    const from: [Point, Point] = [
      { x: -30, y: 0 },
      { x: 30, y: 0 },
    ]
    const to: [Point, Point] = [
      { x: 10, y: 25 },
      { x: 70, y: 25 },
    ]
    expect(pinch(start, from, to)).toEqual({ scale: 2, x: 40, y: 25 })
  })

  it('treats two fingers on the same spot as no zoom rather than NaN', () => {
    const p = { x: 5, y: 5 }
    expect(pinch(IDENTITY, [p, p], [p, { x: 50, y: 50 }]).scale).toBe(1)
  })
})

describe('toggleZoom', () => {
  it('goes in to 2.5× at the tapped spot from 1×', () => {
    const tap = { x: -60, y: 40 }
    const next = toggleZoom(IDENTITY, tap)
    expect(next.scale).toBe(DOUBLE_TAP_SCALE)
    expect(under(next, tap)).toEqual(under(IDENTITY, tap))
  })

  it('goes back to the fitted map from any zoom', () => {
    expect(toggleZoom({ scale: 3.2, x: 80, y: -40 }, { x: 0, y: 0 })).toEqual(IDENTITY)
  })
})

describe('wheelScale', () => {
  it('zooms in on a wheel turned away and out on a wheel turned back', () => {
    expect(wheelScale(2, -100)).toBeGreaterThan(2)
    expect(wheelScale(2, 100)).toBeLessThan(2)
  })

  it('stops at the limits', () => {
    expect(wheelScale(1, 5000)).toBe(MIN_SCALE)
    expect(wheelScale(3.9, -5000)).toBe(MAX_SCALE)
  })

  it('reads line-mode deltas as lines, not pixels', () => {
    // Firefox reports 3 lines for one notch, where Chrome reports 100 pixels.
    expect(wheelScale(1, -3, 1)).toBeCloseTo(wheelScale(1, -48, 0))
  })

  it('answers a trackpad pinch, which arrives as tiny Ctrl+wheel deltas', () => {
    expect(wheelScale(1, -10, 0, true)).toBeGreaterThan(wheelScale(1, -10, 0, false))
  })
})

describe('isDoubleTap', () => {
  const first = { time: 1000, at: { x: 10, y: 10 } }

  it('needs a previous tap', () => {
    expect(isDoubleTap(null, first)).toBe(false)
  })

  it('accepts a second tap that is quick and close', () => {
    expect(isDoubleTap(first, { time: 1200, at: { x: 18, y: 4 } })).toBe(true)
  })

  it('rejects one that is slow, far away, or out of order', () => {
    expect(isDoubleTap(first, { time: 1500, at: { x: 10, y: 10 } })).toBe(false)
    expect(isDoubleTap(first, { time: 1100, at: { x: 90, y: 10 } })).toBe(false)
    expect(isDoubleTap(first, { time: 900, at: { x: 10, y: 10 } })).toBe(false)
  })
})
