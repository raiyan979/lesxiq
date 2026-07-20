import { describe, it, expect } from 'vitest';
import {
  mulberry32,
  shuffle,
  pickDistractors,
  generateVocabMc,
  generateMatch,
  makeCloze,
  generateExercisesForUnit,
} from './exercises';
import type { UnitDef, VocabDef, SentenceDef } from '../curriculum/types';

const vocab = (lemma_fr: string, translation_en: string): VocabDef => ({
  lemma_fr,
  translation_en,
});
const sentence = (text_fr: string, text_en: string): SentenceDef => ({
  text_fr,
  text_en,
});

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('differs across seeds', () => {
    expect(mulberry32(1)()).not.toEqual(mulberry32(2)());
  });
});

describe('shuffle', () => {
  it('is a deterministic permutation preserving elements', () => {
    const input = [1, 2, 3, 4, 5];
    const out1 = shuffle(input, mulberry32(7));
    const out2 = shuffle(input, mulberry32(7));
    expect(out1).toEqual(out2);
    expect([...out1].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5]); // input not mutated
  });
});

describe('pickDistractors', () => {
  it('excludes the target and returns n items', () => {
    const pool = ['a', 'b', 'c', 'd', 'e'];
    const picked = pickDistractors('a', pool, 3, mulberry32(3));
    expect(picked).toHaveLength(3);
    expect(picked).not.toContain('a');
  });
  it('returns fewer than n if the pool is small', () => {
    expect(pickDistractors('a', ['a', 'b'], 3, mulberry32(1))).toEqual(['b']);
  });
});

describe('generateVocabMc', () => {
  it('builds an en_fr MC with 3 distractors and the correct answer', () => {
    const target = vocab('chien', 'dog');
    const others = [vocab('chat', 'cat'), vocab('oiseau', 'bird'), vocab('poisson', 'fish'), vocab('cheval', 'horse')];
    const ex = generateVocabMc(target, [target, ...others], mulberry32(5));
    expect(ex.type).toBe('mc');
    expect(ex.direction).toBe('en_fr');
    expect(ex.prompt).toBe('dog');
    expect(ex.answer).toBe('chien');
    expect(ex.distractors).toHaveLength(3);
    expect(ex.distractors).not.toContain('chien');
  });
});

describe('generateMatch', () => {
  it('encodes fr/en pairs as JSON in answer', () => {
    const group = [vocab('chien', 'dog'), vocab('chat', 'cat')];
    const ex = generateMatch(group);
    expect(ex.type).toBe('match');
    expect(JSON.parse(ex.answer)).toEqual([
      { fr: 'chien', en: 'dog' },
      { fr: 'chat', en: 'cat' },
    ]);
  });
});

describe('makeCloze', () => {
  it('blanks a unit vocab word when present', () => {
    const s = sentence('Je mange une pomme.', 'I eat an apple.');
    const cloze = makeCloze(s, new Set(['pomme']), mulberry32(1));
    expect(cloze).not.toBeNull();
    expect(cloze!.type).toBe('cloze');
    expect(cloze!.answer).toBe('pomme');
    expect(cloze!.prompt).toContain('____');
    expect(cloze!.prompt).not.toContain('pomme');
    // trailing punctuation preserved on the blank
    expect(cloze!.prompt).toBe('Je mange une ____.');
  });

  it('falls back to the longest content word when no vocab matches', () => {
    const s = sentence('Il regarde la télévision.', 'He watches television.');
    const cloze = makeCloze(s, new Set(), mulberry32(1));
    expect(cloze).not.toBeNull();
    expect(cloze!.answer).toBe('télévision');
  });

  it('returns null when only function words are present', () => {
    const s = sentence('Il y a.', 'There is.');
    expect(makeCloze(s, new Set(), mulberry32(1))).toBeNull();
  });
});

describe('generateExercisesForUnit', () => {
  const unit: UnitDef = {
    level: 'A1',
    slug: 'test',
    title_en: 'Test',
    title_fr: 'Test',
    theme: 'test',
    grammar_focus: 'test',
    description: 'test',
    lessons: [],
    vocab: [
      vocab('chien', 'dog'), vocab('chat', 'cat'), vocab('oiseau', 'bird'),
      vocab('poisson', 'fish'), vocab('cheval', 'horse'), vocab('lapin', 'rabbit'),
    ],
    sentences: [
      sentence('Le chien mange.', 'The dog eats.'),
      sentence('Le chat dort tranquillement.', 'The cat sleeps quietly.'),
      sentence('Un oiseau vole haut.', 'A bird flies high.'),
      sentence('Le cheval court vite.', 'The horse runs fast.'),
      sentence('Le poisson nage.', 'The fish swims.'),
      sentence('Le lapin saute.', 'The rabbit jumps.'),
      sentence('Un chien aboie fort.', 'A dog barks loudly.'),
    ],
  };

  it('is deterministic for a fixed seed', () => {
    expect(generateExercisesForUnit(unit, 99)).toEqual(
      generateExercisesForUnit(unit, 99),
    );
  });

  it('produces a spread of exercise types including all six where possible', () => {
    const ex = generateExercisesForUnit(unit, 99);
    const types = new Set(ex.map((e) => e.type));
    for (const t of ['mc', 'match', 'cloze', 'typed_translation', 'word_order', 'listening_dictation']) {
      expect(types.has(t as never)).toBe(true);
    }
    expect(ex.length).toBeGreaterThanOrEqual(10);
  });
});
