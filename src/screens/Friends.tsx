/**
 * Друзья (`/battle/friends`).
 *
 * Top to bottom in the order a first visit needs it: your own code (the thing
 * to hand a friend), a box to type theirs, then whatever is waiting on you,
 * then the friends themselves. Adding is by code only — see `lib/friends.ts`
 * for why there is no search by name.
 *
 * Only reachable while `FEATURE_TEAM_BATTLE` is on (the test site), until team
 * battle ships and friends become the way a team is gathered.
 */
import { Check, Copy, UserPlus, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyPanel, MatchList, relativeTime } from '../components/battle'
import { KahootHeader, PlayerAvatar } from '../components/kahoot'
import { SectionHeading } from '../components/ui'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { fetchBattlePlayer, syncBattlePlayer } from '../lib/battle'
import type { BattlePlayer, BattlePlayerMeta } from '../lib/battle'
import { cn } from '../lib/cn'
import {
  ONLINE_WINDOW_MS,
  acceptFriendRequest,
  addFriendByCode,
  ensureMyFriendCode,
  formatFriendCode,
  removeFriendship,
  watchFriendships,
} from '../lib/friends'
import type { AddFriendResult, Friendship } from '../lib/friends'
import { staggerContainer, staggerItem } from '../lib/motion'
import { levelInfo, useProfile } from '../lib/progress'
import { resolveRankIdentity } from '../lib/rankIdentity'
import { OWNER_EMAIL } from '../lib/rankStyle'
import { useSession } from '../lib/session'

const RESULT_TEXT: Record<AddFriendResult, typeof s.friends.resultSent> = {
  sent: s.friends.resultSent,
  accepted: s.friends.resultAccepted,
  already: s.friends.resultAlready,
  pending: s.friends.resultPending,
  self: s.friends.resultSelf,
  notFound: s.friends.resultNotFound,
  invalid: s.friends.resultInvalid,
  error: s.friends.resultError,
}

/** Results that mean it worked, painted green; everything else is a problem to fix. */
const GOOD_RESULTS = new Set<AddFriendResult>(['sent', 'accepted'])

/** Small pill button used for every row action, so rows line up. */
function RowButton({
  children,
  onClick,
  tone = 'plain',
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  tone?: 'brand' | 'plain' | 'danger'
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'focus-ring shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors disabled:opacity-50',
        tone === 'brand' && 'bg-brand text-white hover:bg-brand-dark',
        tone === 'plain' && 'bg-cream text-ink-soft ring-1 ring-line/70 hover:text-ink',
        tone === 'danger' && 'bg-wrong text-white',
      )}
    >
      {children}
    </button>
  )
}

/** One person in any of the three lists. */
function PersonRow({
  player,
  subtitle,
  online = false,
  children,
}: {
  player: BattlePlayer | null | undefined
  subtitle: string
  online?: boolean
  children?: ReactNode
}) {
  const name = player?.displayName || '…'
  return (
    <li className="flex items-center gap-3 border-b border-line-soft px-4 py-3 last:border-b-0">
      <span className="relative shrink-0">
        <PlayerAvatar
          name={name}
          photoURL={player?.photoURL ?? ''}
          size={40}
          avatarGender={player?.avatarGender ?? null}
          avatarTierIndex={player?.avatarTierIndex ?? 0}
        />
        {online && (
          <span
            className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-correct ring-2 ring-surface"
            aria-hidden
          />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-semibold text-ink">{name}</span>
        <span className="block truncate text-[12px] text-ink-faint tabular-nums">{subtitle}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">{children}</span>
    </li>
  )
}

export function Friends() {
  const { t } = useLang()
  const navigate = useNavigate()
  const profile = useProfile()
  const user = useSession().user
  const uid = user?.uid ?? null

  /* ------------------------- publish my own mirror ------------------------- */

  // Friends see the reader's name, avatar and "в сети" from the same public
  // mirror a duel opponent sees, so opening this screen refreshes it.
  const meta = useMemo<BattlePlayerMeta>(() => {
    const identity = resolveRankIdentity({
      xp: profile.xp,
      avatarGender: profile.avatarGender,
      displayedAvatarTier: profile.displayedAvatarTier,
      displayedRankTier: profile.displayedRankTier,
      isOwner: user?.email === OWNER_EMAIL,
    })
    return {
      displayName: user?.displayName ?? '',
      photoURL: user?.photoURL ?? '',
      level: levelInfo(profile.xp).level,
      avatarGender: identity.avatarGender,
      avatarTierIndex: identity.avatarTierIndex,
      titleTierIndex: identity.titleTierIndex,
    }
  }, [
    profile.xp,
    profile.avatarGender,
    profile.displayedAvatarTier,
    profile.displayedRankTier,
    user?.displayName,
    user?.photoURL,
    user?.email,
  ])

  useEffect(() => {
    if (!uid) return
    void syncBattlePlayer(uid, meta)
  }, [uid, meta])

  /* -------------------------------- my code -------------------------------- */

  const [code, setCode] = useState<string | null>(null)
  const [codeFailed, setCodeFailed] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!uid) return
    let alive = true
    void ensureMyFriendCode(uid).then((next) => {
      if (!alive) return
      if (next) setCode(next)
      else setCodeFailed(true)
    })
    return () => {
      alive = false
    }
  }, [uid])

  const copyCode = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(formatFriendCode(code))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — the code is on screen to copy by hand */
    }
  }

  /* ------------------------------ friendships ------------------------------ */

  const [friendships, setFriendships] = useState<Friendship[] | null>(null)
  const [listFailed, setListFailed] = useState(false)

  useEffect(() => {
    if (!uid) return
    return watchFriendships(uid, setFriendships, () => setListFailed(true))
  }, [uid])

  // Names and avatars come from each person's public mirror, fetched once each.
  const [players, setPlayers] = useState<Record<string, BattlePlayer | null>>({})
  useEffect(() => {
    if (!friendships) return
    const missing = friendships
      .map((entry) => entry.otherUid)
      .filter((other) => !(other in players))
    if (missing.length === 0) return
    let alive = true
    void Promise.all(missing.map((other) => fetchBattlePlayer(other))).then((found) => {
      if (!alive) return
      setPlayers((prev) => {
        const next = { ...prev }
        missing.forEach((other, index) => {
          next[other] = found[index]
        })
        return next
      })
    })
    return () => {
      alive = false
    }
  }, [friendships, players])

  const incoming = friendships?.filter((entry) => entry.status === 'pending' && !entry.sentByMe) ?? []
  const outgoing = friendships?.filter((entry) => entry.status === 'pending' && entry.sentByMe) ?? []
  const friends = friendships?.filter((entry) => entry.status === 'accepted') ?? []

  /* --------------------------------- adding -------------------------------- */

  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<AddFriendResult | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!uid || busy) return
    setBusy(true)
    const outcome = await addFriendByCode(uid, draft)
    setResult(outcome)
    if (GOOD_RESULTS.has(outcome)) setDraft('')
    setBusy(false)
  }

  /* --------------------------------- actions ------------------------------- */

  const [working, setWorking] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  const run = async (id: string, action: () => Promise<boolean>) => {
    setWorking(id)
    await action()
    setWorking(null)
    setConfirming(null)
  }

  const statusLine = (player: BattlePlayer | null | undefined): { text: string; online: boolean } => {
    const level = player ? `${t(s.battle.levelShort)} ${player.level}` : ''
    if (!player?.updatedAt) return { text: level, online: false }
    const online = Date.now() - player.updatedAt < ONLINE_WINDOW_MS
    const seen = online
      ? t(s.friends.online)
      : `${t(s.friends.lastSeen)} ${relativeTime(player.updatedAt, t)}`
    return { text: level ? `${level} · ${seen}` : seen, online }
  }

  /* --------------------------------- render -------------------------------- */

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="mx-auto max-w-2xl lg:max-w-3xl"
    >
      <KahootHeader
        icon={<UserPlus className="h-5 w-5" strokeWidth={2} />}
        title={t(s.friends.title)}
        subtitle={t(s.friends.subtitle)}
        onBack={() => navigate('/battle')}
      />

      {!uid ? (
        <motion.div variants={staggerItem} className="mt-5">
          <EmptyPanel>{t(s.friends.signInNeeded)}</EmptyPanel>
        </motion.div>
      ) : (
        <>
          {/* My code — the one thing to hand a friend. */}
          <motion.section
            variants={staggerItem}
            className="mt-5 rounded-card bg-surface p-5 shadow-soft ring-1 ring-line/60"
          >
            <p className="text-[12px] font-semibold tracking-wide text-ink-faint uppercase">
              {t(s.friends.myCodeLabel)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  'font-mono text-[28px] leading-none font-bold tracking-[0.12em] tabular-nums',
                  code ? 'text-ink' : 'text-ink-faint',
                )}
              >
                {code ? formatFriendCode(code) : codeFailed ? '—' : '····-····'}
              </span>
              {code && (
                <button
                  type="button"
                  onClick={copyCode}
                  className="focus-ring ml-auto inline-flex items-center gap-1.5 rounded-full bg-brand-tint px-3.5 py-2 text-[13px] font-semibold text-brand"
                >
                  {copied ? (
                    <Check className="h-4 w-4" strokeWidth={2.4} />
                  ) : (
                    <Copy className="h-4 w-4" strokeWidth={2} />
                  )}
                  {t(copied ? s.friends.copied : s.friends.copy)}
                </button>
              )}
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-ink-soft">
              {codeFailed
                ? t(s.friends.codeFailed)
                : code
                  ? t(s.friends.myCodeHint)
                  : t(s.friends.codeLoading)}
            </p>
          </motion.section>

          {/* Add by code. */}
          <motion.form
            variants={staggerItem}
            onSubmit={submit}
            className="mt-4 rounded-card bg-surface p-5 shadow-soft ring-1 ring-line/60"
          >
            <label htmlFor="friend-code" className="text-[15px] font-bold text-ink">
              {t(s.friends.addTitle)}
            </label>
            <div className="mt-3 flex gap-2">
              <input
                id="friend-code"
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value)
                  setResult(null)
                }}
                placeholder={t(s.friends.addPlaceholder)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={12}
                className="focus-ring min-w-0 flex-1 rounded-tile bg-cream px-4 py-2.5 font-mono text-[16px] tracking-[0.08em] text-ink uppercase ring-1 ring-line/70 placeholder:font-sans placeholder:tracking-normal placeholder:normal-case placeholder:text-ink-faint"
              />
              <button
                type="submit"
                disabled={busy || draft.trim() === ''}
                className="focus-ring shrink-0 rounded-tile bg-brand px-5 text-[14px] font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
              >
                {t(s.friends.addButton)}
              </button>
            </div>
            {result && (
              <p
                role="status"
                className={cn(
                  'mt-2.5 text-[13px] leading-relaxed',
                  GOOD_RESULTS.has(result) ? 'text-correct' : 'text-wrong',
                )}
              >
                {t(RESULT_TEXT[result])}
              </p>
            )}
          </motion.form>

          {listFailed && (
            <motion.div variants={staggerItem} className="mt-5">
              <EmptyPanel>{t(s.friends.loadFailed)}</EmptyPanel>
            </motion.div>
          )}

          {/* Waiting on the reader. */}
          {incoming.length > 0 && (
            <motion.div variants={staggerItem} className="mt-7">
              <SectionHeading title={`${t(s.friends.incomingTitle)} · ${incoming.length}`} />
              <MatchList>
                {incoming.map((entry) => (
                  <PersonRow
                    key={entry.id}
                    player={players[entry.otherUid]}
                    subtitle={relativeTime(entry.createdAt, t)}
                  >
                    <RowButton
                      tone="brand"
                      disabled={working === entry.id}
                      onClick={() => void run(entry.id, () => acceptFriendRequest(entry.id))}
                    >
                      {t(s.friends.accept)}
                    </RowButton>
                    <button
                      type="button"
                      aria-label={t(s.friends.decline)}
                      disabled={working === entry.id}
                      onClick={() => void run(entry.id, () => removeFriendship(entry.id))}
                      className="focus-ring grid h-8 w-8 place-items-center rounded-full text-ink-faint hover:text-ink disabled:opacity-50"
                    >
                      <X className="h-4 w-4" strokeWidth={2.2} />
                    </button>
                  </PersonRow>
                ))}
              </MatchList>
            </motion.div>
          )}

          {/* Friends. */}
          <motion.div variants={staggerItem} className="mt-7">
            <SectionHeading
              title={friends.length > 0 ? `${t(s.friends.listTitle)} · ${friends.length}` : t(s.friends.listTitle)}
            />
            {friendships === null && !listFailed ? null : friends.length === 0 ? (
              <EmptyPanel>{t(s.friends.empty)}</EmptyPanel>
            ) : (
              <MatchList>
                {friends.map((entry) => {
                  const player = players[entry.otherUid]
                  const status = statusLine(player)
                  const isConfirming = confirming === entry.id
                  return (
                    <PersonRow key={entry.id} player={player} subtitle={status.text} online={status.online}>
                      {isConfirming ? (
                        <>
                          <RowButton
                            tone="danger"
                            disabled={working === entry.id}
                            onClick={() => void run(entry.id, () => removeFriendship(entry.id))}
                          >
                            {t(s.friends.remove)}
                          </RowButton>
                          <RowButton onClick={() => setConfirming(null)}>
                            {t(s.friends.cancel)}
                          </RowButton>
                        </>
                      ) : (
                        <button
                          type="button"
                          aria-label={t(s.friends.removeConfirm)}
                          title={t(s.friends.remove)}
                          onClick={() => setConfirming(entry.id)}
                          className="focus-ring grid h-8 w-8 place-items-center rounded-full text-ink-faint hover:text-wrong"
                        >
                          <X className="h-4 w-4" strokeWidth={2.2} />
                        </button>
                      )}
                    </PersonRow>
                  )
                })}
              </MatchList>
            )}
            {confirming && (
              <p className="mt-2 text-[12.5px] text-ink-soft">{t(s.friends.removeConfirm)}</p>
            )}
          </motion.div>

          {/* Sent, not yet answered. */}
          {outgoing.length > 0 && (
            <motion.div variants={staggerItem} className="mt-7">
              <SectionHeading title={t(s.friends.outgoingTitle)} />
              <MatchList>
                {outgoing.map((entry) => (
                  <PersonRow
                    key={entry.id}
                    player={players[entry.otherUid]}
                    subtitle={relativeTime(entry.createdAt, t)}
                  >
                    <RowButton
                      disabled={working === entry.id}
                      onClick={() => void run(entry.id, () => removeFriendship(entry.id))}
                    >
                      {t(s.friends.cancel)}
                    </RowButton>
                  </PersonRow>
                ))}
              </MatchList>
            </motion.div>
          )}

          <motion.p
            variants={staggerItem}
            className="mt-7 rounded-card border border-dashed border-line px-4 py-3 text-center text-[12.5px] leading-relaxed text-ink-soft"
          >
            {t(s.friends.teamSoon)}
          </motion.p>
        </>
      )}
    </motion.div>
  )
}
