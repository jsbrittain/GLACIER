import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { resolvedLanguage: 'en' }
  })
}));

vi.mock('i18next', () => ({ use: () => ({ init: () => {} }) }));
vi.mock('i18next-browser-languagedetector', () => ({}));
vi.mock('i18next-resources-to-backend', () => ({}));
