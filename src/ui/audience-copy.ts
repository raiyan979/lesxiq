/*
 * Audience-specific English wording. In 'child' mode the chapter names and a few
 * headings soften into plainer language for under-12s; everything else (and all
 * French content) is identical. Pure lookups — no store access — so they're
 * trivially testable and the caller passes the current audience in.
 */

/**
 * The wording register. Defined here (a plain module) rather than in the rune-
 * based store so pure consumers/tests can import it without pulling in Svelte.
 */
export type Audience = 'adult' | 'child';

/** Child-friendly chapter names, keyed by unit slug. Missing slug → adult title. */
const CHILD_UNIT_TITLES: Record<string, string> = {
  // A1
  'a1-greetings': 'Say Hello!',
  'a1-introductions': 'All About Me',
  'a1-numbers': "Let's Count! (0–20)",
  'a1-articles': 'Le or La?',
  'a1-er-verbs': 'Doing Things',
  'a1-family': 'My Family',
  'a1-food': 'Yummy Food & Drinks',
  'a1-days': 'Days & Months',
  'a1-questions': 'Who? What? Where?',
  'a1-colours': 'Colours & Describing',
  'a1-house': 'My House',
  'a1-time': 'Telling Time',
  'a1-weather': 'Sun, Rain & Seasons',
  'a1-clothing': 'Getting Dressed',
  'a1-body': 'My Body',
  'a1-directions': 'Around Town',
  'a1-hobbies': 'Fun & Games',
  'a1-shopping': 'Going Shopping',
  // A2
  'a2-passe-compose-avoir': 'Talking About Yesterday',
  'a2-passe-compose-etre': 'More About the Past',
  'a2-imparfait': 'When I Was Little',
  'a2-futur-proche': 'What Happens Next',
  'a2-daily-routine': 'My Daily Routine',
  'a2-object-pronouns': 'Little Words: him, her, them',
  'a2-negation': 'Saying No, Never & Nothing',
  'a2-comparatives': 'Bigger, Smaller, Same',
  'a2-travel-transport': 'Trains, Planes & Trips',
  'a2-restaurant': 'Eating Out',
  'a2-quantities': 'How Much? How Many?',
  'a2-health': 'Feeling Sick & Better',
  'a2-y-en': 'Two Tiny Words: y & en',
  'a2-connectors': 'Joining Words',
};

/** App headings/captions that soften in child mode. */
const UI_COPY = {
  learnHeading: { adult: 'Learn', child: "Let's Learn!" },
  learnSub: {
    adult: 'Work through the CEFR curriculum, one unit at a time.',
    child: 'Pick a chapter and start playing!',
  },
  levelA1: { adult: 'Beginner', child: 'Just Starting' },
  levelA2: { adult: 'Elementary', child: 'Getting Better' },
  levelB1: { adult: 'Intermediate', child: 'Leveling Up' },
  dashboardSub: { adult: "Here's where you left off.", child: 'Ready for more fun?' },
} as const;

export type CopyKey = keyof typeof UI_COPY;

/** The chapter name for a unit in the current audience's register. */
export function unitTitle(aud: Audience, slug: string, adultTitle: string): string {
  if (aud === 'child') return CHILD_UNIT_TITLES[slug] ?? adultTitle;
  return adultTitle;
}

/** A fixed UI string in the current audience's register. */
export function copy(aud: Audience, key: CopyKey): string {
  return UI_COPY[key][aud];
}
