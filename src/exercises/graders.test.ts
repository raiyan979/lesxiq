import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  normalizeWord,
  gradeMc,
  gradeCloze,
  gradeTypedTranslation,
  gradeListeningDictation,
  gradeWordOrder,
  gradeMatch,
} from './graders';

describe('normalizeText', () => {
  it('lowercases, trims, collapses spaces and drops terminal punctuation', () => {
    expect(normalizeText('  Bonjour   le  monde !  ')).toBe('bonjour le monde');
  });
  it('unifies curly apostrophes but keeps accents', () => {
    expect(normalizeText('J’ai été')).toBe("j'ai été");
  });
});

describe('normalizeWord', () => {
  it('strips surrounding punctuation', () => {
    expect(normalizeWord('«chat»')).toBe('chat');
    expect(normalizeWord('(merci),')).toBe('merci');
  });
});

describe('gradeMc', () => {
  it('accepts the correct option regardless of case/spacing', () => {
    expect(gradeMc('bonjour', ' Bonjour ').correct).toBe(true);
  });
  it('rejects a wrong option', () => {
    expect(gradeMc('bonjour', 'salut').correct).toBe(false);
  });
});

describe('gradeCloze', () => {
  it('accepts the blanked word (case-insensitive) and accepted variants', () => {
    expect(gradeCloze('chat', ['chat'], 'Chat').correct).toBe(true);
    expect(gradeCloze('École', ['école'], 'école').correct).toBe(true);
  });
  it('rejects an empty or wrong answer', () => {
    expect(gradeCloze('chat', ['chat'], '   ').correct).toBe(false);
    expect(gradeCloze('chat', ['chat'], 'chien').correct).toBe(false);
  });
});

describe('gradeTypedTranslation', () => {
  it('accepts a matching sentence ignoring case, spacing and final punctuation', () => {
    expect(gradeTypedTranslation('Je suis étudiant.', null, 'je suis étudiant').correct).toBe(
      true,
    );
  });
  it('accepts a listed alternative', () => {
    expect(
      gradeTypedTranslation('je vais bien', ['ça va bien'], 'Ça va bien!').correct,
    ).toBe(true);
  });
  it('rejects when accents/words differ', () => {
    expect(gradeTypedTranslation('je suis étudiant', null, 'je suis etudiant').correct).toBe(
      false,
    );
    expect(gradeTypedTranslation('je suis étudiant', null, '').correct).toBe(false);
  });
});

describe('gradeListeningDictation', () => {
  it('grades like a typed translation', () => {
    expect(gradeListeningDictation('Bonjour', null, 'bonjour').correct).toBe(true);
    expect(gradeListeningDictation('Bonjour', null, 'bonsoir').correct).toBe(false);
  });
});

describe('gradeWordOrder', () => {
  it('accepts the tokens assembled into the target sentence', () => {
    expect(gradeWordOrder('je suis étudiant', null, ['je', 'suis', 'étudiant']).correct).toBe(
      true,
    );
  });
  it('rejects a wrong order', () => {
    expect(gradeWordOrder('je suis étudiant', null, ['suis', 'je', 'étudiant']).correct).toBe(
      false,
    );
  });
});

describe('gradeMatch', () => {
  const pairs = [
    { fr: 'chat', en: 'cat' },
    { fr: 'chien', en: 'dog' },
    { fr: 'oiseau', en: 'bird' },
  ];
  it('is correct only when every pair is matched', () => {
    const all = gradeMatch(pairs, { chat: 'cat', chien: 'dog', oiseau: 'bird' });
    expect(all.correct).toBe(true);
    expect(all.correctCount).toBe(3);
    expect(all.total).toBe(3);
  });
  it('reports partial progress and is not correct when some are wrong', () => {
    const partial = gradeMatch(pairs, { chat: 'cat', chien: 'bird', oiseau: 'dog' });
    expect(partial.correct).toBe(false);
    expect(partial.correctCount).toBe(1);
  });
  it('handles a missing selection', () => {
    const missing = gradeMatch(pairs, { chat: 'cat' });
    expect(missing.correct).toBe(false);
    expect(missing.correctCount).toBe(1);
  });
});
