/**
 * Команда (`/battle/team`) — one room holding both sides of a team battle.
 *
 * It used to be one team plus a "find an opponent" queue. The opponent never
 * came: nothing in the app ever read two queue slots and paired them, so a full
 * team could wait for ever, and at this app's size two full teams are almost
 * never waiting in the same minute anyway. The room now holds `size * 2` —
 * gather whoever is around, split them, play. No queue at all.
 *
 * Two states, one screen: with no room you open one or type a friend's code;
 * inside one you see both sides, the code to share, and the start.
 *
 * The layout is the lobby shape Erlan asked for — the two teams facing each
 * other across a VS — but it is built from the theme tokens, not from the dark
 * colours the mock was drawn in, so it reads the same in light and dark. The
 * arena feeling comes from the structure, not from the paint.
 *
 * The match itself is still the next step: `Старт` is deliberately disabled and
 * says so, rather than pretending to open something that does not exist.
 */
import { ArrowLeftRight, Check, Copy, LogOut, Plus, UserMinus, Users } from 'lucide-react'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyPanel } from '../components/battle'
import { KahootHeader, PlayerAvatar } from '../components/kahoot'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { fetchBattlePlayer, syncBattlePlayer } from '../lib/battle'
import type { BattlePlayer, BattlePlayerMeta } from '../lib/battle'
import { cn } from '../lib/cn'
import { staggerContainer, staggerItem } from '../lib/motion'
import {
  TEAM_SIZES,
  createParty,
  joinParty,
  leaveParty,
  removeMember,
  roomCapacity,
  setPartyFormat,
  switchTeam,
  teamsReady,
  watchParty,
} from '../lib/party'
import type { JoinPartyResult, Party, TeamKey, TeamSize } from '../lib/party'
import { levelInfo, useProfile } from '../lib/progress'
import { resolveRankIdentity } from '../lib/rankIdentity'
import { OWNER_EMAIL } from '../lib/rankStyle'
import { useSession } from '../lib/session'

/** Remembers the room across a reload, so a refresh mid-gathering doesn't
 *  drop someone out of a room their friends are still sitting in. */
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
    /* storage unavailable — the room just won't survive a reload */
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

/** Side A wears the brand colour, side B the Saka terracotta: two hues that
 *  differ in lightness as well, so the sides stay apart for a reader who does
 *  not separate green from orange. */
const SIDE_COLOR: Record<TeamKey, string> = {
  a: 'var(--color-brand)',
  b: 'var(--color-era-saka)',
}

interface SideLabels {
  leader: string
  level: string
  invite: string
  kick: string
}

/**
 * One side of the room: its filled seats, then its empty ones.
 *
 * Module-level rather than nested in the screen so React keeps the subtree
 * across renders — a component redefined inside a render remounts every avatar
 * on every snapshot, which made the old roster flicker whenever anyone joined.
 *
 * `right` mirrors the column so the two teams face each other across the VS.
 */
function SideColumn({
  label,
  side,
  uids,
  slots,
  players,
  meUid,
  leaderUid,
  right,
  labels,
  onKick,
  onInvite,
}: {
  label: string
  side: TeamKey
  uids: string[]
  slots: number
  players: Record<string, BattlePlayer | null>
  meUid: string | null
  leaderUid: string
  right: boolean
  labels: SideLabels
  /** `null` when the reader is not the leader and may not remove anyone. */
  onKick: ((uid: string) => void) | null
  onInvite: () => void
}) {
  const empty = Math.max(0, slots - uids.length)
  return (
    <div className={cn('flex min-w-0 flex-col', right ? 'items-end' : 'items-start')}>
      <div className="flex items-baseline gap-1.5">
        {right && (
          <span className="text-[11px] font-semibold text-ink-faint tabular-nums">
            {uids.length}/{slots}
          </span>
        )}
        <span
          className="text-[11px] font-bold tracking-wide uppercase"
          style={{ color: SIDE_COLOR[side] }}
        >
          {label}
        </span>
        {!right && (
          <span className="text-[11px] font-semibold text-ink-faint tabular-nums">
            {uids.length}/{slots}
          </span>
        )}
      </div>

      <ul className={cn('mt-3 flex w-full flex-col gap-2.5', right ? 'items-end' : 'items-start')}>
        {uids.map((member) => {
          const player = players[member]
          const name = player?.displayName || '…'
          const isCaptain = member === leaderUid
          const removable = onKick && member !== leaderUid
          return (
            <li
              key={member}
              className={cn(
                'flex w-full min-w-0 items-center gap-2.5',
                right && 'flex-row-reverse',
              )}
            >
              <PlayerAvatar
                name={name}
                photoURL={player?.photoURL ?? ''}
                size={34}
                me={member === meUid}
                avatarGender={player?.avatarGender ?? null}
                avatarTierIndex={player?.avatarTierIndex ?? 0}
              />
              <span className={cn('flex min-w-0 flex-col', right && 'items-end')}>
                <span className="truncate text-[13.5px] font-semibold text-ink">{name}</span>
                <span className="truncate text-[10.5px] text-ink-faint tabular-nums">
                  {[
                    isCaptain ? labels.leader : null,
                    player ? `${labels.level} ${player.level}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              {removable && (
                <button
                  type="button"
                  aria-label={labels.kick}
                  onClick={() => onKick(member)}
                  className="focus-ring grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-faint hover:text-wrong"
                >
                  <UserMinus className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              )}
            </li>
          )
        })}

        {/* An empty seat is an invitation, not a hole: tapping it copies the
            room code, which is the only way to invite anyone today. */}
        {Array.from({ length: empty }).map((_, index) => (
          <li key={`empty-${index}`} className="w-full">
            <button
              type="button"
              onClick={onInvite}
              className={cn(
                'focus-ring flex w-full items-center gap-2.5 text-ink-faint hover:text-brand',
                right && 'flex-row-reverse',
              )}
            >
              <span
                className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full border-2 border-dashed border-line"
                aria-hidden
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
              </span>
              <span className="truncate text-[12.5px] font-semibold">{labels.invite}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

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

  /* -------------------------------- the room ------------------------------- */

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
  // looking at a room they are no longer part of.
  useEffect(() => {
    if (party && uid && !party.members.includes(uid)) forgetParty()
  }, [party, uid, forgetParty])

  const isLeader = Boolean(party && uid && party.leader === uid)

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

  const copyCode = useCallback(async () => {
    if (!party) return
    try {
      await navigator.clipboard.writeText(party.code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — the code is on screen to read out */
    }
  }, [party])

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
    // Shrinking past the people already seated would leave someone standing, so
    // a size only applies when both sides still fit inside it.
    if (party.teams.a.length > size || party.teams.b.length > size) return
    setBusy(true)
    await setPartyFormat(party.code, { size })
    setBusy(false)
  }

  const swapSides = async () => {
    if (!party || !uid || busy) return
    const mine: TeamKey = party.teams.a.includes(uid) ? 'a' : 'b'
    const target: TeamKey = mine === 'a' ? 'b' : 'a'
    setBusy(true)
    setNotice(null)
    const moved = await switchTeam(party.code, uid, target)
    if (!moved) setNotice(t(s.team.switchFailed))
    setBusy(false)
  }

  /* --------------------------------- render -------------------------------- */

  const sideLabels: SideLabels = {
    leader: t(s.team.leaderLabel),
    level: t(s.battle.levelShort),
    invite: t(s.team.invite),
    kick: t(s.team.kick),
  }

  const formatPicker = (value: TeamSize, onPick: (size: TeamSize) => void) => (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {TEAM_SIZES.map((size) => {
        const active = size === value
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
                'mt-1.5 block text-[11.5px] tabular-nums',
                active ? 'text-white/80' : 'text-ink-faint',
              )}
            >
              {roomCapacity(size)} {t(s.team.roomHolds)}
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
          {/* Open a room. */}
          <motion.section
            variants={staggerItem}
            className="mt-5 rounded-card bg-surface p-5 shadow-soft ring-1 ring-line/60"
          >
            <h2 className="text-[15px] font-bold text-ink">{t(s.team.formatTitle)}</h2>
            <div className="mt-3">{formatPicker(newSize, setNewSize)}</div>
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
          {/* One card holds the whole room: code, both sides, the start. The
              seven separate panels this replaces were the reason the screen
              read as scattered. */}
          <motion.section
            variants={staggerItem}
            className="mt-5 overflow-hidden rounded-card bg-surface shadow-soft ring-1 ring-line/60"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5">
              <span className="text-[11px] font-semibold tracking-wide text-ink-faint uppercase">
                {t(s.team.codeLabel)}
              </span>
              <span className="font-mono text-[20px] leading-none font-bold tracking-[0.13em] text-ink">
                {party.code}
              </span>
              <button
                type="button"
                onClick={() => void copyCode()}
                aria-label={t(copied ? s.friends.copied : s.friends.copy)}
                className="focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-tint text-brand"
              >
                {copied ? (
                  <Check className="h-4 w-4" strokeWidth={2.4} />
                ) : (
                  <Copy className="h-4 w-4" strokeWidth={2} />
                )}
              </button>
              <span className="ml-auto text-[12.5px] font-bold text-ink tabular-nums">
                {party.size}х{party.size}
              </span>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] gap-x-3 border-t border-line-soft px-4 py-5">
              <SideColumn
                label={t(s.team.sideA)}
                side="a"
                uids={party.teams.a}
                slots={party.size}
                players={players}
                meUid={uid}
                leaderUid={party.leader}
                right={false}
                labels={sideLabels}
                onKick={isLeader ? (member) => void removeMember(party.code, member) : null}
                onInvite={() => void copyCode()}
              />

              <div className="flex flex-col items-center">
                <span className="w-px flex-1 bg-line-soft" aria-hidden />
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cream text-[10.5px] font-bold text-ink-soft ring-1 ring-line/70">
                  VS
                </span>
                <span className="w-px flex-1 bg-line-soft" aria-hidden />
              </div>

              <SideColumn
                label={t(s.team.sideB)}
                side="b"
                uids={party.teams.b}
                slots={party.size}
                players={players}
                meUid={uid}
                leaderUid={party.leader}
                right
                labels={sideLabels}
                onKick={isLeader ? (member) => void removeMember(party.code, member) : null}
                onInvite={() => void copyCode()}
              />
            </div>

            <button
              type="button"
              onClick={() => void swapSides()}
              disabled={busy}
              className="focus-ring flex w-full items-center justify-center gap-2 border-t border-line-soft px-4 py-3 text-[13px] font-semibold text-brand disabled:opacity-50"
            >
              <ArrowLeftRight className="h-4 w-4" strokeWidth={2} />
              {t(s.team.switchSide)}
            </button>

            <div className="border-t border-line-soft bg-cream/50 px-4 py-4">
              {/* Deliberately disabled: the match itself is not written yet, and
                  a button that opened nothing would be worse than an honest
                  one. `teamsReady` is what will enable it. */}
              <button
                type="button"
                disabled
                className="focus-ring w-full rounded-tile bg-brand px-5 py-3.5 text-[15.5px] font-bold text-white disabled:opacity-50"
              >
                {t(s.team.startButton)} · {party.teams.a.length}х{party.teams.b.length}
              </button>
              <p className="mt-2.5 text-center text-[12.5px] leading-relaxed text-ink-soft">
                {teamsReady(party) ? t(s.team.matchSoon) : t(s.team.sidesUnequal)}
              </p>
            </div>
          </motion.section>

          {notice && (
            <motion.p variants={staggerItem} className="mt-3 text-center text-[13px] text-wrong">
              {notice}
            </motion.p>
          )}

          <motion.div variants={staggerItem} className="mt-5">
            <p className="text-[11px] font-semibold tracking-wide text-ink-faint uppercase">
              {t(s.team.formatTitle)}
            </p>
            <div className="mt-2.5">{formatPicker(party.size, (size) => void chooseSize(size))}</div>
          </motion.div>

          <motion.div variants={staggerItem} className="mt-5 flex justify-center">
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
        </>
      )}
    </motion.div>
  )
}
