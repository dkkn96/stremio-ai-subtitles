// Stremio uses ISO 639-2 codes; aliases cover source-addon responses.
export const LANGUAGES = [
  ['eng', 'English', 'en'], ['hun', 'Hungarian', 'hu', 'magyar'],
  ['ita', 'Italian', 'it'], ['spa', 'Spanish', 'es'], ['fra', 'French', 'fr', 'fre'],
  ['deu', 'German', 'de', 'ger'], ['por', 'Portuguese', 'pt'], ['pol', 'Polish', 'pl'],
  ['ron', 'Romanian', 'ro', 'rum'], ['ces', 'Czech', 'cs', 'cze'],
  ['slk', 'Slovak', 'sk', 'slo'], ['hrv', 'Croatian', 'hr'], ['srp', 'Serbian', 'sr'],
  ['slv', 'Slovenian', 'sl'], ['nld', 'Dutch', 'nl', 'dut'], ['swe', 'Swedish', 'sv'],
  ['dan', 'Danish', 'da'], ['fin', 'Finnish', 'fi'], ['nor', 'Norwegian', 'no'],
  ['ell', 'Greek', 'el', 'gre'], ['tur', 'Turkish', 'tr'], ['ukr', 'Ukrainian', 'uk'],
  ['rus', 'Russian', 'ru'], ['ara', 'Arabic', 'ar'], ['heb', 'Hebrew', 'he'],
  ['hin', 'Hindi', 'hi'], ['jpn', 'Japanese', 'ja'], ['kor', 'Korean', 'ko'],
  ['zho', 'Chinese', 'zh', 'chi'],
].map(([code, name, ...aliases]) => ({ code, name, aliases: [code, name.toLowerCase(), ...aliases] }));
export function languageInfo(value) {
  const found = LANGUAGES.find(item => item.aliases.includes(String(value).toLowerCase()));
  if (!found) throw new Error('Unsupported language. Choose a code listed by npm run setup.');
  return found;
}
export function matchesLanguage(value, code) { return languageInfo(code).aliases.includes(String(value).toLowerCase()); }
