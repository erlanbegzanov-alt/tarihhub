/**
 * Writing a Кахут game (`/battle/kahoot/create`, `/battle/kahoot/edit/:gameId`).
 *
 * The whole form is local state until the teacher presses save or publish —
 * with one exception. A photo is uploaded the moment it is picked, because
 * Firebase Storage needs a real file upload and the form has nowhere to keep a
 * `File` between sessions; that is why the game gets its id (`newGameId`)
 * before it is ever written, so the photo has a path to live under.
 */
import { motion } from 'framer-motion'
import { Check, ImagePlus, Loader2, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { KahootHeader } from '../components/kahoot'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import type { LocalizedText } from '../data/types'
import { cn } from '../lib/cn'
import { isFirebaseReady } from '../lib/firebase'
import {
  MAX_PHOTO_BYTES,
  emptyQuestion,
  fetchGame,
  findFlaw,
  newGameId,
  saveGame,
  uploadQuestionPhoto,
} from '../lib/kahoot'
import type { KahootFlaw, KahootQuestion } from '../lib/kahoot'
import { springSoft, staggerContainer, staggerItem } from '../lib/motion'
import { useSession } from '../lib/session'

const FLAW_TEXT: Record<KahootFlaw['reason'], LocalizedText> = {
  title: s.kahoot.flawTitle,
  noQuestions: s.kahoot.flawNoQuestions,
  text: s.kahoot.flawText,
  options: s.kahoot.flawOptions,
  correct: s.kahoot.flawCorrect,
}

const FIELD =
  'w-full rounded-tile bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none ring-[1.5px] ring-line placeholder:text-ink-faint focus:ring-brand'

/* ------------------------------------------------------------------ */

export function KahootCreate() {
  const { t } = useLang()
  const navigate = useNavigate()
  const { gameId: editId } = useParams<{ gameId: string }>()
  const session = useSession()
  const uid = session.user?.uid ?? null

  // A new game's id is fixed for the life of this screen: photos upload under
  // it, so it can't be regenerated on a re-render. Minted lazily — passing the
  // call straight to `useRef` would build a throwaway document reference on
  // every single render.
  const draftId = useRef<string | null>(null)
  if (draftId.current === null) draftId.current = newGameId()
  const gameId = editId ?? draftId.current

  const [title, setTitle] = useState('')
  const [questions, setQuestions] = useState<KahootQuestion[]>([emptyQuestion()])
  const [createdAt, setCreatedAt] = useState(() => Date.now())
  const [loading, setLoading] = useState(Boolean(editId))
  const [uploading, setUploading] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [flaw, setFlaw] = useState<KahootFlaw | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editId) return
    let alive = true
    void fetchGame(editId).then((game) => {
      if (!alive) return
      if (game) {
        setTitle(game.title)
        setQuestions(game.questions.length > 0 ? game.questions : [emptyQuestion()])
        setCreatedAt(game.createdAt)
      }
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [editId])

  const patch = (index: number, change: Partial<KahootQuestion>) => {
    setQuestions((prev) =>
      prev.map((question, i) => (i === index ? { ...question, ...change } : question)),
    )
    setFlaw(null)
  }

  const setOption = (index: number, optionIndex: number, value: string) => {
    setQuestions((prev) =>
      prev.map((question, i) =>
        i === index
          ? {
              ...question,
              options: question.options.map((option, oi) =>
                oi === optionIndex ? value : option,
              ),
            }
          : question,
      ),
    )
    setFlaw(null)
  }

  const pickPhoto = async (index: number, file: File | undefined) => {
    if (!file || !uid) return
    const question = questions[index]
    setPhotoError(null)
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError(t(s.kahoot.photoTooBig))
      return
    }
    setUploading(question.id)
    const url = await uploadQuestionPhoto(file)
    setUploading(null)
    if (!url) {
      setPhotoError(t(s.kahoot.photoFailed))
      return
    }
    patch(index, { photoURL: url })
  }

  /** Saves the game, or reports the first thing standing in the way. */
  const save = async (): Promise<boolean> => {
    if (!uid) return false
    const found = findFlaw(title, questions)
    if (found) {
      setFlaw(found)
      return false
    }
    setSaving(true)
    setSaveError(null)
    const ok = await saveGame({ id: gameId, hostUid: uid, title, questions, createdAt })
    setSaving(false)
    if (!ok) setSaveError(t(s.kahoot.saveFailed))
    return ok
  }

  const flawMessage = useMemo(() => {
    if (!flaw) return null
    const reason = t(FLAW_TEXT[flaw.reason])
    return flaw.index < 0
      ? reason
      : `${t(s.battle.question)} ${flaw.index + 1}: ${reason}`
  }, [flaw, t])

  const ready = isFirebaseReady && Boolean(uid)

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="mx-auto max-w-2xl lg:max-w-3xl"
    >
      <KahootHeader
        icon={<Plus className="h-5 w-5" strokeWidth={2.2} />}
        title={t(editId ? s.kahoot.editTitle : s.kahoot.createTitle)}
        subtitle={t(s.kahoot.subtitle)}
        onBack={() => navigate('/battle/kahoot')}
      />

      {!ready ? (
        <motion.p
          variants={staggerItem}
          className="mt-5 rounded-card bg-surface p-5 text-center text-[13.5px] leading-relaxed text-ink-faint shadow-soft ring-1 ring-line/60"
        >
          {t(s.battle.unavailable)}
        </motion.p>
      ) : loading ? (
        <div className="py-16 text-center">
          <Loader2
            className="mx-auto h-9 w-9 animate-spin text-brand"
            strokeWidth={2}
            aria-hidden
          />
        </div>
      ) : (
        <>
          {/* ----------------------------- title ----------------------------- */}

          <motion.div variants={staggerItem} className="mt-5">
            <label
              htmlFor="kahoot-title"
              className="mb-1.5 block text-[11.5px] font-bold tracking-wide text-ink-faint"
            >
              {t(s.kahoot.gameTitleLabel)}
            </label>
            <input
              id="kahoot-title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value)
                setFlaw(null)
              }}
              placeholder={t(s.kahoot.gameTitlePlaceholder)}
              className={cn(FIELD, 'font-bold shadow-soft')}
            />
          </motion.div>

          {/* --------------------------- questions --------------------------- */}

          <motion.p
            variants={staggerItem}
            className="mt-5 mb-2 text-[11.5px] font-bold tracking-wide text-ink-faint"
          >
            {t(s.kahoot.questionsLabel)}
          </motion.p>

          <motion.ul variants={staggerItem} className="grid gap-3">
            {questions.map((question, index) => (
              <li
                key={question.id}
                className="rounded-card bg-surface p-4 shadow-soft ring-1 ring-line/60"
              >
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-[12px] font-bold text-ink-faint">
                    {t(s.battle.question)} {index + 1}
                  </span>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      aria-label={t(s.kahoot.removeQuestion)}
                      onClick={() =>
                        setQuestions((prev) => prev.filter((_, i) => i !== index))
                      }
                      className="focus-ring grid h-8 w-8 place-items-center rounded-full text-ink-faint hover:text-wrong"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={2} />
                    </button>
                  )}
                </div>

                <div className="flex items-start gap-3">
                  {/* photo square — dashed while empty, the picture itself once
                      one is attached */}
                  <div className="relative shrink-0">
                    {question.photoURL ? (
                      <>
                        <img
                          src={question.photoURL}
                          alt=""
                          className="h-[60px] w-[60px] rounded-tile object-cover ring-1 ring-line"
                        />
                        <button
                          type="button"
                          aria-label={t(s.kahoot.photoRemove)}
                          onClick={() => patch(index, { photoURL: null })}
                          className="focus-ring absolute -top-1.5 -right-1.5 grid h-6 w-6 place-items-center rounded-full bg-surface text-ink-soft shadow-soft ring-1 ring-line hover:text-wrong"
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={2.4} />
                        </button>
                      </>
                    ) : (
                      <label
                        className={cn(
                          'grid h-[60px] w-[60px] cursor-pointer place-items-center gap-0.5',
                          'rounded-tile border-[1.5px] border-dashed border-line bg-cream',
                          'text-[10px] font-bold text-ink-faint',
                          'transition-colors hover:border-brand hover:text-brand',
                        )}
                      >
                        {uploading === question.id ? (
                          <Loader2
                            className="h-4 w-4 animate-spin text-brand"
                            strokeWidth={2.4}
                            aria-hidden
                          />
                        ) : (
                          <ImagePlus className="h-4 w-4" strokeWidth={2} aria-hidden />
                        )}
                        <span>{t(s.kahoot.photoAdd)}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(event) => {
                            void pickPhoto(index, event.target.files?.[0])
                            event.target.value = ''
                          }}
                        />
                      </label>
                    )}
                  </div>

                  <textarea
                    value={question.text}
                    onChange={(event) => patch(index, { text: event.target.value })}
                    placeholder={t(s.kahoot.questionPlaceholder)}
                    rows={2}
                    className={cn(FIELD, 'flex-1 resize-none bg-cream font-semibold')}
                  />
                </div>

                <ul className="mt-2.5 grid gap-2">
                  {question.options.map((option, optionIndex) => {
                    const correct = question.correctIndex === optionIndex
                    return (
                      <li key={optionIndex} className="flex items-center gap-2">
                        <button
                          type="button"
                          role="radio"
                          aria-checked={correct}
                          aria-label={t(s.kahoot.markCorrect)}
                          onClick={() => patch(index, { correctIndex: optionIndex })}
                          className={cn(
                            'focus-ring grid h-7 w-7 shrink-0 place-items-center rounded-full',
                            'ring-[1.5px] transition-colors duration-200',
                            correct
                              ? 'bg-brand text-white ring-brand'
                              : 'bg-surface text-transparent ring-line hover:ring-brand/50',
                          )}
                        >
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </button>
                        <input
                          value={option}
                          onChange={(event) =>
                            setOption(index, optionIndex, event.target.value)
                          }
                          placeholder={`${t(s.kahoot.optionLabel)} ${optionIndex + 1}`}
                          className={cn(
                            FIELD,
                            'bg-cream',
                            correct && 'bg-brand-tint ring-brand/50',
                          )}
                        />
                      </li>
                    )
                  })}
                </ul>

                <p className="mt-2 text-[11.5px] text-ink-faint">
                  {t(s.kahoot.correctHint)}
                </p>
              </li>
            ))}
          </motion.ul>

          <motion.button
            variants={staggerItem}
            type="button"
            onClick={() => setQuestions((prev) => [...prev, emptyQuestion()])}
            whileTap={{ scale: 0.99 }}
            transition={springSoft}
            className={cn(
              'focus-ring mt-3 flex w-full items-center justify-center gap-2',
              'rounded-card border-[1.5px] border-dashed border-line px-4 py-3.5',
              'text-[14px] font-bold text-ink-soft',
              'transition-colors hover:border-brand hover:text-brand',
            )}
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />
            {t(s.kahoot.addQuestion)}
          </motion.button>

          {/* ----------------------------- actions ----------------------------- */}

          {(photoError || flawMessage || saveError) && (
            <p className="mt-4 rounded-tile bg-wrong-tint px-4 py-3 text-center text-[13px] font-semibold text-wrong">
              {photoError ?? flawMessage ?? saveError}
            </p>
          )}

          <motion.div variants={staggerItem} className="mt-4 mb-2 flex gap-2.5">
            <button
              type="button"
              onClick={() => {
                void save().then((ok) => {
                  if (ok) navigate('/battle/kahoot')
                })
              }}
              disabled={saving}
              className="focus-ring rounded-full bg-surface px-5 py-3.5 text-[14.5px] font-semibold text-ink-soft ring-1 ring-line hover:text-ink"
            >
              {t(s.common.save)}
            </button>
            <motion.button
              type="button"
              onClick={() => {
                void save().then((ok) => {
                  if (ok) navigate(`/battle/kahoot/host/${gameId}`)
                })
              }}
              disabled={saving}
              whileHover={saving ? undefined : { y: -2 }}
              whileTap={saving ? undefined : { scale: 0.99 }}
              transition={springSoft}
              className={cn(
                'focus-ring flex flex-1 items-center justify-center gap-2 rounded-full',
                'px-6 py-3.5 text-[15px] font-semibold text-white shadow-soft',
                saving ? 'cursor-default bg-ink-faint' : 'bg-brand hover:bg-brand-dark',
              )}
            >
              {saving && (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.4} aria-hidden />
              )}
              {t(s.kahoot.publish)}
            </motion.button>
          </motion.div>
        </>
      )}
    </motion.div>
  )
}
