import { describe, it, expect } from 'vitest';
import {
  parseSentenceLine,
  parseLinkLine,
  isWordCountInRange,
  normalizeForDedup,
} from './tatoeba';

describe('parseSentenceLine', () => {
  it('parses a well-formed id/lang/text line', () => {
    expect(parseSentenceLine('1279\tfra\tJe ne supporte pas ce type.')).toEqual({
      id: 1279,
      text: 'Je ne supporte pas ce type.',
    });
  });
  it('rejects lines with too few columns', () => {
    expect(parseSentenceLine('1279\tfra')).toBeNull();
  });
  it('rejects a non-numeric id', () => {
    expect(parseSentenceLine('abc\tfra\tBonjour')).toBeNull();
  });
  it('rejects an empty text', () => {
    expect(parseSentenceLine('12\tfra\t   ')).toBeNull();
  });
});

describe('parseLinkLine', () => {
  it('parses id1/id2', () => {
    expect(parseLinkLine('1115\t1276')).toEqual([1115, 1276]);
  });
  it('rejects malformed lines', () => {
    expect(parseLinkLine('1115')).toBeNull();
    expect(parseLinkLine('1115\tx')).toBeNull();
  });
});

describe('isWordCountInRange', () => {
  it('keeps sentences within [3,12]', () => {
    expect(isWordCountInRange('Je mange une pomme', 3, 12)).toBe(true);
    expect(isWordCountInRange('Salut ça va', 3, 12)).toBe(true);
  });
  it('drops too-short and too-long sentences', () => {
    expect(isWordCountInRange('Bonjour', 3, 12)).toBe(false);
    expect(isWordCountInRange('un '.repeat(13).trim(), 3, 12)).toBe(false);
  });
});

describe('normalizeForDedup', () => {
  it('collapses case, whitespace and trailing punctuation', () => {
    expect(normalizeForDedup('  Je   mange une POMME !! ')).toBe('je mange une pomme');
  });
  it('treats punctuation-only differences as duplicates', () => {
    expect(normalizeForDedup('Bonjour le monde.')).toBe(
      normalizeForDedup('bonjour le monde'),
    );
  });
  it('keeps internal punctuation', () => {
    expect(normalizeForDedup("J'ai faim, vraiment.")).toBe("j'ai faim, vraiment");
  });
});
