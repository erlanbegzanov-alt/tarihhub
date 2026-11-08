import { useSyncExternalStore } from 'react'

/**
 * What the rest of the app has to know about the ҰБТ mock while it is being
 * sat. It lives outside `ExamMock.tsx` so that the shell and `main.tsx` can
 * read it without pulling the exam's chunk into the entry.
 *
 * - `running`: an attempt is open. The shell's links ask before leaving it
 *   (the dialog is the exam screen's own), and the tab asks before closing.
 * - `reviewing`: the attempt is over and recorded, and its result is on
 *   screen. Leaving needs no question, but the answer review exists only in
 *   memory, so a reload would still throw it away.
 * - `idle`: nothing on screen would be lost by a reload.
 */
export type ExamActivity = 'idle' | 'running' | 'reviewing'

let activity: ExamActivity = 'idle'
/** A navigation asked for mid-attempt, held until the leave dialog answers. */
let heldLeave: (() => void) | null = null
let onIdle: (() => void)[] = []
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setExamActivity(next: ExamActivity): void {
  activity = next
  // A held navigation belongs to the attempt that was running: once the clock
  // has closed it, the dialog has nothing left to ask.
  if (next !== 'running') heldLeave = null
  emit()
  if (next !== 'idle' || onIdle.length === 0) return
  // A microtask later, not now. Moving between phases, the exam screen's
  // effect cleanup reports `idle` and the next effect reports the new phase in
  // the same commit — and StrictMode's double mount does the same. Only an
  // `idle` still standing once that has settled is real.
  queueMicrotask(() => {
    if (activity !== 'idle') return
    const run = onIdle
    onIdle = []
    run.forEach((fn) => fn())
  })
}

export function examActivity(): ExamActivity {
  return activity
}

/** Runs `fn` now, or once the exam screen holds nothing a reload could lose. */
export function whenExamIdle(fn: () => void): void {
  if (activity === 'idle') fn()
  else onIdle.push(fn)
}

/**
 * Leaves for somewhere else in the app: at once when no attempt is running,
 * otherwise held for the exam screen's leave dialog (`answerLeave`).
 */
export function requestLeave(go: () => void): void {
  if (activity !== 'running') {
    go()
    return
  }
  heldLeave = go
  emit()
}

/** The dialog's answer: follow the held navigation, or drop it and stay. */
export function answerLeave(leave: boolean): void {
  const go = heldLeave
  heldLeave = null
  emit()
  if (leave) go?.()
}

/** True while a navigation is waiting on the leave dialog. */
export function useLeaveRequested(): boolean {
  return useSyncExternalStore(subscribe, () => heldLeave !== null, () => false)
}
