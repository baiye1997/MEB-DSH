// Only consecutive coincident vertices are removed; the CAD boundary is not simplified.
export function cleanRing(points) {
  const ring=points.filter((point,i)=>i===0||Math.hypot(point[0]-points[i-1][0],point[1]-points[i-1][1])>1e-6);
  if(ring.length>1&&Math.hypot(ring[0][0]-ring.at(-1)[0],ring[0][1]-ring.at(-1)[1])<=1e-6)ring.pop();
  if(ring.length<3||ring.some(p=>p.some(x=>!Number.isFinite(x))))throw new Error('Invalid CAD ring');
  return ring;
}
