import { describe, it, expect } from 'vitest';
import { defaultProfileFrom } from '../../../src/types/profile';

describe('defaultProfileFrom', () => {
  it('prefers docker when the workflow defines it', () => {
    expect(defaultProfileFrom(['docker', 'standard'])).toBe('docker');
  });

  it('falls back to standard when docker is absent', () => {
    expect(defaultProfileFrom(['standard', 'test'])).toBe('standard');
  });

  it('falls back to the first profile when neither docker nor standard exist', () => {
    expect(defaultProfileFrom(['alpha', 'beta'])).toBe('alpha');
  });

  it('falls back to standard for an empty list', () => {
    expect(defaultProfileFrom([])).toBe('standard');
  });
});
