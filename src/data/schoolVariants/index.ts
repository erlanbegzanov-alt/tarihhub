import type { SchoolVariant } from '../types'
import { v93002 } from './v93002'
import { v93006 } from './v93006'
import { v93707 } from './v93707'

/**
 * School mock booklets on the «Мектеп пробниктері» shelf, in shelf order.
 * Each file carries one booklet; where the three booklets repeated one
 * another, the repeats were swapped for other tasks so each paper is its own.
 */
export const schoolVariants: SchoolVariant[] = [v93002, v93006, v93707]
