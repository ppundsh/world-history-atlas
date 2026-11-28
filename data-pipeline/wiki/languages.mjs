// The local-language Wikipedias: for each country mode, and for each country (ISO 3166-1 alpha-2) the editions in
// its own languages, most used first. Where a country has several, fetch-wikilinks.mjs takes the longest article.
export const LANG_OF_REGION = {
  china: ['zh'], prc: ['zh'], taiwan: ['zh'], japan: ['ja'], korea: ['ko'], vietnam: ['vi'], thailand: ['th'],
  philippines: ['tl', 'en'], indonesia: ['id'], india: ['hi', 'en'], iran: ['fa'], turkey: ['tr'], egypt: ['ar'],
  morocco: ['ar', 'fr'], russia: ['ru'], germany: ['de'], poland: ['pl'], italy: ['it'], spain: ['es'], france: ['fr'],
  uk: ['en'], usa: ['en'], mexico: ['es'], brazil: ['pt'], argentina: ['es'],
};
export const LANG_OF_COUNTRY = {
  AD: ['ca'], AE: ['ar'], AF: ['fa', 'ps'], AL: ['sq'], AM: ['hy'], AO: ['pt'], AR: ['es'], AT: ['de'], AU: ['en'],
  AZ: ['az'], BA: ['bs', 'sr', 'hr'], BD: ['bn'], BE: ['nl', 'fr', 'de'], BF: ['fr'], BG: ['bg'], BH: ['ar'], BI: ['fr'],
  BJ: ['fr'], BN: ['ms'], BO: ['es'], BR: ['pt'], BT: ['dz'], BW: ['en'], BY: ['be', 'ru'], CA: ['en', 'fr'], CD: ['fr'],
  CF: ['fr'], CG: ['fr'], CH: ['de', 'fr', 'it'], CI: ['fr'], CL: ['es'], CM: ['fr', 'en'], CN: ['zh'], CO: ['es'],
  CR: ['es'], CU: ['es'], CY: ['el', 'tr'], CZ: ['cs'], DE: ['de'], DJ: ['fr', 'ar'], DK: ['da'], DO: ['es'], DZ: ['ar', 'fr'],
  EC: ['es'], EE: ['et'], EG: ['ar'], ER: ['ti', 'ar'], ES: ['es', 'ca', 'eu', 'gl'], ET: ['am'], FI: ['fi', 'sv'], FJ: ['en'],
  FR: ['fr'], GA: ['fr'], GB: ['en'], GE: ['ka'], GH: ['en'], GN: ['fr'], GR: ['el'], GT: ['es'], HK: ['zh', 'zh-yue'],
  HN: ['es'], HR: ['hr'], HT: ['fr', 'ht'], HU: ['hu'], ID: ['id'], IE: ['en', 'ga'], IL: ['he'], IN: ['hi', 'en'], IQ: ['ar'],
  IR: ['fa'], IS: ['is'], IT: ['it'], JM: ['en'], JO: ['ar'], JP: ['ja'], KE: ['sw', 'en'], KG: ['ky', 'ru'], KH: ['km'],
  KP: ['ko'], KR: ['ko'], KW: ['ar'], KZ: ['kk', 'ru'], LA: ['lo'], LB: ['ar'], LK: ['si', 'ta'], LR: ['en'], LT: ['lt'],
  LU: ['lb', 'fr', 'de'], LV: ['lv'], LY: ['ar'], MA: ['ar', 'fr'], MD: ['ro'], ME: ['sr'], MG: ['mg', 'fr'], MK: ['mk'],
  ML: ['fr'], MM: ['my'], MN: ['mn'], MO: ['zh', 'pt'], MR: ['ar'], MT: ['mt', 'en'], MU: ['en', 'fr'], MV: ['dv'],
  MW: ['en'], MX: ['es'], MY: ['ms'], MZ: ['pt'], NA: ['en', 'af'], NE: ['fr'], NG: ['en'], NI: ['es'], NL: ['nl'], NO: ['no', 'nn'],
  NP: ['ne'], NZ: ['en', 'mi'], OM: ['ar'], PA: ['es'], PE: ['es'], PG: ['en'], PH: ['tl', 'en'], PK: ['ur', 'en'], PL: ['pl'],
  PR: ['es'], PS: ['ar'], PT: ['pt'], PY: ['es'], QA: ['ar'], RO: ['ro'], RS: ['sr'], RU: ['ru'], RW: ['rw', 'fr'],
  SA: ['ar'], SD: ['ar'], SE: ['sv'], SG: ['en', 'ms', 'zh'], SI: ['sl'], SK: ['sk'], SL: ['en'], SN: ['fr'], SO: ['so'],
  SS: ['en'], SV: ['es'], SY: ['ar'], TD: ['fr', 'ar'], TG: ['fr'], TH: ['th'], TJ: ['tg'], TL: ['pt'], TM: ['tk'], TN: ['ar', 'fr'],
  TR: ['tr'], TW: ['zh'], TZ: ['sw'], UA: ['uk'], UG: ['en'], US: ['en'], UY: ['es'], UZ: ['uz'], VA: ['it', 'la'], VE: ['es'],
  VN: ['vi'], YE: ['ar'], ZA: ['en', 'af'], ZM: ['en'], ZW: ['en'],
};
