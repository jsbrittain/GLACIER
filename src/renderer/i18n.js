import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';

import en_common from '../locales/en/translation.json';
import fr_common from '../locales/fr/translation.json';

i18next
  .use(initReactI18next)
  .use(LanguageDetector)
  .use(
    resourcesToBackend((lng, ns, cb) => {
      try {
        const table = lng === 'fr' ? fr_common : /* default */ en_common;
        cb(null, table);
      } catch (e) {
        cb(e, null);
      }
    })
  )
  .init({
    fallbackLng: 'en'
  });
