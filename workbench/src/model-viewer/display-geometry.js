import clipping from 'polygon-clipping';
import {cleanRing} from './geometry.js';
// Display-only solid union: taller mass owns overlapping volume. Source CAD stays intact.
export function displayFootprint(building, buildings) {
  const ring=cleanRing(building.polygon);
  const higher=buildings.filter(b=>b.id!==building.id&&b.height>building.height);
  const overlaps=higher.filter(b=>clipping.intersection([ring],[cleanRing(b.polygon)]).length);
  return overlaps.length ? clipping.difference([ring],...overlaps.map(b=>[cleanRing(b.polygon)])) : [[ring]];
}
