import { describe, it, expect } from 'vitest';
import { matchPath } from './match';

describe('matchPath', () => {
  it('matches the root path only against itself', () => {
    expect(matchPath('/', '/')).toEqual({});
    expect(matchPath('/', '/learn')).toBeNull();
  });

  it('matches static multi-segment patterns', () => {
    expect(matchPath('/learn', '/learn')).toEqual({});
    expect(matchPath('/learn', '/library')).toBeNull();
  });

  it('captures a single param', () => {
    expect(matchPath('/learn/:unitId', '/learn/3')).toEqual({ unitId: '3' });
  });

  it('captures nested params', () => {
    expect(matchPath('/learn/:unitId/lesson/:lessonId', '/learn/3/lesson/7')).toEqual({
      unitId: '3',
      lessonId: '7',
    });
  });

  it('rejects paths with a different segment count', () => {
    expect(matchPath('/learn/:unitId', '/learn')).toBeNull();
    expect(matchPath('/learn/:unitId', '/learn/3/extra')).toBeNull();
  });

  it('decodes URL-encoded param values', () => {
    expect(matchPath('/q/:term', '/q/caf%C3%A9')).toEqual({ term: 'café' });
  });
});
