// Camera state is a local view preference, never project/business data.
export function validViewState(value) {
  if (!value || value.version !== 1 || !['position','target'].every(key =>
    Array.isArray(value[key]) && value[key].length === 3 && value[key].every(n => Number.isFinite(n) && Math.abs(n) < 100000))) return null;
  if (!Number.isFinite(value.zoom) || value.zoom < .55 || value.zoom > 4) return null;
  const distance=Math.hypot(...value.position.map((n,i)=>n-value.target[i]));
  if(distance<1 || distance>1400)return null;
  return {version:1,position:[...value.position],target:[...value.target],zoom:value.zoom};
}
