/*
  Script: find-missing-translation-keys.js
  ---------------------------------------
  Compares the English ("en") and Spanish ("es") resource trees defined in packages/ui/src/i18n.js
  and prints out:
    • Keys that exist in English but not in Spanish (missing translations)
    • Keys that exist in Spanish but not in English (orphan translations)

  Usage:
    node scripts/find-missing-translation-keys.js
*/

const path = require('path');
// Simple color helpers (no external dependency)
const green = (s) => s;
const red = (s) => s;
const yellow = (s) => s;
const cyan = (s) => s;

// Resolve path to the i18n instance
const i18nPath = path.resolve(__dirname, '..', 'packages', 'ui', 'src', 'i18n.js');

let i18n;
try {
  i18n = require(i18nPath).default || require(i18nPath);
} catch (err) {
  console.error(red(`Failed to load i18n from ${i18nPath}`));
  console.error(err);
  process.exit(1);
}

function getTranslations(lang) {
  // i18next stores translations after init inside the resource store
  if (typeof i18n.getDataByLanguage === 'function') {
    const data = i18n.getDataByLanguage(lang);
    return data ? data.translation : {};
  }
  // Fallback to options.resources
  return (i18n.options && i18n.options.resources && i18n.options.resources[lang] && i18n.options.resources[lang].translation) || {};
}

const en = getTranslations('en');
const es = getTranslations('es');

function flatten(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      Object.assign(result, flatten(value, newKey));
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

const flatEn = flatten(en);
const flatEs = flatten(es);

const missingInEs = Object.keys(flatEn).filter((k) => !(k in flatEs));
const extraInEs = Object.keys(flatEs).filter((k) => !(k in flatEn));
const untranslated = Object.keys(flatEn).filter((k) => k in flatEs && flatEn[k] === flatEs[k]);

if (missingInEs.length === 0 && extraInEs.length === 0 && untranslated.length === 0) {
  console.log(green('🎉 No missing or extra keys! Spanish translations are complete.'));
  process.exit(0);
}

if (missingInEs.length) {
  console.log(yellow('⚠️  Keys missing in Spanish (need translation):'));
  missingInEs.forEach((k) => console.log(`  - ${k}`));
}

if (extraInEs.length) {
  console.log('\n' + cyan('ℹ️  Keys present in Spanish but not in English (possibly obsolete):'));
  extraInEs.forEach((k) => console.log(`  - ${k}`));
}

if (untranslated.length) {
  console.log('\n' + yellow('⚠️  Keys whose Spanish value is identical to English (probably need translation):'));
  untranslated.forEach((k) => console.log(`  - ${k}`));
}