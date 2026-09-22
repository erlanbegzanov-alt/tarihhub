/**
 * Fisher–Yates shuffle — doesn't mutate the input.
 *
 * `random` exists so a caller can be tested: an exam variant has to be checked
 * for its A/B/C difficulty proportion, and that is not something to assert
 * against `Math.random`. Every other caller passes no second argument.
 */
export function shuffled<T>(items: T[], random: () => number = Math.random): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
