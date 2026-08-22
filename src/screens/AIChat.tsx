import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Send, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PortraitPanel } from '../components/PortraitPanel'
import { EraBadge, IconButton } from '../components/ui'
import { getPerson, people } from '../data/people'
import type { Person } from '../data/types'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { askPersona } from '../lib/ai'
import type { ChatTurn } from '../lib/ai'
import { cn } from '../lib/cn'
import { easeOut, springSoft, staggerContainer, staggerItem } from '../lib/motion'
import { unlockBadge } from '../lib/progress'

interface Message extends ChatTurn {
  id: string
}

/* ------------------------- persona picker ------------------------- */

function PersonaPicker({ onPick }: { onPick: (person: Person) => void }) {
  const { t } = useLang()

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <motion.div variants={staggerItem}>
        <h1 className="text-2xl font-bold tracking-tight text-ink md:text-[28px]">
          {t(s.ai.title)}
        </h1>
        <p className="mt-1.5 text-[14.5px] text-ink-soft">{t(s.ai.subtitle)}</p>
      </motion.div>

      <motion.h2
        variants={staggerItem}
        className="mt-7 mb-3 text-[17px] font-semibold text-ink"
      >
        {t(s.ai.choosePersona)}
      </motion.h2>

      <motion.ul
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3"
      >
        {people.map((person) => (
          <motion.li key={person.id} variants={staggerItem} className="min-w-0">
            <motion.button
              type="button"
              onClick={() => onPick(person)}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              transition={springSoft}
              className={cn(
                'focus-ring flex w-full items-center gap-3.5 rounded-card bg-surface p-3.5 text-left',
                'shadow-soft ring-1 ring-line/60 transition-shadow duration-300 hover:shadow-lift',
              )}
            >
              <PortraitPanel
                initial={person.initial}
                eraKey={person.eraKey}
                motif={person.motif}
                portrait={person.portrait}
                name={t(person.name)}
                size="sm"
                className="h-14 w-14 shrink-0 rounded-tile"
              />
              <span className="min-w-0 flex-1">
                <EraBadge eraKey={person.eraKey}>{t(person.eraBadge)}</EraBadge>
                <span className="mt-1.5 block truncate text-[15px] font-semibold text-ink">
                  {t(person.name)}
                </span>
                <span className="block truncate text-[13px] text-brand">
                  {t(person.role)}
                </span>
              </span>
              <Sparkles className="h-[18px] w-[18px] shrink-0 text-ink-faint" strokeWidth={2} />
            </motion.button>
          </motion.li>
        ))}
      </motion.ul>
    </motion.div>
  )
}

/* ------------------------------ screen ---------------------------- */

export function AIChat() {
  const { personId } = useParams()
  const navigate = useNavigate()
  const { t, lang } = useLang()
  // Debug-only escape hatch (?noanim=1) to test whether the "typing" dots'
  // looping bounce is behind a reported-but-unreproduced mobile jitter,
  // without changing anything for regular visitors.
  const [searchParams] = useSearchParams()
  const noDecorAnim = searchParams.get('noanim') === '1'

  const person = getPerson(personId)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  // Neutral until the first reply actually lands — never claims a live
  // connection before one has really happened.
  const [liveMode, setLiveMode] = useState(false)

  const bottomRef = useRef<HTMLDivElement | null>(null)
  const counter = useRef(0)

  // Reset the transcript whenever the persona or language changes.
  useEffect(() => {
    setMessages([])
    setInput('')
    setThinking(false)
  }, [personId, lang])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, thinking])

  const history = useMemo<ChatTurn[]>(
    () => messages.map(({ role, content }) => ({ role, content })),
    [messages],
  )

  if (!person) {
    return <PersonaPicker onPick={(picked) => navigate(`/ai/${picked.id}`)} />
  }

  const send = async (raw: string) => {
    const text = raw.trim()
    if (!text || thinking) return

    counter.current += 1
    const userMessage: Message = {
      id: `u${counter.current}`,
      role: 'user',
      content: text,
    }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setThinking(true)

    const answer = await askPersona(person, history, text, lang)

    counter.current += 1
    setMessages((prev) => [
      ...prev,
      { id: `a${counter.current}`, role: 'assistant', content: answer.text },
    ])
    setThinking(false)
    // A stored key that fails (invalid, expired, offline) silently falls back to
    // scripted answers — reflect that in the badge instead of still claiming
    // Gemini is connected.
    setLiveMode(answer.engine === 'live')

    if (person.id === 'abylai') unlockBadge('diplomat')
  }

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] flex-col md:h-[calc(100dvh-6rem)]">
      {/* ---------- header ---------- */}
      <div className="flex items-center gap-3 pb-4">
        <IconButton label={t(s.ai.changePersona)} onClick={() => navigate('/ai')}>
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </IconButton>

        <button
          type="button"
          onClick={() => navigate(`/person/${person.id}`)}
          aria-label={t(person.name)}
          className="focus-ring shrink-0 rounded-full"
        >
          <PortraitPanel
            initial={person.initial}
            eraKey={person.eraKey}
            motif={person.motif}
            portrait={person.portrait}
            name={t(person.name)}
            size="sm"
            className="h-11 w-11 rounded-full"
          />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[16px] font-semibold text-ink">
            {t(person.name)}
          </h1>
          <p className="truncate text-[12.5px] text-ink-faint">
            {t(person.role)} ·{' '}
            <span className={liveMode ? 'text-brand' : undefined}>
              {liveMode ? t(s.ai.liveMode) : t(s.ai.offlineMode)}
            </span>
          </p>
        </div>
      </div>

      {/* ---------- transcript ---------- */}
      <div
        className={cn(
          'min-h-0 flex-1 overflow-y-auto rounded-card bg-surface p-4 shadow-soft ring-1 ring-line/60',
          'sm:p-5',
        )}
      >
        {messages.length === 0 && !thinking && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: easeOut }}
            className="mx-auto max-w-md py-8 text-center"
          >
            <button
              type="button"
              onClick={() => navigate(`/person/${person.id}`)}
              aria-label={t(person.name)}
              className="focus-ring mx-auto block rounded-tile"
            >
              <PortraitPanel
                initial={person.initial}
                eraKey={person.eraKey}
                motif={person.motif}
                portrait={person.portrait}
                name={t(person.name)}
                className="h-24 w-20 rounded-tile"
              />
            </button>
            <h2 className="mt-4 text-[17px] font-semibold text-ink">
              {t(person.name)}
            </h2>
            <p className="mt-1 text-[13.5px] text-ink-soft">{t(person.tagline)}</p>
            <p className="mt-4 text-[13.5px] leading-relaxed text-ink-faint">
              {t(s.ai.intro)}
            </p>
          </motion.div>
        )}

        <ul className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.li
                key={message.id}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={springSoft}
                className={cn(
                  'flex',
                  message.role === 'user' ? 'justify-end' : 'justify-start',
                )}
              >
                <div
                  className={cn(
                    'max-w-[86%] sm:max-w-[70%] lg:max-w-[62%]',
                    message.role === 'user'
                      ? 'rounded-t-2xl rounded-bl-2xl bg-brand px-4 py-3 text-white'
                      : 'rounded-t-2xl rounded-br-2xl bg-cream px-4 py-3 text-ink',
                  )}
                >
                  {message.role === 'assistant' && (
                    <p className="mb-1 text-[11.5px] font-bold text-brand">
                      {t(person.name)}
                    </p>
                  )}
                  <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap">
                    {message.content}
                  </p>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>

          {thinking && (
            <motion.li
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="rounded-t-2xl rounded-br-2xl bg-cream px-4 py-3.5">
                <span className="sr-only">{t(s.ai.typing)}</span>
                <span className="flex items-center gap-1.5" aria-hidden>
                  {[0, 1, 2].map((dot) => (
                    <motion.span
                      key={dot}
                      className="h-2 w-2 rounded-full bg-ink-faint"
                      animate={
                        noDecorAnim
                          ? { opacity: 0.6 }
                          : { opacity: [0.3, 1, 0.3], y: [0, -3, 0] }
                      }
                      transition={
                        noDecorAnim
                          ? undefined
                          : {
                              duration: 1,
                              repeat: Infinity,
                              delay: dot * 0.16,
                              ease: 'easeInOut',
                            }
                      }
                    />
                  ))}
                </span>
              </div>
            </motion.li>
          )}
        </ul>
        <div ref={bottomRef} />
      </div>

      {/* ---------- suggestions + composer ---------- */}
      <div className="pt-3">
        <div className="rail-scroll -mx-4 flex gap-2 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 md:mx-0 md:flex-wrap md:px-0">
          {s.ai.suggestions.map((suggestion) => (
            <motion.button
              key={suggestion.kz}
              type="button"
              onClick={() => void send(t(suggestion))}
              disabled={thinking}
              whileTap={{ scale: 0.96 }}
              transition={springSoft}
              className={cn(
                'focus-ring shrink-0 rounded-full bg-surface px-3.5 py-2 text-[13px] font-medium',
                'text-ink-soft ring-1 ring-line/70 shadow-soft',
                'transition-colors hover:text-brand disabled:opacity-50',
              )}
            >
              {t(suggestion)}
            </motion.button>
          ))}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            void send(input)
          }}
          className={cn(
            'flex items-center gap-2 rounded-full bg-surface p-2 pl-4',
            'shadow-soft ring-1 ring-line/70 focus-within:ring-2 focus-within:ring-brand/60',
          )}
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={t(s.ai.inputPlaceholder)}
            aria-label={t(s.ai.inputPlaceholder)}
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-faint"
          />
          <motion.button
            type="submit"
            disabled={!input.trim() || thinking}
            whileTap={{ scale: 0.92 }}
            transition={springSoft}
            aria-label={t(s.ai.send)}
            className={cn(
              'focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-full',
              'bg-brand text-white transition-opacity hover:bg-brand-dark',
              'disabled:opacity-40',
            )}
          >
            <Send className="h-[17px] w-[17px]" strokeWidth={2.2} />
          </motion.button>
        </form>
      </div>
    </div>
  )
}
