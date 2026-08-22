/**
 * The duel, on its own page (`/battle/casual/duel`, `/battle/ranked/duel`).
 *
 * The duel used to be mounted inline under each mode screen's stats, league
 * card, history list and weekly board — everything a reader wants *before* and
 * *after* a duel, sitting around the one thing they want nothing beside. This
 * screen carries the duel and nothing else: a header to get back out, and
 * `BattleDuel` itself, which starts searching the moment it mounts because the
 * decision to search was already made on the screen that navigated here.
 *
 * Leaving returns to that mode screen, which refetches on mount — so the record
 * and the history already include the duel just played, with no manual reload.
 */
import { Trophy, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KahootHeader } from '../components/kahoot'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { fetchBattlePlayer, ratingTierFor } from '../lib/battle'
import type { BattleMode } from '../lib/battle'
import { staggerContainer, staggerItem } from '../lib/motion'
import { useSession } from '../lib/session'
import { BattleDuel } from './BattleDuel'

export function BattleDuelScreen({ mode }: { mode: BattleMode }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const uid = useSession().user?.uid ?? null
  const ranked = mode === 'ranked'
  const home = ranked ? '/battle/ranked' : '/battle/casual'

  // Ranked draws its round difficulties from the player's league, which lives
  // in `battlePlayers/*` rather than the local profile — so this screen fetches
  // it the same way the Рейтинг screen does, and refreshes it after a scored
  // duel so a rematch uses the league that duel just left the reader in.
  const [rating, setRating] = useState(0)
  const refreshRating = useCallback(() => {
    if (!ranked || !uid) return
    void fetchBattlePlayer(uid).then((player) => setRating(player?.rating ?? 0))
  }, [ranked, uid])

  useEffect(refreshRating, [refreshRating])

  const tierIndex = useMemo(() => ratingTierFor(rating).index, [rating])

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="mx-auto max-w-2xl lg:max-w-3xl"
    >
      <KahootHeader
        icon={
          ranked ? (
            <Trophy className="h-5 w-5" strokeWidth={2} />
          ) : (
            <Zap className="h-5 w-5" strokeWidth={2} />
          )
        }
        title={t(ranked ? s.battle.modeRanked : s.battle.modeCasual)}
        subtitle={t(s.battle.subtitle)}
        onBack={() => navigate(home)}
      />

      <motion.div variants={staggerItem} className="mt-5">
        <BattleDuel
          mode={mode}
          onExit={() => navigate(home)}
          onRankedResult={refreshRating}
          ratingTierIndex={ranked ? tierIndex : undefined}
        />
      </motion.div>
    </motion.div>
  )
}
