// Projection catalogue, classified three ways (CLAUDE.md §4):
//   prop    — distortion property: equalArea 等積 / equidistant 等距 / conformal 等角 / compromise 折衷 / perspective 透視(無)
//   light   — light-source position of perspective projections: gnomonic 心射 / stereographic 平射 / orthographic 正射
//   surface — developable surface: cylindrical 圓柱 / pseudocylindrical 擬圓柱 / conic 圓錐 / azimuthal 方位（平面）/ other 其他
import {
  geoEquirectangular, geoMercator, geoEqualEarth, geoNaturalEarth1, geoOrthographic, geoStereographic, geoGnomonic,
  geoAzimuthalEquidistant, geoAzimuthalEqualArea, geoConicEqualArea, geoConicConformal, geoConicEquidistant, geoProjection,
} from 'd3-geo';
import {
  geoRobinson, geoWinkel3, geoMollweide, geoMiller, geoCylindricalStereographic, geoCylindricalEqualArea, geoSinusoidal, geoEckert4,
} from 'd3-geo-projection';

// central cylindrical (心射圓柱): light at the earth's centre, cylinder tangent at the equator — y = tan φ
function centralCylindricalRaw(l, p) { return [l, Math.tan(p)]; }
centralCylindricalRaw.invert = (x, y) => [x, Math.atan(y)];
const geoCentralCylindrical = () => geoProjection(centralCylindricalRaw);

// limits used where the projection has no finite edge (fit / scrolling limits)
const LAT80 = [-80, 80], LAT70 = [-70, 75];

export const PROJ = {
  globe:            { prop: 'perspective', light: 'orthographic', surface: 'azimuthal', globe: true },
  equirect:         { make: geoEquirectangular, prop: 'equidistant', surface: 'cylindrical' },
  mercator:         { make: geoMercator, prop: 'conformal', surface: 'cylindrical', lat: [-85, 85] },
  miller:           { make: geoMiller, prop: 'compromise', surface: 'cylindrical' },
  gallStereo:       { make: () => geoCylindricalStereographic().parallel(45), prop: 'compromise', light: 'stereographic', surface: 'cylindrical' },
  centralCyl:       { make: geoCentralCylindrical, prop: 'perspective', light: 'gnomonic', surface: 'cylindrical', lat: LAT70 },
  lambertCyl:       { make: () => geoCylindricalEqualArea().parallel(0), prop: 'equalArea', light: 'orthographic', surface: 'cylindrical' },
  gallPeters:       { make: () => geoCylindricalEqualArea().parallel(45), prop: 'equalArea', surface: 'cylindrical' },
  robinson:         { make: geoRobinson, prop: 'compromise', surface: 'pseudocylindrical' },
  naturalEarth:     { make: geoNaturalEarth1, prop: 'compromise', surface: 'pseudocylindrical' },
  equalEarth:       { make: geoEqualEarth, prop: 'equalArea', surface: 'pseudocylindrical' },
  mollweide:        { make: geoMollweide, prop: 'equalArea', surface: 'pseudocylindrical' },
  sinusoidal:       { make: geoSinusoidal, prop: 'equalArea', surface: 'pseudocylindrical' },
  eckert4:          { make: geoEckert4, prop: 'equalArea', surface: 'pseudocylindrical' },
  winkel3:          { make: geoWinkel3, prop: 'compromise', surface: 'other' },
  albers:           { make: () => geoConicEqualArea().parallels([20, 50]), prop: 'equalArea', surface: 'conic' },
  lambertConic:     { make: () => geoConicConformal().parallels([30, 60]), prop: 'conformal', surface: 'conic', lat: [-30, 85] },
  conicEquidistant: { make: () => geoConicEquidistant().parallels([20, 60]), prop: 'equidistant', surface: 'conic' },
  orthographic:     { make: geoOrthographic, prop: 'perspective', light: 'orthographic', surface: 'azimuthal', clip: 90 },
  stereographic:    { make: geoStereographic, prop: 'conformal', light: 'stereographic', surface: 'azimuthal', clip: 120 },
  gnomonic:         { make: geoGnomonic, prop: 'perspective', light: 'gnomonic', surface: 'azimuthal', clip: 60 },
  azEquidistant:    { make: geoAzimuthalEquidistant, prop: 'equidistant', surface: 'azimuthal', clip: 179.5 },
  azEqualArea:      { make: geoAzimuthalEqualArea, prop: 'equalArea', surface: 'azimuthal', clip: 179.5 },
};
for (const p of Object.values(PROJ)) if (!p.lat && (p.light === 'gnomonic' || p.prop === 'conformal') && p.surface !== 'azimuthal') p.lat = LAT80;

export const CLASSIFY = {
  prop: ['equalArea', 'equidistant', 'conformal', 'compromise', 'perspective'],
  light: ['gnomonic', 'stereographic', 'orthographic', 'none'],
  surface: ['cylindrical', 'pseudocylindrical', 'conic', 'azimuthal', 'other'],
};

// projections grouped for the <select>, under the chosen classification
export function grouped(by) {
  const groups = CLASSIFY[by].map(k => ({ key: k, ids: [] }));
  for (const [id, p] of Object.entries(PROJ)) {
    const k = (by === 'light' ? p.light || 'none' : p[by]);
    groups.find(g => g.key === k)?.ids.push(id);
  }
  return groups.filter(g => g.ids.length);
}
