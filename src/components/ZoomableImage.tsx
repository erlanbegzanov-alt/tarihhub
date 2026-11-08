import { AnimatePresence, motion } from 'framer-motion'
import { Maximize2, Minus, Plus, RotateCcw, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { cn } from '../lib/cn'
import { easeOut } from '../lib/motion'
import {
  IDENTITY,
  MAX_SCALE,
  MIN_SCALE,
  STEP_SCALE,
  clampView,
  fitSize,
  isDoubleTap,
  pinch,
  toggleZoom,
  wheelScale,
  zoomAround,
} from '../lib/zoom'
import type { Point, Size, Tap, ZoomView } from '../lib/zoom'

/**
 * A picture with more detail than the column it sits in can show — the ҰБТ
 * raster maps, whose small city names cannot be read on a phone at column
 * width. Drawn at column width with a visible «Үлкейту»; a tap anywhere on it
 * opens it full screen, where it pinches and drags on touch, zooms with the
 * wheel or «− / ↺ / +» on a desktop, and toggles 1× ↔ 2.5× on a double tap.
 */
export function ZoomableImage({
  src,
  alt,
  width,
  height,
  className,
}: {
  src: string
  alt: string
  /** Pixel size of the file — reserves the frame so nothing jumps when it loads. */
  width: number
  height: number
  className?: string
}) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'focus-ring group relative block w-full overflow-hidden rounded-lg bg-cream ring-1 ring-line/60',
          className,
        )}
      >
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading="lazy"
          decoding="async"
          className="block h-auto w-full"
        />
        <span className="absolute top-2 right-2 flex items-center gap-1.5 rounded-full bg-surface/90 px-3 py-1.5 text-[12.5px] font-semibold text-ink shadow-soft ring-1 ring-line/60 transition-colors group-hover:text-brand">
          <Maximize2 className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
          {t(s.zoom.enlarge)}
        </span>
      </button>

      {/* Portalled because the exam draws this inside a folding panel with
          `overflow: hidden`, under a card that slides in on a transform — and
          a transformed ancestor turns `position: fixed` into "fixed to that
          card", clipped by it. */}
      {createPortal(
        <AnimatePresence>
          {open && <Viewer src={src} alt={alt} width={width} height={height} onClose={close} />}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}

/** A finger that drifts less than this between down and up is still a tap. */
const TAP_SLOP = 8
/** One arrow-key press, in screen pixels. */
const PAN_STEP = 64

type Gesture =
  | { kind: 'pan'; start: ZoomView; from: Point; tap: boolean }
  | { kind: 'pinch'; start: ZoomView; from: [Point, Point] }

/** A pointer's position from the centre of `el`, the frame `lib/zoom` works in. */
function localPoint(el: HTMLElement, e: { clientX: number; clientY: number }): Point {
  const box = el.getBoundingClientRect()
  return { x: e.clientX - box.left - box.width / 2, y: e.clientY - box.top - box.height / 2 }
}

const control = cn(
  'focus-ring grid h-11 w-11 place-items-center rounded-full',
  'bg-surface text-ink shadow-soft ring-1 ring-line/60 hover:text-brand',
  'aria-disabled:opacity-40 aria-disabled:hover:text-ink',
)

function Viewer({
  src,
  alt,
  width,
  height,
  onClose,
}: {
  src: string
  alt: string
  width: number
  height: number
  onClose: () => void
}) {
  const { t } = useLang()
  const dialogRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [view, setView] = useState<ZoomView>(IDENTITY)
  const [fitted, setFitted] = useState<Size>({ width: 0, height: 0 })
  /** Eased for a button, a key or a double tap; never under a finger. */
  const [smooth, setSmooth] = useState(false)

  // Handlers read these rather than state: pointer and wheel events can arrive
  // several times between two renders, and each has to build on the last.
  const viewRef = useRef<ZoomView>(IDENTITY)
  const sizes = useRef({ fitted: { width: 0, height: 0 }, stage: { width: 0, height: 0 } })
  const pointers = useRef(new Map<number, Point>())
  const gesture = useRef<Gesture | null>(null)
  const lastTap = useRef<Tap | null>(null)

  const apply = useCallback((next: ZoomView, animate = false) => {
    const clamped = clampView(next, sizes.current.fitted, sizes.current.stage)
    viewRef.current = clamped
    setView(clamped)
    setSmooth(animate)
  }, [])

  // Focus moves in, the page stops scrolling underneath; both are undone on
  // the way out, focus going back to whatever opened the viewer.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = overflow
      opener?.focus()
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Re-fitted on every resize, and the view re-clamped with it: turning a
  // phone mid-zoom must not leave the map stranded off one edge.
  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const measure = () => {
      const box = { width: stage.clientWidth, height: stage.clientHeight }
      const fit = fitSize({ width, height }, box)
      sizes.current = { fitted: fit, stage: box }
      setFitted(fit)
      apply(viewRef.current)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [width, height, apply])

  // Native and non-passive on purpose: React attaches `onWheel` as passive,
  // and without preventDefault a trackpad pinch (Ctrl+wheel) would zoom the
  // whole page instead of the map.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const v = viewRef.current
      const scale = wheelScale(v.scale, event.deltaY, event.deltaMode, event.ctrlKey)
      apply(zoomAround(v, scale, localPoint(stage, event)))
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [apply])

  /** (Re)starts the gesture from whatever fingers are down now. */
  const begin = (fresh: boolean) => {
    const down = [...pointers.current.values()]
    const start = viewRef.current
    gesture.current =
      down.length >= 2
        ? { kind: 'pinch', start, from: [down[0], down[1]] }
        : down.length === 1
          ? { kind: 'pan', start, from: down[0], tap: fresh }
          : null
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const fresh = pointers.current.size === 0
    pointers.current.set(event.pointerId, localPoint(event.currentTarget, event))
    begin(fresh)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, localPoint(event.currentTarget, event))
    const g = gesture.current
    const down = [...pointers.current.values()]
    if (g?.kind === 'pinch' && down.length >= 2) {
      apply(pinch(g.start, g.from, [down[0], down[1]]))
    } else if (g?.kind === 'pan') {
      const dx = down[0].x - g.from.x
      const dy = down[0].y - g.from.y
      if (g.tap && Math.hypot(dx, dy) > TAP_SLOP) g.tap = false
      if (!g.tap) apply({ ...g.start, x: g.start.x + dx, y: g.start.y + dy })
    }
  }

  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(event.pointerId)) return
    const g = gesture.current
    if (event.type === 'pointerup' && g?.kind === 'pan' && g.tap) {
      // A mouse double click arrives here as two taps as well, so one path
      // serves both — no separate onDoubleClick to fire a second toggle.
      const tap = { time: event.timeStamp, at: localPoint(event.currentTarget, event) }
      if (isDoubleTap(lastTap.current, tap)) {
        lastTap.current = null
        apply(toggleZoom(viewRef.current, tap.at), true)
      } else {
        lastTap.current = tap
      }
    } else if (pointers.current.size === 0) {
      // A drag or a pinch in between means the next tap starts afresh.
      lastTap.current = null
    }
    // Lifting one finger of a pinch carries on as a drag with the other.
    begin(false)
  }

  const zoomBy = (factor: number) => {
    const v = viewRef.current
    apply(zoomAround(v, v.scale * factor, { x: 0, y: 0 }), true)
  }

  const panBy = (dx: number, dy: number) => {
    const v = viewRef.current
    apply({ ...v, x: v.x + dx, y: v.y + dy }, true)
  }

  /** Tab cycles through the four buttons instead of leaving for the page behind. */
  const keepFocusInside = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const dialog = dialogRef.current
    const buttons = dialog ? [...dialog.querySelectorAll('button')] : []
    if (!dialog || buttons.length === 0) return
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    const active = document.activeElement
    if (event.shiftKey && (active === first || active === dialog)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const keys: Record<string, () => void> = {
    '+': () => zoomBy(STEP_SCALE),
    '=': () => zoomBy(STEP_SCALE),
    '-': () => zoomBy(1 / STEP_SCALE),
    '0': () => apply(IDENTITY, true),
    // The arrow names the part of the map to bring into view.
    ArrowLeft: () => panBy(PAN_STEP, 0),
    ArrowRight: () => panBy(-PAN_STEP, 0),
    ArrowUp: () => panBy(0, PAN_STEP),
    ArrowDown: () => panBy(0, -PAN_STEP),
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') return keepFocusInside(event)
    const action = keys[event.key]
    if (!action || event.ctrlKey || event.metaKey || event.altKey) return
    event.preventDefault()
    action()
  }

  const atMin = view.scale <= MIN_SCALE
  const atMax = view.scale >= MAX_SCALE

  return (
    <motion.div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      // Focusable itself so that a tap on the map keeps focus inside the
      // dialog rather than dropping it to <body>, where keys stop working.
      tabIndex={-1}
      onKeyDown={onKeyDown}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: easeOut }}
      className="fixed inset-0 z-[70] flex touch-none flex-col bg-scrim/90 outline-none select-none"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* A bar of its own above the map rather than buttons floating over it,
          so at 1× no corner of the map sits under a control. */}
      <div className="flex shrink-0 items-center justify-between gap-3 px-3 py-2.5">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => zoomBy(1 / STEP_SCALE)}
            aria-label={t(s.zoom.zoomOut)}
            title={t(s.zoom.zoomOut)}
            aria-disabled={atMin}
            className={control}
          >
            <Minus className="h-5 w-5" strokeWidth={2.2} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => apply(IDENTITY, true)}
            aria-label={t(s.zoom.reset)}
            title={t(s.zoom.reset)}
            aria-disabled={atMin}
            className={control}
          >
            <RotateCcw className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => zoomBy(STEP_SCALE)}
            aria-label={t(s.zoom.zoomIn)}
            title={t(s.zoom.zoomIn)}
            aria-disabled={atMax}
            className={control}
          >
            <Plus className="h-5 w-5" strokeWidth={2.2} aria-hidden />
          </button>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={t(s.common.close)}
          title={t(s.common.close)}
          className={control}
        >
          <X className="h-5 w-5" strokeWidth={2.2} aria-hidden />
        </button>
      </div>

      <div
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        className={cn(
          'relative grid min-h-0 flex-1 place-items-center overflow-hidden',
          atMin ? 'cursor-zoom-in' : 'cursor-grab active:cursor-grabbing',
        )}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className={cn(
            'pointer-events-none max-w-none',
            // The global reduced-motion rule in index.css cuts this to nothing.
            smooth && 'transition-transform duration-200 ease-out',
          )}
          style={{
            width: fitted.width,
            height: fitted.height,
            transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
          }}
        />
      </div>
    </motion.div>
  )
}
