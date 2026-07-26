/*
 * Reactive study-status store for the top status bar (streak / due / new / XP).
 * A single shared instance; call refresh() after anything that changes progress
 * (a graded review, a completed session) and the status bar updates live.
 */

import { getStudyStatus } from '../db/queries';

class Stats {
  streakDays = $state(0);
  due = $state(0);
  newDone = $state(0);
  newTarget = $state(15);
  xp = $state(0);
  loaded = $state(false);

  async refresh(): Promise<void> {
    try {
      const s = await getStudyStatus();
      this.streakDays = s.streakDays;
      this.due = s.due;
      this.newDone = s.newDone;
      this.newTarget = s.newTarget;
      this.xp = s.xp;
      this.loaded = true;
    } catch {
      // Status bar is non-critical; leave the last known values on failure.
    }
  }
}

export const stats = new Stats();
