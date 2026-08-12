import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PersonRow } from '../components/PersonCard'
import { FilterChip, SearchField } from '../components/ui'
import { personCategories } from '../data/eras'
import { people } from '../data/people'
import type { PersonCategory } from '../data/types'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { staggerContainer, staggerItem } from '../lib/motion'

type Filter = PersonCategory | 'all'

export function Explore() {
  const { t, lang } = useLang()
  const [searchParams, setSearchParams] = useSearchParams()
  const [filter, setFilter] = useState<Filter>('all')
  const query = searchParams.get('q') ?? ''

  const setQuery = (value: string) => {
    setSearchParams(value ? { q: value } : {}, { replace: true })
  }

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return people.filter((person) => {
      if (filter !== 'all' && person.category !== filter) return false
      if (!needle) return true
      const haystack = [
        person.name[lang],
        person.role[lang],
        person.tagline[lang],
        person.eraBadge[lang],
        person.bio[lang],
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [query, filter, lang])

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <motion.div variants={staggerItem}>
        <h1 className="text-2xl font-bold tracking-tight text-ink md:text-[28px]">
          {t(s.explore.title)}
        </h1>
      </motion.div>

      <motion.div variants={staggerItem} className="mt-4 md:max-w-2xl">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder={t(s.explore.placeholder)}
        />
      </motion.div>

      <motion.div
        variants={staggerItem}
        className="rail-scroll -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6 md:mx-0 md:flex-wrap md:px-0"
      >
        <FilterChip
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          layoutGroup="explore-filter"
        >
          {t(s.common.all)}
        </FilterChip>
        {personCategories.map((category) => (
          <FilterChip
            key={category.key}
            active={filter === category.key}
            onClick={() => setFilter(category.key)}
            layoutGroup="explore-filter"
          >
            {t(category.label)}
          </FilterChip>
        ))}
      </motion.div>

      <motion.p
        variants={staggerItem}
        className="mt-5 text-[13px] font-medium text-ink-faint"
      >
        {results.length} {t(s.explore.resultsFound)}
      </motion.p>

      {results.length === 0 ? (
        <motion.div
          variants={staggerItem}
          className="mt-6 rounded-card bg-surface p-10 text-center shadow-soft ring-1 ring-line/60"
        >
          <p className="text-[15px] font-semibold text-ink">{t(s.common.notFound)}</p>
          <p className="mt-1.5 text-[13.5px] text-ink-faint">
            {t(s.common.notFoundHint)}
          </p>
        </motion.div>
      ) : (
        <motion.ul
          key={`${filter}-${query}`}
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="mt-3 grid gap-2.5 lg:grid-cols-2 xl:gap-3"
        >
          {results.map((person) => (
            <li key={person.id}>
              <PersonRow person={person} />
            </li>
          ))}
        </motion.ul>
      )}
    </motion.div>
  )
}
