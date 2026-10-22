// Formula provenance and units: ../FORMULAS.md. No source workbook is modified.
export const specs={
 cable:{name:'电线电缆铜价调差',source:'铜芯电线电缆铜价调差计算表.xlsx · 电缆调差计算-配电房!B3:B6、D10:P10',fields:[['base','基准铜价','元/t',68740],['current','施工月均铜价','元/t',105825],['threshold','不可调幅度','%',3],['density','铜密度系数','kg/(m·mm²)',.0089],['n1','第 1 组芯数','根',3],['a1','第 1 组单芯面积','mm²',400],['n2','第 2 组芯数','根',0],['a2','第 2 组单芯面积','mm²',0],['n3','第 3 组芯数','根',0],['a3','第 3 组单芯面积','mm²',0],['length','长度 / 消耗量','m',63.61]],formula:'总铜截面积 = Σ(芯数 × 单芯面积)；铜量(t) = 截面积 × 密度系数 × 长度 ÷ 1000。只调整超过基准价 ± 不可调幅度的部分。'},
 bus:{name:'母线槽铜价调差',source:'母线槽铜价调差计算表_按排规估算.xlsx · 母线槽铜价调差!B2:B5、H8:W8；母线槽铜价调差万控!O8',fields:[['base','基准铜价','元/t',68740],['current','施工月均铜价','元/t',105825],['threshold','不可调幅度','%',3],['density','铜密度系数','kg/(m·mm²)',.0089],['width','ABCN 铜排宽','mm',50],['thickness','ABCN 铜排厚','mm',3],['count','每极根数（ABCN 共 4 极）','根',1],['peWidth','PE 铜排宽','mm',50],['peThickness','PE 铜排厚','mm',1.5],['peCount','PE 根数','根',1],['length','长度','m',63.7],['unitWeight','确认的单位铜重','kg/m',6.1]],formula:'总铜截面积 = ABCN宽 × 厚 × 每极根数 × 4 + PE宽 × 厚 × 根数。按排规估算单位铜重，或采用已确认单位铜重；两种口径不混用。'},
 support:{name:'桥架支吊架重量',source:'ACS_个人_桥架支架_网络收集.xlsx · 标准!A11:Q11、A15:Q15；自定义!A3:Q3',fields:[['width','桥架宽','mm',150],['height','桥架高','mm',100],['length','桥架长度','m',795.64],['beam','结构梁高','mm',600],['gap','距梁高度','mm',100],['spacing','支架间距','m',2],['rods','每支吊杆数','根',2],['rodWeight','吊杆单位重','kg/m',.617],['steelWeight','横担型钢单位重','kg/m',2.422]],formula:'门架：单吊长 = 梁高 + 距梁高 + 桥架高，横梁长 = 桥架宽 + 100。单杆吊框：单吊长 = 梁高 + 距梁高 − 20，吊框长 = (宽 + 高 + 40) × 2。防晃长 = (梁高/2 + 距梁高 + 桥架高) × 2 + 宽 + 100。原表按长度/间距计量，不向上取整。'}
};
export const defaults=key=>Object.fromEntries(specs[key].fields.map(([id,,,value])=>[id,String(value)]));
export function calculate(key,input,mode=''){
 const v={};const fields=specs[key].fields.filter(([id])=>key!=='bus'||(mode==='direct'?!['width','thickness','count','peWidth','peThickness','peCount','density'].includes(id):id!=='unitWeight'));
 for(const [id,label] of fields){if(String(input[id]??'').trim()===''||!Number.isFinite(Number(input[id]))||Number(input[id])<0)throw Error('请填写有效的'+label);v[id]=Number(input[id]);}
 for(const id of ['n1','n2','n3','count','peCount','rods'])if(id in v&&!Number.isInteger(v[id]))throw Error('芯数 / 根数必须为整数');
 if(key==='support'){
  if(v.spacing<=0||v.rods<=0||v.rodWeight<=0||v.steelWeight<=0)throw Error('间距、吊杆数和单位重量必须大于 0');
  const hanging=mode==='single'?v.beam+v.gap-20:v.beam+v.gap+v.height;
  if(hanging<0)throw Error('单吊长度不能为负，请核对梁高和距梁高度');
  const cross=mode==='single'?(v.width+v.height+40)*2:v.width+100;
  const sway=(v.beam/2+v.gap+v.height)*2+v.width+100;
  const each=(hanging*v.rods*v.rodWeight+cross*v.steelWeight)/1000;
  const swayEach=sway/1000*v.steelWeight, count=v.length/v.spacing, swayCount=v.length/20;
  const value=each*count+swayEach*swayCount;checkResult(value);return {value,unit:'kg',steps:[['单吊长度',hanging,'mm'],['横梁 / 吊框长度',cross,'mm'],['普通支架单重',each,'kg'],['防晃支架单重',swayEach,'kg'],['普通支架折算数量',count,'个'],['防晃支架折算数量',swayCount,'个']]};
 }
 if(v.base<=0||v.threshold>100)throw Error('基准铜价须大于 0，不可调幅度须在 0–100%');
 if(key==='cable')for(const i of [1,2,3])if((v['n'+i]>0)!==(v['a'+i]>0))throw Error('同组芯数和截面积须同时填写正数，或同时为 0');
 const area=key==='cable'?v.n1*v.a1+v.n2*v.a2+v.n3*v.a3:mode==='direct'?null:v.width*v.thickness*v.count*4+v.peWidth*v.peThickness*v.peCount;
 const unitWeight=key==='bus'&&mode==='direct'?v.unitWeight:area*v.density;
 if(unitWeight<=0)throw Error('铜截面积 / 单位铜重必须大于 0');
 const tonnes=v.length*unitWeight/1000;
 const delta=Math.max(0,v.current-v.base*(1+v.threshold/100))-Math.max(0,v.base*(1-v.threshold/100)-v.current);
 const value=tonnes*delta;
 checkResult(value);
 return {value,unit:'元',steps:[...(area===null?[]:[['总铜截面积',area,'mm²']]),['单位铜重',unitWeight,'kg/m'],['铜消耗量',tonnes,'t'],['可调铜价差（含方向）',delta,'元/t']]};
}

function checkResult(value){if(!Number.isFinite(value)||Math.abs(value)>1e15)throw Error('计算结果超出范围，请核对输入');}
