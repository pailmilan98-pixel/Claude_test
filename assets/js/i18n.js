const translations = {
  hu: {
    brand: 'AutoTan\u00e1csad\u00f3',
    set_api_key: 'API kulcs',
    hero_title: 'Tal\u00e1ld meg az \u00e1lomaut\u00f3d',
    hero_subtitle: 'AI-alap\u00fa tan\u00e1csad\u00e1s a legjobb aut\u00f3v\u00e1s\u00e1rl\u00e1si d\u00f6nt\u00e9shez',
    select_car: 'V\u00e1lassz aut\u00f3t',
    make: 'Gy\u00e1rtm\u00e1ny',
    model: 'Modell',
    type: 'T\u00edpus / Kivitel',
    select_make: '-- Gy\u00e1rtm\u00e1ny --',
    select_model: '-- Modell --',
    select_type: '-- T\u00edpus --',
    year_from: '\u00c9vj\u00e1ratt\u00f3l',
    year_to: '\u00c9vj\u00e1ratig',
    price_max: 'Max. \u00e1r (Ft)',
    km_max: 'Max. km',
    search: 'Hirdet\u00e9s keres\u00e9s',
    get_advice: 'AI tan\u00e1csad\u00e1s',
    ai_advice: 'AI Tan\u00e1csad\u00f3',
    loading_advice: 'Tan\u00e1csok gener\u00e1l\u00e1sa...',
    listings: 'Tal\u00e1latok',
    all: 'Mind',
    footer_disclaimer: 'Ez az oldal szem\u00e9lyes, t\u00e1j\u00e9koztat\u00f3 jelleg\u0171 seg\u00e9deszk\u00f6z. Az adatok naponta friss\u00fclnek.',
    api_key_title: 'Claude API Kulcs be\u00e1ll\u00edt\u00e1sa',
    api_key_desc: 'Add meg az Anthropic API kulcsodat. Csak a munkamenet idej\u00e9re t\u00e1rol\u00f3dik (sessionStorage).',
    save: 'Ment\u00e9s',
    cancel: 'M\u00e9gse',
    api_key_saved: 'API kulcs mentve!',
    api_key_missing: 'K\u00e9rj\u00fck add meg a Claude API kulcsodat!',
    no_results: 'Nincs tal\u00e1lat a megadott felt\u00e9telekre.',
    search_on: 'Keres\u00e9s az al\u00e1bbi oldalakon:',
    last_updated: 'Utols\u00f3 adatfriss\u00edt\u00e9s:',
    view_listing: 'Hirdet\u00e9s megtekint\u00e9se \u2192',
    advice_error: 'Hiba az AI tan\u00e1csad\u00e1s sor\u00e1n. Ellen\u0151rizze az API kulcsot.',
    catalog_error: 'Hiba az aut\u00f3katal\u00f3gus bet\u00f6lt\u00e9sekor.',
    results_count_hu: 'tal\u00e1lat',
    results_count_en: 'results'
  },
  en: {
    brand: 'CarAdvisor',
    set_api_key: 'API Key',
    hero_title: 'Find Your Dream Car',
    hero_subtitle: 'AI-powered advice for the best car buying decision',
    select_car: 'Select a Car',
    make: 'Make',
    model: 'Model',
    type: 'Type / Variant',
    select_make: '-- Make --',
    select_model: '-- Model --',
    select_type: '-- Type --',
    year_from: 'Year from',
    year_to: 'Year to',
    price_max: 'Max. price (HUF)',
    km_max: 'Max. km',
    search: 'Search Listings',
    get_advice: 'AI Advice',
    ai_advice: 'AI Car Advisor',
    loading_advice: 'Generating advice...',
    listings: 'Results',
    all: 'All',
    footer_disclaimer: 'This is a personal informational tool. Data is updated every 24 hours.',
    api_key_title: 'Set Claude API Key',
    api_key_desc: 'Enter your Anthropic API key. Stored only for the current session (sessionStorage).',
    save: 'Save',
    cancel: 'Cancel',
    api_key_saved: 'API key saved!',
    api_key_missing: 'Please enter your Claude API key first!',
    no_results: 'No results found for the selected criteria.',
    search_on: 'Search on these platforms:',
    last_updated: 'Last updated:',
    view_listing: 'View Listing \u2192',
    advice_error: 'Error generating AI advice. Please check your API key.',
    catalog_error: 'Error loading car catalog.',
    results_count_hu: 'tal\u00e1lat',
    results_count_en: 'results'
  }
};

let currentLang = 'hu';

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('lang-' + lang);
  if (btn) btn.classList.add('active');
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = translations[lang] && translations[lang][key];
    if (val) el.textContent = val;
  });
  document.querySelectorAll('[data-i18n-opt]').forEach(el => {
    const key = el.getAttribute('data-i18n-opt');
    const val = translations[lang] && translations[lang][key];
    if (val) el.textContent = val;
  });
  document.title = t('brand');
  if (typeof updateFooterDate === 'function') updateFooterDate();
}

function t(key) {
  return (translations[currentLang] && translations[currentLang][key])
    || (translations['hu'] && translations['hu'][key])
    || key;
}

document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('lang') || 'hu';
  setLanguage(saved);
});
