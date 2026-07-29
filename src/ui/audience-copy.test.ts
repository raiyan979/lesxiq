import { describe, it, expect } from 'vitest';
import { unitTitle, copy } from './audience-copy';

describe('audience-copy', () => {
  it('returns the adult title unchanged in adult mode', () => {
    expect(unitTitle('adult', 'a2-imparfait', "The Imperfect: L'imparfait")).toBe(
      "The Imperfect: L'imparfait",
    );
  });

  it('swaps to the child chapter name in child mode', () => {
    expect(unitTitle('child', 'a2-imparfait', "The Imperfect: L'imparfait")).toBe(
      'When I Was Little',
    );
  });

  it('falls back to the adult title for an unknown slug', () => {
    expect(unitTitle('child', 'b1-future-unwritten', 'Some New Unit')).toBe('Some New Unit');
  });

  it('every A1/A2 slug has a child title (so child mode is never half-translated)', () => {
    // A representative spread; the map should cover all shipped slugs.
    for (const slug of ['a1-greetings', 'a1-numbers', 'a2-object-pronouns', 'a2-connectors']) {
      expect(unitTitle('child', slug, 'FALLBACK')).not.toBe('FALLBACK');
    }
  });

  it('picks the register-appropriate UI copy', () => {
    expect(copy('adult', 'learnHeading')).toBe('Learn');
    expect(copy('child', 'learnHeading')).toBe("Let's Learn!");
    expect(copy('adult', 'levelA1')).toBe('Beginner');
    expect(copy('child', 'levelA1')).toBe('Just Starting');
  });
});
