import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { loadTranslation } from './utils/translations';
import { LANGUAGE_CODES, LanguageCode } from './types';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

// Preload the saved interface language so non-English users never see an English flash.
const savedLanguage = ((): LanguageCode => {
  try {
    const lang = JSON.parse(localStorage.getItem('penko-settings') || '{}').language;
    return LANGUAGE_CODES.includes(lang) ? lang : 'en';
  } catch {
    return 'en';
  }
})();

const render = () =>
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

if (savedLanguage === 'en') render();
else loadTranslation(savedLanguage).finally(render);
