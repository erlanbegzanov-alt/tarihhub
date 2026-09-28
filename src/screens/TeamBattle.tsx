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
import { ArrowLeftRight, Check, Copy, LogOut, Plus, UserMinus, Users, X } from 'lucide-react'
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
import { watchFriendships } from '../lib/friends'
import type { Friendship } from '../lib/friends'
import { staggerContainer, staggerItem } from '../lib/motion'
import {
  TEAM_SIZES,
  createParty,
  dismissInvite,
  invitePlayer,
  joinParty,
  leaveParty,
  removeMember,
  setPartyFormat,
  switchTeam,
  teamsReady,
  watchMyInvites,
  watchParty,
} from '../lib/party'
import type { JoinPartyResult, Party, PartyInvite, TeamKey, TeamSize } from '../lib/party'
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
          <span className="text-[12px] font-semibold text-ink-faint tabular-nums">
            {uids.length}/{slots}
          </span>
        )}
        <span
          className="text-[12px] font-bold tracking-wide uppercase"
          style={{ color: SIDE_COLOR[side] }}
        >
          {label}
        </span>
        {!right && (
          <span className="text-[12px] font-semibold text-ink-faint tabular-nums">
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
                <span className="truncate text-[14px] font-semibold text-ink">{name}</span>
                <span className="truncate text-[11.5px] text-ink-faint tabular-nums">
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
  /**
   * Firestore's own reason for the last failure, shown in small type under the
   * friendly notice. Erlan reported the room code "не работает вообще" and
   * neither of us could get further than that, because every cause — a rule
   * refusing the write, an expired sign-in, no signal — printed the same
   * sentence about checking the internet.
   */
  const [noticeCode, setNoticeCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  /** Clears both lines: every action starts from no complaint on screen. */
  const clearNotice = () => {
    setNotice(null)
    setNoticeCode(null)
  }

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

  /* ------------------------ friends and invitations ------------------------ */

  const [friends, setFriends] = useState<Friendship[]>([])
  useEffect(() => {
    if (!uid) return
    return watchFriendships(uid, setFriends)
  }, [uid])

  const [invites, setInvites] = useState<PartyInvite[]>([])
  useEffect(() => {
    if (!uid) return
    return watchMyInvites(uid, setInvites)
  }, [uid])

  /** Accepted friends only. A request nobody has answered yet is not someone
   *  you can call into a game, and the rules refuse such an invite anyway. */
  const friendUids = useMemo(
    () => friends.filter((friend) => friend.status === 'accepted').map((friend) => friend.otherUid),
    [friends],
  )

  /**
   * Requests nobody has answered yet.
   *
   * They cannot be invited — the rules refuse an invite to anyone but an
   * accepted friend — but they are the difference between "you have no friends"
   * and "nobody has pressed Принять yet", and the panel used to tell the second
   * person the first thing.
   */
  const pendingFriends = useMemo(
    () => friends.filter((friend) => friend.status === 'pending').length,
    [friends],
  )

  /* ------------------------------- the roster ------------------------------ */

  // Everyone whose name this screen has to put on the glass: the room, the
  // friends it can call into it, and whoever is calling the reader.
  const wanted = useMemo(() => {
    const uids = new Set<string>(friendUids)
    for (const member of party?.members ?? []) uids.add(member)
    for (const invite of invites) uids.add(invite.from)
    return [...uids]
  }, [party, friendUids, invites])

  const [players, setPlayers] = useState<Record<string, BattlePlayer | null>>({})
  useEffect(() => {
    const missing = wanted.filter((member) => !(member in players))
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
  }, [wanted, players])

  /** A name for a uid once its public mirror has landed. */
  const nameOf = (who: string): string => players[who]?.displayName || '…'

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
    clearNotice()
    const created = await createParty(uid, 'casual', newSize)
    if (created.code) {
      storeParty(created.code)
      setCode(created.code)
    } else {
      setNotice(t(s.team.joinError))
      setNoticeCode(created.reason ?? null)
    }
    setBusy(false)
  }

  const join = async (event: FormEvent) => {
    event.preventDefault()
    if (!uid || busy) return
    setBusy(true)
    clearNotice()
    const outcome = await joinParty(draft, uid)
    if (outcome.result === 'joined' || outcome.result === 'already') {
      const joined = draft.toUpperCase().replace(/[\s-]/g, '')
      storeParty(joined)
      setCode(joined)
      setDraft('')
    } else {
      setNotice(t(JOIN_TEXT[outcome.result]))
      setNoticeCode(outcome.reason ?? null)
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
    clearNotice()
    const moved = await switchTeam(party.code, uid, target)
    if (!moved) setNotice(t(s.team.switchFailed))
    setBusy(false)
  }

  /** Open seats used to copy the code; they open this instead. */
  const [invitePanel, setInvitePanel] = useState(false)
  /** Whom we have called this session, so the row can say so. */
  const [invited, setInvited] = useState<string[]>([])

  const callFriend = async (to: string) => {
    if (!party || !uid || busy) return
    setBusy(true)
    clearNotice()
    const sent = await invitePlayer(party.code, uid, to)
    if (sent) setInvited((prev) => (prev.includes(to) ? prev : [...prev, to]))
    else setNotice(t(s.team.joinError))
    setBusy(false)
  }

  const acceptInvite = async (invite: PartyInvite) => {
    if (!uid || busy) return
    setBusy(true)
    clearNotice()
    const outcome = await joinParty(invite.code, uid)
    if (outcome.result === 'joined' || outcome.result === 'already') {
      storeParty(invite.code)
      setCode(invite.code)
      await dismissInvite(invite.id)
    } else {
      setNotice(t(JOIN_TEXT[outcome.result]))
      setNoticeCode(outcome.reason ?? null)
      // The room is gone: the card would otherwise sit there for ever, calling
      // into nothing.
      if (outcome.result === 'notFound') await dismissInvite(invite.id)
    }
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
            {/* «4 игроков в комнате» under every tile was four more lines of
                11px grey: "2х2" already says how many people it takes. */}
            <span className="block text-[17px] leading-none font-bold tabular-nums">
              {size}х{size}
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
          {/* Whoever is calling, first: a card that says a friend is waiting
              beats hunting for a code they read out over voice chat. */}
          {invites.length > 0 && (
            <motion.section variants={staggerItem} className="mt-5">
              <p className="text-[11px] font-bold tracking-wide text-ink-faint uppercase">
                {t(s.team.invitesTitle)}
              </p>
              <ul className="mt-2.5 flex flex-col gap-2">
                {invites.map((invite) => (
                  <li
                    key={invite.id}
                    className="flex items-center gap-3 rounded-card bg-surface px-4 py-3 shadow-soft ring-1 ring-line/60"
                  >
                    <PlayerAvatar
                      name={nameOf(invite.from)}
                      photoURL={players[invite.from]?.photoURL ?? ''}
                      size={36}
                      me={false}
                      avatarGender={players[invite.from]?.avatarGender ?? null}
                      avatarTierIndex={players[invite.from]?.avatarTierIndex ?? 0}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-bold text-ink">
                        {nameOf(invite.from)}
                      </span>
                      <span className="block truncate font-mono text-[11.5px] tracking-[0.1em] text-ink-faint">
                        {invite.code}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => void dismissInvite(invite.id)}
                      className="focus-ring shrink-0 rounded-full px-2.5 py-1.5 text-[12px] font-semibold text-ink-faint hover:text-wrong"
                    >
                      {t(s.team.inviteDismiss)}
                    </button>
                    <button
                      type="button"
                      onClick={() => void acceptInvite(invite)}
                      disabled={busy}
                      className="focus-ring shrink-0 rounded-full bg-brand px-4 py-2 text-[13px] font-bold text-white hover:bg-brand-dark disabled:opacity-50"
                    >
                      {t(s.team.inviteAccept)}
                    </button>
                  </li>
                ))}
              </ul>
            </motion.section>
          )}

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
                  clearNotice()
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
            <motion.div variants={staggerItem} className="mt-3">
              <p className="text-[13px] text-wrong">{notice}</p>
              {noticeCode && (
                <p className="mt-1 font-mono text-[11px] text-ink-faint">
                  {t(s.team.failureCode)}: {noticeCode}
                </p>
              )}
            </motion.div>
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
                onInvite={() => setInvitePanel(true)}
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
                onInvite={() => setInvitePanel(true)}
              />
            </div>

            {/* Calling a friend by name is the point of having a friends list
                at all; the code is still on screen for anyone who is not one. */}
            {invitePanel && (
              <div className="border-t border-line-soft bg-cream/40 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-bold text-ink">{t(s.team.inviteTitle)}</span>
                  <button
                    type="button"
                    onClick={() => setInvitePanel(false)}
                    aria-label={t(s.common.back)}
                    className="focus-ring grid h-7 w-7 place-items-center rounded-full text-ink-faint hover:text-ink"
                  >
                    <X className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>

                {friendUids.length === 0 ? (
                  <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">
                    {t(pendingFriends > 0 ? s.team.invitePendingOnly : s.team.inviteNoFriends)}
                  </p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-2.5">
                    {friendUids.map((friendUid) => {
                      const inRoom = party.members.includes(friendUid)
                      const sent = invited.includes(friendUid)
                      return (
                        <li key={friendUid} className="flex items-center gap-2.5">
                          <PlayerAvatar
                            name={nameOf(friendUid)}
                            photoURL={players[friendUid]?.photoURL ?? ''}
                            size={32}
                            me={false}
                            avatarGender={players[friendUid]?.avatarGender ?? null}
                            avatarTierIndex={players[friendUid]?.avatarTierIndex ?? 0}
                          />
                          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">
                            {nameOf(friendUid)}
                          </span>
                          {inRoom ? (
                            <span className="shrink-0 text-[11.5px] font-semibold text-ink-faint">
                              {t(s.team.inviteInRoom)}
                            </span>
                          ) : sent ? (
                            <span className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-semibold text-brand">
                              <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
                              {t(s.team.inviteSent)}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void callFriend(friendUid)}
                              disabled={busy}
                              className="focus-ring shrink-0 rounded-full bg-brand-tint px-3.5 py-1.5 text-[12.5px] font-bold text-brand disabled:opacity-50"
                            >
                              {t(s.team.inviteButton)}
                            </button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}

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
            <motion.div variants={staggerItem} className="mt-3 text-center">
              <p className="text-[13px] text-wrong">{notice}</p>
              {noticeCode && (
                <p className="mt-1 font-mono text-[11px] text-ink-faint">
                  {t(s.team.failureCode)}: {noticeCode}
                </p>
              )}
            </motion.div>
          )}

          {/* Only the captain can change the format — `chooseSize` refuses for
              anyone else and said so in a notice. Showing four buttons that
              answer "это может только капитан" was a whole block of the screen
              spent on a refusal. */}
          {isLeader && (
            <motion.div variants={staggerItem} className="mt-5">
              <p className="text-[11px] font-semibold tracking-wide text-ink-faint uppercase">
                {t(s.team.formatTitle)}
              </p>
              <div className="mt-2.5">
                {formatPicker(party.size, (size) => void chooseSize(size))}
              </div>
            </motion.div>
          )}

          {/* Leaving was a faint grey line of 13px text with no edge to it, and
              Erlan said he could barely find it. It is a real button now: its
              own outline, full width, in the colour the app uses for undoing
              things. Still the last thing on the screen, because it is the one
              action here you cannot take back. */}
          <motion.div variants={staggerItem} className="mt-5">
            <button
              type="button"
              onClick={() => void leave()}
              disabled={busy}
              className="focus-ring flex w-full items-center justify-center gap-2 rounded-tile bg-surface px-5 py-3.5 text-[14.5px] font-bold text-wrong ring-1 ring-wrong/35 transition-colors hover:bg-wrong-tint disabled:opacity-50"
            >
              <LogOut className="h-[17px] w-[17px]" strokeWidth={2.2} />
              {t(isLeader ? s.team.disband : s.team.leave)}
            </button>
          </motion.div>
        </>
      )}
    </motion.div>
  )
}
