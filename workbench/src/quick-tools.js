import {multiplyMoney} from './business.js';
export const quickSpecs={
 price:{name:'数量 × 单价',unit:'元',fields:[['quantity','数量'],['price','单价（元）']],formula:'数量 × 单价'},
 insulation:{name:'圆管保温净体积',unit:'m³',fields:[['diameter','管外径 mm'],['thickness','保温厚度 mm'],['length','长度 m']],formula:'π × [(外径 ÷ 2 + 厚度)² − (外径 ÷ 2)²] × 长度 ÷ 1000000'},
 duct:{name:'矩形风管展开面积',unit:'m²',fields:[['width','风管宽 mm'],['height','风管高 mm'],['length','长度 m']],formula:'2 × (宽 + 高) × 长度 ÷ 1000'}
};
export function quickResult(kind,cells){const s=quickSpecs[kind],v={};for(const [id,label] of s.fields){const raw=cells[id]??'';if(!/^\d+(\.\d{1,8})?$/.test(raw)||!Number.isFinite(Number(raw)))throw Error('请填写'+label);v[id]=Number(raw);}const n=kind==='price'?v.quantity*v.price:kind==='insulation'?Math.PI*((v.diameter/2+v.thickness)**2-(v.diameter/2)**2)*v.length/1e6:2*(v.width+v.height)*v.length/1000;if(!Number.isFinite(n)||n>1e15)throw Error('结果超出范围');return kind==='price'?multiplyMoney(cells.quantity,cells.price):n.toFixed(4);}
