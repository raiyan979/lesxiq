/*
 * The full authored curriculum, in display order. Units get their order_index
 * (within a level) from their position here; the seed builder assigns ids.
 */

import type { UnitDef } from './types';
import { a1Units } from './a1';
import { a2Units } from './a2';

// B1 units are appended as they are authored.
export const curriculum: UnitDef[] = [...a1Units, ...a2Units];
