import { describe, expect, it } from 'vitest';
import { icdMatchesRequirement } from '../content/cds/engine.js';

describe('CDS ICD requirement matching', () => {
  it('matches exact ICD codes inside same-letter ranges', () => {
    expect(icdMatchesRequirement('N40', 'N40-N41')).toBe(true);
    expect(icdMatchesRequirement('N41', 'N40-N41')).toBe(true);
    expect(icdMatchesRequirement('N42', 'N40-N41')).toBe(false);
  });

  it('keeps prefix matching for non-range requirements', () => {
    expect(icdMatchesRequirement('R33.9', 'R33')).toBe(true);
    expect(icdMatchesRequirement('R30', 'R33')).toBe(false);
  });

  it('matches decimal ranges inclusively', () => {
    expect(icdMatchesRequirement('E78.2', 'E78.0-E78.5')).toBe(true);
    expect(icdMatchesRequirement('E78.9', 'E78.0-E78.5')).toBe(false);
  });
});
