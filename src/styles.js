// Visual styles for the four base maps. Fonts are system fonts (no web-font download).
const SERIF = '"Noto Serif TC","Noto Serif CJK TC","Songti TC","PMingLiU","Noto Serif SC","Songti SC","SimSun","Hiragino Mincho ProN","Yu Mincho",serif';
const SANS = '"Noto Sans TC","PingFang TC","Microsoft JhengHei","Noto Sans SC","PingFang SC","Microsoft YaHei","Hiragino Sans","Yu Gothic",system-ui,sans-serif';

export const BASEMAPS = {
  plain: {
    ocean: '#9fc5e3', land: '#f1ece0', lake: '#9fc5e3', river: 'rgba(80,130,180,0.55)',
    polityAlpha: 0.88, border: 'rgba(40,40,40,0.75)', borderW: 0.7, graticule: 'rgba(255,255,255,0.35)',
    label: { text: '#1d1d1d', halo: 'rgba(255,255,255,0.85)', font: SANS, weight: 600 },
  },
  physical: {
    ocean: '#a8cde6', bathy: { 200: '#93c0e0', 2000: '#78acd6', 4000: '#5f97c8', 6000: '#4a82b8' },
    land: '#e6dfc9', desert: '#eadba6', mountain: '#cbb994', plateau: '#d8cba8', tundra: '#dfe3d8', ice: '#f6f9fc',
    lake: '#93c0e0', river: 'rgba(60,110,170,0.6)',
    polityAlpha: 0.55, border: 'rgba(40,30,20,0.7)', borderW: 0.7, graticule: 'rgba(255,255,255,0.35)',
    label: { text: '#1a1a1a', halo: 'rgba(255,255,255,0.8)', font: SANS, weight: 600 },
  },
  antique: {
    ocean: '#cfc29a', land: '#efe2bd', lake: '#cfc29a', river: 'rgba(120,90,50,0.45)',
    polityAlpha: 0.42, border: 'rgba(90,55,25,0.85)', borderW: 0.9, graticule: 'rgba(110,80,40,0.25)',
    label: { text: '#3b2410', halo: 'rgba(245,233,200,0.85)', font: SERIF, weight: 700 },
    paper: true,
  },
  satellite: {
    ocean: '#0b2a4a', land: '#2f3d2a', lake: '#0b2a4a', river: 'rgba(120,170,220,0.4)',
    polityAlpha: 0.5, border: 'rgba(255,255,255,0.7)', borderW: 0.7, graticule: 'rgba(255,255,255,0.25)',
    label: { text: '#ffffff', halo: 'rgba(0,0,0,0.7)', font: SANS, weight: 600 },
    raster: true,
  },
};

export const FONTS = { SERIF, SANS };
