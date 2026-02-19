import { enGB, fr } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

export const localeMap = {
  en: enGB,
  fr: fr
};

export const getDateLocale = () => {
  const { i18n } = useTranslation();
  return localeMap[i18n.resolvedLanguage] ?? enGB;
};
