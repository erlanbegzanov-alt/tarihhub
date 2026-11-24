import type { SchoolVariant } from '../types'
import { v93002 } from './v93002'
import { v93006 } from './v93006'
import { v93707 } from './v93707'
import { v93502 } from './v93502'
import { v93503 } from './v93503'
import { v93504 } from './v93504'
import { v93506 } from './v93506'
import { v93709 } from './v93709'
import { v93710 } from './v93710'

/**
 * School mock booklets on the «Мектеп пробниктері» shelf, in shelf order.
 * Each file carries one booklet; where the booklets repeated one another, the
 * repeats were swapped for other tasks so each paper is its own.
 */
export const schoolVariants: SchoolVariant[] = [v93002, v93006, v93707, v93710, v93709, v93506, v93504, v93502, v93503]
