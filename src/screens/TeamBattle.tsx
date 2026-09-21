/**
 * Команда (`/battle/team`) — gathering a party for a 2х2 … 5х5 battle.
 *
 * Two states, one screen: with no party you either open one or type a friend's
 * code; inside a party you see the code to share, the format, the roster, and
 * (for the leader) the search.
 *
 * The format picker is the honest part. Four sizes mean four separate queues,
 * and at this app's size the 5х5 queue can be empty for hours — so each format
 * shows how many people are actually waiting in it right now, and a long wait
 * offers a smaller format with real players instead of spinning forever.
 *
 * The match itself is the next step; this screen ends at "we are in the queue".
 */
import { Check, Copy, LogOut, Search, UserMinus, Users, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyPanel, MatchList } from '../components/battle'
import { KahootHeader, PlayerAvatar } from '../components/kahoot'
import { SectionHeading } from '../components/ui'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { fetchBattlePlayer, syncBattlePlayer } from '../lib/battle'
import type { BattleMode, BattlePlayer, BattlePlayerMeta } from '../lib/battle'
import { cn } from '../lib/cn'
import { staggerContainer, staggerItem } from '../lib/motion'
import {
  TEAM_SIZES,
  countWaiting,
  createParty,
  downsizeOptions,
  joinParty,
  leaveParty,
  refreshQueueSlot,
  removeMember,
  setPartyFormat,
  startSearch,
  stopSearch,
  watchParty,
  watchQueue,
} from '../lib/party'
import type { JoinPartyResult, Party, QueueSlot, TeamSize } from '../lib/party'
import { levelInfo, useProfile } from '../lib/progress'
import { resolveRankIdentity } from '../lib/rankIdentity'
import { OWNER_EMAIL } from '../lib/rankStyle'
import { useSession } from '../lib/session'

/** Remembers the party across a reload, so a refresh mid-gathering doesn't
 *  drop someone out of a team their friends are still waiting in. */
const PARTY_KEY = 'tarihhub_party'

function readStoredParty(): string | null {
  try {
    return window.localStorage.getItem(PARTY_KEY)
  } catch {
    return null
  }
}

function storeParty(code: string | null): void {
  try {
    if (code) window.localStorage.setItem(PARTY_KEY, code)
    else window.localStorage.removeItem(PARTY_KEY)
  } catch {
    /* storage unavailable — the party just won't survive a reload */
  }
}

const JOIN_TEXT: Record<Exclude<JoinPartyResult, 'joined'>, typeof s.team.joinNotFound> = {
  notFound: s.team.joinNotFound,
  full: s.team.joinFull,
  searching: s.team.joinSearching,
  already: s.team.joinAlready,
  invalid: s.team.joinInvalid,
  error: s.team.joinError,
}

/** After this long in the queue, offer a format that actually has people. */
const DOWNSIZE_AFTER_MS = 30_000
/** Keeps our own queue slot from ageing out while the screen is open. */
const SLOT_REFRESH_MS = 30_000

export function TeamBattle() {
  const { t } = useLang()
  const navigate = useNavigate()
  const profile = useProfile()
  const user = useSession().user
  const uid = user?.uid ?? null

  /* --------------------------- own public mirror --------------------------- */

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

  /* -------------------------------- the party ------------------------------- */

  const [code, setCode] = useState<string | null>(() => readStoredParty())
  const [party, setParty] = useState<Party | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const forgetParty = useCallback((message?: string) => {
    storeParty(null)
    setCode(null)
    setParty(null)
    if (message) setNotice(message)
  }, [])

  useEffect(() => {
    if (!code) {
      setParty(null)
      return
    }
    return watchParty(
      code,
      (next) => setParty(next),
      () => forgetParty(t(s.team.gone)),
    )
  }, [code, forgetParty, t])

  // Someone who was removed — or who left on another device — should not keep
  // looking at a roster they are no longer part of.
  useEffect(() => {
    if (party && uid && !party.members.includes(uid)) forgetParty()
  }, [party, uid, forgetParty])

  const isLeader = Boolean(party && uid && party.leader === uid)
  const full = Boolean(party && party.members.length === party.size)
  const searching = party?.status === 'queued'

  /* --------------------------------- queue --------------------------------- */

  const [slots, setSlots] = useState<QueueSlot[]>([])
  useEffect(() => {
    if (!uid) return
    return watchQueue(setSlots)
  }, [uid])

  const mode: BattleMode = party?.mode ?? 'casual'
  const counts = useMemo(() => countWaiting(slots, mode), [slots, mode])

  // A slot the leader stops refreshing would age out and stop being matchable,
  // so the leader's own screen keeps it fresh while the search is on.
  useEffect(() => {
    if (!party || !uid || !isLeader || party.status !== 'queued') return
    const timer = window.setInterval(() => {
      void refreshQueueSlot(party.code, uid, party)
    }, SLOT_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [party, uid, isLeader])

  // If someone leaves mid-search the slot would promise a full team that no
  // longer exists, so the search stops rather than matching short-handed.
  useEffect(() => {
    if (!party || !isLeader) return
    if (party.status === 'queued' && party.members.length !== party.size) {
      void stopSearch(party.code)
    }
  }, [party, isLeader])

  /* ------------------------------ waiting time ----------------------------- */

  const [waitedLong, setWaitedLong] = useState(false)
  useEffect(() => {
    if (!searching) {
      setWaitedLong(false)
      return
    }
    const timer = window.setTimeout(() => setWaitedLong(true), DOWNSIZE_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [searching, party?.size])

  const alternatives = party ? downsizeOptions(party.size, party.members.length, counts) : []

  /* ------------------------------- the roster ------------------------------ */

  const [players, setPlayers] = useState<Record<string, BattlePlayer | null>>({})
  useEffect(() => {
    if (!party) return
    const missing = party.members.filter((member) => !(member in players))
    if (missing.length === 0) return
    let alive = true
    void Promise.all(missing.map((member) => fetchBattlePlayer(member))).then((found) => {
      if (!alive) return
      setPlayers((prev) => {
        const next = { ...prev }
        missing.forEach((member, index) => {
          next[member] = found[index]
        })
        return next
      })
    })
    return () => {
      alive = false
    }
  }, [party, players])

  /* -------------------------------- actions -------------------------------- */

  const [draft, setDraft] = useState('')
  const [newSize, setNewSize] = useState<TeamSize>(2)

  const open = async () => {
    if (!uid || busy) return
    setBusy(true)
    setNotice(null)
    const created = await createParty(uid, 'casual', newSize)
    if (created) {
      storeParty(created)
      setCode(created)
    } else {
      setNotice(t(s.team.joinError))
    }
    setBusy(false)
  }

  const join = async (event: FormEvent) => {
    event.preventDefault()
    if (!uid || busy) return
    setBusy(true)
    setNotice(null)
    const outcome = await joinParty(draft, uid)
    if (outcome === 'joined' || outcome === 'already') {
      const joined = draft.toUpperCase().replace(/[\s-]/g, '')
      storeParty(joined)
      setCode(joined)
      setDraft('')
    } else {
      setNotice(t(JOIN_TEXT[outcome]))
    }
    setBusy(false)
  }

  const leave = async () => {
    if (!party || !uid || busy) return
    setBusy(true)
    await leaveParty(party.code, uid)
    forgetParty()
    setBusy(false)
  }

  const chooseSize = async (size: TeamSize) => {
    if (!party || busy) return
    if (!isLeader) {
      setNotice(t(s.team.onlyLeader))
      return
    }
    if (searching) {
      setNotice(t(s.team.formatLocked))
      return
    }
    if (size < party.members.length) return
    setBusy(true)
    await setPartyFormat(party.code, { size })
    setBusy(false)
  }

  const toggleSearch = async () => {
    if (!party || !uid || busy) return
    if (!isLeader) {
      setNotice(t(s.team.onlyLeader))
      return
    }
    setBusy(true)
    setNotice(null)
    if (searching) {
      await stopSearch(party.code)
    } else if (!full) {
      setNotice(t(s.team.needFull))
    } else {
      await startSearch(party.code, uid)
    }
    setBusy(false)
  }

  const copyCode = async () => {
    if (!party) return
    try {
      await navigator.clipboard.writeText(party.code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — the code is on screen to read out */
    }
  }

  /* --------------------------------- render -------------------------------- */

  const queueLabel = (size: TeamSize) =>
    counts[size] > 0 ? `${counts[size]} ${t(s.team.inQueue)}` : t(s.team.queueEmpty)

  const FormatPicker = ({
    value,
    onPick,
  }: {
    value: TeamSize
    onPick: (size: TeamSize) => void
  }) => (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {TEAM_SIZES.map((size) => {
        const active = size === value
        const someone = counts[size] > 0
        return (
          <button
            key={size}
            type="button"
            onClick={() => onPick(size)}
            className={cn(
              'focus-ring rounded-tile px-3 py-3 text-left transition-colors',
              active
                ? 'bg-brand text-white shadow-soft'
                : 'bg-cream text-ink ring-1 ring-line/70 hover:ring-brand/40',
            )}
          >
            <span className="block text-[17px] leading-none font-bold tabular-nums">
              {size}х{size}
            </span>
            <span
              className={cn(
                'mt-1.5 flex items-center gap-1.5 text-[11.5px] tabular-nums',
                active ? 'text-white/80' : 'text-ink-faint',
              )}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{
                  background: someone
                    ? 'var(--color-correct)'
                    : active
                      ? 'rgba(255,255,255,.55)'
                      : 'var(--color-line)',
                }}
                aria-hidden
              />
              {queueLabel(size)}
            </span>
          </button>
        )
      })}
    </div>
  )

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="mx-auto max-w-2xl lg:max-w-3xl"
    >
      <KahootHeader
        icon={<Users className="h-5 w-5" strokeWidth={2} />}
        title={t(s.team.title)}
        subtitle={t(s.team.subtitle)}
        onBack={() => navigate('/battle')}
      />

      {!uid ? (
        <motion.div variants={staggerItem} className="mt-5">
          <EmptyPanel>{t(s.team.signInNeeded)}</EmptyPanel>
        </motion.div>
      ) : !party ? (
        <>
          {/* Open a party. */}
          <motion.section
            variants={staggerItem}
            className="mt-5 rounded-card bg-surface p-5 shadow-soft ring-1 ring-line/60"
          >
            <h2 className="text-[15px] font-bold text-ink">{t(s.team.formatTitle)}</h2>
            <div className="mt-3">
              <FormatPicker value={newSize} onPick={setNewSize} />
            </div>
            <button
              type="button"
              onClick={() => void open()}
              disabled={busy}
              className="focus-ring mt-4 w-full rounded-tile bg-brand px-5 py-3 text-[14.5px] font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {t(s.team.createButton)}
            </button>
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-soft">
              {t(s.team.createHint)}
            </p>
          </motion.section>

          {/* Or join one. */}
          <motion.form
            variants={staggerItem}
            onSubmit={join}
            className="mt-4 rounded-card bg-surface p-5 shadow-soft ring-1 ring-line/60"
          >
            <label htmlFor="party-code" className="text-[15px] font-bold text-ink">
              {t(s.team.joinTitle)}
            </label>
            <div className="mt-3 flex gap-2">
              <input
                id="party-code"
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value)
                  setNotice(null)
                }}
                placeholder={t(s.team.joinPlaceholder)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={8}
                className="focus-ring min-w-0 flex-1 rounded-tile bg-cream px-4 py-2.5 font-mono text-[16px] tracking-[0.12em] text-ink uppercase ring-1 ring-line/70 placeholder:font-sans placeholder:tracking-normal placeholder:normal-case placeholder:text-ink-faint"
              />
              <button
                type="submit"
                disabled={busy || draft.trim() === ''}
                className="focus-ring shrink-0 rounded-tile bg-cream px-5 text-[14px] font-semibold text-ink ring-1 ring-line/70 hover:text-brand disabled:opacity-50"
              >
                {t(s.team.joinButton)}
              </button>
            </div>
          </motion.form>

          {notice && (
            <motion.p variants={staggerItem} className="mt-3 text-[13px] text-wrong">
              {notice}
            </motion.p>
          )}
        </>
      ) : (
        <>
          {/* The code to share. */}
          <motion.section
            variants={staggerItem}
            className="mt-5 rounded-card bg-surface p-5 shadow-soft ring-1 ring-line/60"
          >
            <p className="text-[12px] font-semibold tracking-wide text-ink-faint uppercase">
              {t(s.team.codeLabel)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="font-mono text-[28px] leading-none font-bold tracking-[0.16em] text-ink tabular-nums">
                {party.code}
              </span>
              <button
                type="button"
                onClick={() => void copyCode()}
                className="focus-ring ml-auto inline-flex items-center gap-1.5 rounded-full bg-brand-tint px-3.5 py-2 text-[13px] font-semibold text-brand"
              >
                {copied ? (
                  <Check className="h-4 w-4" strokeWidth={2.4} />
                ) : (
                  <Copy className="h-4 w-4" strokeWidth={2} />
                )}
                {t(copied ? s.friends.copied : s.friends.copy)}
              </button>
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-ink-soft">{t(s.team.codeHint)}</p>
          </motion.section>

          {/* Format. */}
          <motion.div variants={staggerItem} className="mt-6">
            <SectionHeading title={t(s.team.formatTitle)} />
            <div className={cn(searching && 'opacity-60')}>
              <FormatPicker value={party.size} onPick={(size) => void chooseSize(size)} />
            </div>
          </motion.div>

          {/* Roster. */}
          <motion.div variants={staggerItem} className="mt-6">
            <SectionHeading
              title={`${t(s.team.rosterTitle)} · ${party.members.length}/${party.size}`}
            />
            <MatchList>
              {party.members.map((member) => {
                const player = players[member]
                const name = player?.displayName || '…'
                const isCaptain = member === party.leader
                return (
                  <li
                    key={member}
                    className="flex items-center gap-3 border-b border-line-soft px-4 py-3 last:border-b-0"
                  >
                    <PlayerAvatar
                      name={name}
                      photoURL={player?.photoURL ?? ''}
                      size={38}
                      me={member === uid}
                      avatarGender={player?.avatarGender ?? null}
                      avatarTierIndex={player?.avatarTierIndex ?? 0}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-semibold text-ink">
                        {name}
                      </span>
                      <span className="block truncate text-[12px] text-ink-faint tabular-nums">
                        {[
                          isCaptain ? t(s.team.leaderLabel) : null,
                          player ? `${t(s.battle.levelShort)} ${player.level}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    {isLeader && member !== uid && !searching && (
                      <button
                        type="button"
                        aria-label={t(s.team.kick)}
                        onClick={() => void removeMember(party.code, member)}
                        className="focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-faint hover:text-wrong"
                      >
                        <UserMinus className="h-4 w-4" strokeWidth={2} />
                      </button>
                    )}
                  </li>
                )
              })}
              {Array.from({ length: Math.max(0, party.size - party.members.length) }).map(
                (_, index) => (
                  <li
                    key={`empty-${index}`}
                    className="flex items-center gap-3 border-b border-line-soft px-4 py-3 last:border-b-0"
                  >
                    <span
                      className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full border-2 border-dashed border-line text-ink-faint"
                      aria-hidden
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                    <span className="text-[13.5px] text-ink-faint">{t(s.team.slotEmpty)}</span>
                  </li>
                ),
              )}
            </MatchList>
          </motion.div>

          {/* Search. */}
          <motion.div variants={staggerItem} className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => void toggleSearch()}
              disabled={busy || (!isLeader && !searching)}
              className={cn(
                'focus-ring inline-flex w-full items-center justify-center gap-2 rounded-tile px-5 py-3.5 text-[15px] font-semibold transition-colors disabled:opacity-50',
                searching
                  ? 'bg-cream text-ink ring-1 ring-line/70'
                  : 'bg-brand text-white hover:bg-brand-dark',
              )}
            >
              {searching ? (
                <>
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand"
                    aria-hidden
                  />
                  {t(s.team.stopSearch)}
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" strokeWidth={2} />
                  {t(s.team.searchButton)}
                </>
              )}
            </button>

            {searching && (
              <p className="text-center text-[13px] text-ink-soft">{t(s.team.searching)}</p>
            )}
            {!searching && isLeader && !full && (
              <p className="text-center text-[12.5px] text-ink-faint">{t(s.team.needFull)}</p>
            )}
            {notice && <p className="text-center text-[13px] text-wrong">{notice}</p>}

            {/* The honest answer to an empty queue. */}
            {searching && waitedLong && (
              <div className="rounded-card border border-dashed border-line px-4 py-3.5">
                <p className="text-[13.5px] font-semibold text-ink">{t(s.team.downsizeTitle)}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
                  {alternatives.length > 0 ? t(s.team.downsizeHint) : t(s.team.downsizeNobody)}
                </p>
                {alternatives.length > 0 && isLeader && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {alternatives.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => {
                          void (async () => {
                            setBusy(true)
                            await stopSearch(party.code)
                            await setPartyFormat(party.code, { size })
                            setBusy(false)
                          })()
                        }}
                        className="focus-ring rounded-full bg-brand-tint px-3.5 py-1.5 text-[12.5px] font-semibold text-brand tabular-nums"
                      >
                        {size}х{size} · {counts[size]} {t(s.team.inQueue)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => void leave()}
              disabled={busy}
              className="focus-ring inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold text-ink-faint hover:text-wrong disabled:opacity-50"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
              {t(isLeader ? s.team.disband : s.team.leave)}
            </button>
          </motion.div>

          <motion.p
            variants={staggerItem}
            className="mt-6 rounded-card border border-dashed border-line px-4 py-3 text-center text-[12.5px] leading-relaxed text-ink-soft"
          >
            {t(s.team.matchSoon)}
          </motion.p>
        </>
      )}
    </motion.div>
  )
}
