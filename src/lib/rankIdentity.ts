/**
 * The rank identity Profile.tsx already computes for its own screen — the
 * badge tier, title tier and title text a reader's XP and two independent
 * overrides (`displayedAvatarTier`, `displayedRankTier`) resolve to — pulled
 * out so Battle and Кахут can show exactly the same thing instead of each
 * re-deriving it. See `resolveDisplayedTier` in `src/screens/Profile.tsx` for
 * the sibling copy this must stay identical to.
 */
import type { AvatarGender } from '../data/ranks'
import { rankInfo, ranks } from '../data/ranks'
import type { LocalizedText } from '../data/types'
import { s } from '../i18n/strings'
import { OWNER_TIER_INDEX, OWNER_TITLE } from './rankStyle'

export interface RankIdentity {
  avatarGender: AvatarGender | null
  /** Resolved tier for the avatar art — may equal `OWNER_TIER_INDEX`. */
  avatarTierIndex: number
  /** Resolved tier for the title text — may equal `OWNER_TIER_INDEX`. */
  titleTierIndex: number
  /** `OWNER_TITLE`, the gendered rank title, or a neutral pick-a-gender fallback. */
  titleText: LocalizedText
}

/**
 * The title text for an already-resolved tier index — `OWNER_TITLE` at the
 * owner tier, the gendered rank title at any real tier, or the neutral
 * pick-a-gender fallback when there is no gender to read a title off. Used
 * both to resolve a fresh identity below and to re-derive display text from a
 * tier index a Firestore mirror (`BattlePlayer`, `KahootPlayer`) already
 * stored, without re-running the XP resolution that produced it.
 */
export function rankTitleText(
  avatarGender: AvatarGender | null,
  tierIndex: number,
): LocalizedText {
  if (tierIndex === OWNER_TIER_INDEX) return OWNER_TITLE
  return avatarGender ? ranks[tierIndex].title[avatarGender] : s.profile.rankPickTitle
}

/**
 * Resolves both independent tier choices the same defensive way Profile.tsx
 * does: a chosen tier only counts if it is one this account can actually
 * claim — an earned tier, or the owner tier for the owner — otherwise it
 * degrades to the tier the real XP has reached.
 */
export function resolveRankIdentity(params: {
  xp: number
  avatarGender: AvatarGender | null
  displayedAvatarTier: number | null
  displayedRankTier: number | null
  isOwner: boolean
}): RankIdentity {
  const { xp, avatarGender, displayedAvatarTier, displayedRankTier, isOwner } = params
  const realTierIndex = avatarGender ? rankInfo(xp, avatarGender).tierIndex : 0

  const resolveTier = (chosen: number | null): number => {
    if (chosen === null) return realTierIndex
    if (chosen === OWNER_TIER_INDEX) return isOwner ? chosen : realTierIndex
    return chosen <= realTierIndex ? chosen : realTierIndex
  }

  const avatarTierIndex = resolveTier(displayedAvatarTier)
  const titleTierIndex = resolveTier(displayedRankTier)

  return {
    avatarGender,
    avatarTierIndex,
    titleTierIndex,
    titleText: rankTitleText(avatarGender, titleTierIndex),
  }
}
