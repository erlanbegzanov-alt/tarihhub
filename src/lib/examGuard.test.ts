/**
 * The signal the shell and `main.tsx` read while a mock is being sat. The
 * case that matters is the deferred reload: it must wait out both the attempt
 * and its result screen, and must not fire on the brief `idle` the exam
 * screen reports between two phases.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { answerLeave, examActivity, requestLeave, setExamActivity, whenExamIdle } from './examGuard'

const settle = () => new Promise<void>((resolve) => queueMicrotask(resolve))

afterEach(async () => {
  setExamActivity('idle')
  await settle()
})

describe('whenExamIdle', () => {
  it('runs at once when nothing is being sat', () => {
    const fn = vi.fn()
    whenExamIdle(fn)
    expect(fn).toHaveBeenCalledOnce()
  })

  it('waits out the attempt and its result screen, then runs once', async () => {
    const fn = vi.fn()
    setExamActivity('running')
    whenExamIdle(fn)
    setExamActivity('reviewing')
    await settle()
    expect(fn).not.toHaveBeenCalled()
    setExamActivity('idle')
    await settle()
    expect(fn).toHaveBeenCalledOnce()
    setExamActivity('running')
    setExamActivity('idle')
    await settle()
    expect(fn).toHaveBeenCalledOnce()
  })

  it('ignores the idle an effect cleanup reports between two phases', async () => {
    const fn = vi.fn()
    setExamActivity('running')
    whenExamIdle(fn)
    setExamActivity('idle') // cleanup of the `running` effect…
    setExamActivity('reviewing') // …and the `result` effect, same commit
    await settle()
    expect(fn).not.toHaveBeenCalled()
  })
})

describe('requestLeave', () => {
  it('goes straight away when no attempt is running', () => {
    const go = vi.fn()
    setExamActivity('reviewing')
    requestLeave(go)
    expect(go).toHaveBeenCalledOnce()
  })

  it('holds the navigation for the dialog, then follows or drops it', () => {
    const go = vi.fn()
    setExamActivity('running')
    requestLeave(go)
    expect(go).not.toHaveBeenCalled()
    answerLeave(false)
    answerLeave(true)
    expect(go).not.toHaveBeenCalled()
    requestLeave(go)
    answerLeave(true)
    expect(go).toHaveBeenCalledOnce()
  })

  it('drops a held navigation once the attempt is closed by the clock', () => {
    const go = vi.fn()
    setExamActivity('running')
    requestLeave(go)
    setExamActivity('reviewing')
    answerLeave(true)
    expect(go).not.toHaveBeenCalled()
    expect(examActivity()).toBe('reviewing')
  })
})
