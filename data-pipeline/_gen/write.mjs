// Writes a regional mode's tables from a JSON description (used to set up the new regional modes):
//   node data-pipeline/_gen/write.mjs <region> <spec.json>
// spec: { title, factions: [[id, colour, zh-Hant, en, ja]], control: [[ym, units, faction]], governments: [[id, a, b, lon, lat, main, faction, zh-Hant, en, ja]],
//         events: [[ym, zh-Hant, en, ja, lon, lat]], flows: [...9 cols], local: [...13 cols], infra: [...13 cols],
//         divisions: [[id, colour, zh-Hant, en, ja]], admin: [[ym, units, division]], region: {...region.json}, headers: {file: comment} }
import fs from 'node:fs'; import path from 'node:path'; import * as OpenCC from 'opencc-js';
const toHans = OpenCC.Converter({ from: 'tw', to: 'cn' });
const [region, specFile] = process.argv.slice(2);
const S = JSON.parse(fs.readFileSync(specFile, 'utf8'));
const dir = path.join('data-pipeline', region); fs.mkdirSync(dir, { recursive: true });
const T = S.title;
const w = (f, head, rows) => fs.writeFileSync(path.join(dir, f), head + '\n' + rows.map(r => r.join('\t')).join('\n') + '\n');
const H = S.headers || {};
w('factions.tsv', `# ${T}模式：統治勢力。欄位：id\t顏色\t繁中\t簡中\tEnglish\t日本語`, S.factions.map(([id, c, h, e, j]) => [id, c, h, toHans(h), e, j]));
w('control.tsv', `# ${T}模式：各單元實際控制者（逐月）。欄位：年月\t單元或群組\t控制者[/部分地區被另一勢力控制]` + (H.control ? '\n# ' + H.control : ''), S.control);
w('governments.tsv', `# ${T}模式：統治中心（★）。欄位：id\t起\t迄\t經度\t緯度\t是否為主要政權(1/0)\t勢力id\t繁中\t簡中\tEnglish\t日本語`, S.governments.map(([id, a, b, lon, lat, m, f, h, e, j]) => [id, a, b, lon, lat, m, f, h, toHans(h), e, j]));
w('events.tsv', `# ${T}模式：大事記。欄位：年月\t繁中\tEnglish\t日本語\t[經度\t緯度]`, S.events);
if (S.flows?.length) w('flows.tsv', `# ${T}模式：行軍、戰線與遷徙。欄位：id\t起年月\t迄年月\t顏色\t粗細(1–3)\t路徑\t繁中\tEnglish\t日本語`, S.flows);
if (S.local?.length) w('local.tsv', `# ${T}模式：起義與叛亂（⚔）、地方勢力（◉）、外國駐軍（✪），各有開關，可點選。\n# 欄位：種類(feud|power|us)\tid\t起(年-月)\t迄(年-月)\t經度\t緯度\t繁中\tEnglish\t日本語\t說明（繁中）\t說明（English）\t說明（日本語）\t維基中文條目`, S.local);
if (S.infra?.length) w('infra.tsv', `# ${T}模式：重大建設（格式見 taiwan/infra.tsv）。路線為簡化示意；年代依各維基百科條目。`, S.infra.map(r => { const o = r.slice(); while (o.length < 13) o.push(''); return o; }));
if (S.divisions?.length) {
  w('divisions.tsv', `# ${T}模式：行政區劃。欄位：id\t顏色\t繁中\t簡中\tEnglish\t日本語`, S.divisions.map(([id, c, h, e, j]) => [id, c, h, toHans(h), e, j]));
  w('admin.tsv', `# ${T}模式：行政區劃（逐月）。欄位：年月\t單元\t行政區。以今日單元概略標示；當時不屬此國的單元以統治勢力著色。` + (H.admin ? '\n# ' + H.admin : ''), S.admin);
}
fs.writeFileSync(path.join(dir, 'region.json'), JSON.stringify(S.region, null, 1));
console.log(region, 'tables written');
