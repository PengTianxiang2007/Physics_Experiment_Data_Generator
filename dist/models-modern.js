/* Physics-based synthetic data models for the supplied second-semester tables.
 * The current curves are deliberately documented phenomenological models.
 * No value written by these models replaces a locked observation. */
const P=(key,label,unit,def,min,max,step)=>({key,label,unit,default:def,min,max,step});
const id=(e,t,r,c)=>`${e}-t${t}-r${r}c${c}`;
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:NaN;
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const median=a=>{const b=a.filter(finite).sort((x,y)=>x-y);return b.length?b[Math.floor(b.length/2)]:NaN};
const nrm=c=>c.normal();
const get=(c,t,r,col)=>c.get(id(c.exp.id,t,r,col));
const set=(c,t,r,col,v,d=3,kind='generated')=>c.set(id(c.exp.id,t,r,col),v,d,kind);
const locked=(c,t,r,col)=>!!c.locked[id(c.exp.id,t,r,col)]&&finite(get(c,t,r,col));
function fit(points){if(points.length<2)return null;const xm=mean(points.map(p=>p[0])),ym=mean(points.map(p=>p[1]));const den=points.reduce((s,p)=>s+(p[0]-xm)**2,0);if(!den)return null;const slope=points.reduce((s,p)=>s+(p[0]-xm)*(p[1]-ym),0)/den;return{slope,intercept:ym-slope*xm};}
function infer(c,key,value){if(!c.fixedParams?.[key]&&finite(value))c.params[key]=value;return c.params[key];}
function check(c,actual,expected,label,tolerance){if(finite(actual)&&finite(expected)&&Math.abs(actual-expected)>tolerance)c.warn(`${label}与当前物理参数不一致（模型值 ${Number(expected.toPrecision(6))}）；保留已填数据。`);}
function compare(c,t,r,col,expected,label,tol){if(locked(c,t,r,col))check(c,get(c,t,r,col),expected,label,tol);}
function fillRepeats(c,t,rows,col,target,meanCell,dec=2){
  const fixed=rows.filter(r=>locked(c,t,r,col));const open=rows.filter(r=>!locked(c,t,r,col));
  if(meanCell&&locked(c,t,meanCell[0],meanCell[1]))target=get(c,t,meanCell[0],meanCell[1]);
  else if(fixed.length)target=mean(fixed.map(r=>get(c,t,r,col)));
  let center=target;
  if(open.length&&meanCell&&locked(c,t,meanCell[0],meanCell[1]))center=(target*rows.length-fixed.reduce((s,r)=>s+get(c,t,r,col),0))/open.length;
  let eps=open.map(()=>nrm(c)*Math.abs(target)*c.noise);const em=mean(eps)||0;
  open.forEach((r,i)=>set(c,t,r,col,center+eps[i]-em,dec));
  const measured=mean(rows.map(r=>get(c,t,r,col)).filter(finite));
  if(meanCell){compare(c,t,meanCell[0],meanCell[1],measured,'平均值',2*10**(-dec));set(c,t,meanCell[0],meanCell[1],measured,dec,'computed');}
  return measured;
}
const ECHARGE=1.602176634e-19, PLANCK=6.62607015e-34, LIGHT=299792458;

function fhBase(v,p){
  const u=Math.max(0,v-p.contact),env=p.scale*Math.pow(u/60,1.3);
  return p.dark+env*(0.56+0.44*Math.cos(2*Math.PI*(v-p.contact)/p.excitation));
}
function fhPeaks(c,t){const pts=[];for(let v=1;v<79;v++){const a=get(c,t,Math.floor((v-1)/10)+1,(v-1)%10+1),b=get(c,t,Math.floor(v/10)+1,v%10+1),d=get(c,t,Math.floor((v+1)/10)+1,(v+1)%10+1);if(v>10&&finite(a)&&finite(b)&&finite(d)&&b>a&&b>=d)pts.push({v,b});}const chosen=[];for(const p of pts){const last=chosen.at(-1);if(last&&p.v-last.v<8){if(p.b>last.b)chosen[chosen.length-1]=p;}else chosen.push(p);}return chosen.map(p=>p.v);}

function millikanRadius(t,p){return Math.sqrt(9*p.viscosity*1e-5*p.fallDistance*1e-3/(2*p.density*p.gravity*t));}
function millikanCharge(U,t,p){const r=millikanRadius(t,p),slip=1+p.slip/(p.pressure*1000*r);return 4*Math.PI/3*r**3*p.density*p.gravity*(p.plateGap*1e-3)/(U*slip**1.5);}
function timeFromCharge(U,n,p){let lo=.00001,hi=100000;for(let i=0;i<80;i++){const mid=(lo+hi)/2;if(millikanCharge(U,mid,p)>n*ECHARGE)lo=mid;else hi=mid;}return(lo+hi)/2;}

export const models={
 exp10:{
  description:'按原表 0–79 V 扫描电压生成氩管电流曲线；三张表分别保留手动与计算机采样。',
  parameters:[P('excitation','氩管实验峰间距','V',13.1,5,20,0.1),P('contact','曲线起始偏移','V',2,0,15,0.1),P('scale','电流包络幅度','nA',12,0.01,10000,0.1),P('dark','暗电流','nA',0.02,0,10,0.01)],
  formulas:['相邻电流峰电压差 ΔU ≈ Uₑₓ；课程教材第 156 页采用约 13.1 V。','I(U) = I暗 + A·[(U−U偏移)/60]₊^1.3·[0.56 + 0.44 cos(2π(U−U偏移)/Uₑₓ)]。'],
  note:'电流单位统一选为 nA（请填写原表的电流单位栏）。曲线包络是教学模拟，不是特定氩管的精确输运模型；1 V 采样使峰位有量化误差。空白左上角是表头留白。',
  simulate(c){
   const p=c.params;const estimates=[];
   for(let t=1;t<=3;t++)for(let v=0;v<80;v++){const r=Math.floor(v/10)+1,col=v%10+1;if(locked(c,t,r,col)&&v>p.contact+3){const q=fhBase(v,{...p,scale:1,dark:0});if(q>0.02)estimates.push((get(c,t,r,col)-p.dark)/q);}}
   const amp=median(estimates);if(amp>0)infer(c,'scale',amp);
   for(let t=1;t<=3;t++)for(let v=0;v<80;v++){
    const r=Math.floor(v/10)+1,col=v%10+1,expected=fhBase(v,p),jitter=Math.max(0.002,p.scale*c.noise*0.15)*nrm(c);
    compare(c,t,r,col,expected,`${t} 表 ${v} V 电流`,Math.max(0.08,p.scale*c.noise*6));
    set(c,t,r,col,Math.max(0,expected+jitter),3);
   }
  },
  measurements(c){const intervals=[];for(let t=1;t<=3;t++){const peaks=fhPeaks(c,t);for(let i=1;i<peaks.length;i++)intervals.push(peaks[i]-peaks[i-1]);}return[{label:'相邻峰间距（1 V 采样）',unit:'V',values:intervals,reference:c.params.excitation}];}
 },
 exp11:{
  description:'生成 10 个油滴各 3 次平衡电压和下落时间，依据带滑移修正的斯托克斯定律与电场平衡。',
  parameters:[P('plateGap','极板间距','mm',5,0.1,30,0.01),P('fallDistance','观测下落距离','mm',2,0.01,10,0.01),P('density','油滴密度','kg/m³',981,100,2000,1),P('viscosity','空气黏滞系数','×10⁻⁵ Pa·s',1.83,0.1,5,0.01),P('pressure','气压','kPa',101.325,30,150,0.01),P('slip','Cunningham 常数 b','Pa·m',0.00822,0,0.1,0.00001),P('gravity','重力加速度','m/s²',9.79,8,12,0.001),P('balanceVoltage','典型平衡电压','V',300,20,1000,1),P('electronCount','首个油滴电荷整数','e',5,1,100,1)],
  formulas:['按教材近似：r₀ = √[9ηL/(2ρgt)]；滑移修正系数 C = 1+b/(pr₀)。','q = (4π/3)r₀³ρgd/(U·C^(3/2))；模型中 q = ne，n 为正整数。'],
  note:'公式与默认装置参数据教材第 166–167 页，忽略空气浮力。各油滴具有独立半径和电荷数；电荷整数是生成条件，不是实测结论。',
  simulate(c){
   const p=c.params;
   for(let j=0;j<10;j++){
    const r0=2+j*3,rs=[r0,r0+1,r0+2];
    const us=rs.filter(r=>locked(c,1,r,1)).map(r=>get(c,1,r,1)),ts=rs.filter(r=>locked(c,1,r,3)).map(r=>get(c,1,r,3));
    let U=locked(c,1,r0,2)?get(c,1,r0,2):us.length?mean(us):p.balanceVoltage*(0.82+0.04*j);
    let t=locked(c,1,r0,4)?get(c,1,r0,4):ts.length?mean(ts):null;
    let n=Math.max(1,Math.round(p.electronCount)+j%5);
    if(t!==null&&t>0&&U>0){
      if(us.length||locked(c,1,r0,2)){const qe=millikanCharge(U,t,p)/ECHARGE;if(!c.fixedParams?.electronCount)n=Math.max(1,Math.round(qe));if(Math.abs(qe-n)>Math.max(.15,n*c.noise*5))c.warn(`油滴 ${j+1} 的已填电压/时间反算 q/e=${qe.toFixed(3)}，与${c.fixedParams?.electronCount?'指定':'最近'}整数 ${n} 有偏差；原数据保留。`);}
      else U=millikanCharge(1,t,p)/(n*ECHARGE);
    }else t=timeFromCharge(U,n,p);
    if(!(U>0&&t>0&&finite(t))){c.warn(`油滴 ${j+1} 的电压和下落时间须为正数。`);continue;}
    fillRepeats(c,1,rs,1,U,[r0,2],2);fillRepeats(c,1,rs,3,t,[r0,4],2);
   }
  },
  measurements(c){const groups=[];for(let j=0;j<10;j++){const r=2+j*3,values=[];for(let k=0;k<3;k++){const U=get(c,1,r+k,1),t=get(c,1,r+k,3);if(U>0&&t>0)values.push(millikanCharge(U,t,c.params)/1e-19);}groups.push({label:`油滴 ${j+1} 电荷`,unit:'×10⁻¹⁹ C',values});}return groups;}
 },
 exp12:{
  description:'由分压关系生成四分之一桥、半桥输出，并建立电子秤的加载/卸载标定和未知物体测量。',
  parameters:[P('supply','桥路供电','V',5,0.1,30,0.1),P('baseR','固定桥臂 R₁=R₂=R₄','kΩ',10,0.1,100,0.1),P('sensitivity','电子秤标定灵敏度','V/kg',0.25,0.001,10,0.001),P('offset','电子秤零点输出','V',0.015,-5,5,0.001),P('hysteresis','加载卸载差','V',0.004,0,0.5,0.001),P('mass1','物体 1 质量','kg',2.35,0.001,30,0.001),P('mass2','物体 2 质量','kg',4.18,0.001,30,0.001),P('mass3','物体 3 质量','kg',6.72,0.001,30,0.001),P('probeR3','供电扫描时 R₃','kΩ',11,0.1,100,0.1)],
  formulas:['本页取 U_AB = E[R₃/(R₃+R₄) − R₁/(R₁+R₂)]，R₁=R₂。','四分之一桥 R₄=R₀；半桥按原表 R₃+R₄=20 kΩ。','电子秤 U = U₀ + Sm；m = (U−U₀)/S。'],
  note:'桥路输出正负取决于 A/B 接线，本模型使用上式约定。四分之一桥表中的 R₃ 与半桥的 R₃、R₄ 按原表固定；电子秤质量由本次加载标定拟合值反算。',
  simulate(c){
   const p=c.params,E=[];
   for(let col=1;col<=6;col++){const R3=10+.2*col,kq=R3/(R3+p.baseR)-.5,kh=R3/20-.5;if(locked(c,1,1,col)&&Math.abs(kq)>1e-8)E.push(get(c,1,1,col)/kq);if(locked(c,2,2,col))E.push(get(c,2,2,col)/kh);}
   const ee=median(E);if(ee>0)infer(c,'supply',ee);
   for(let col=1;col<=6;col++){
    const R3=10+.2*col;for(const [t,r,k] of [[1,1,R3/(R3+p.baseR)-.5],[2,2,R3/20-.5]]){
      const y=p.supply*k;compare(c,t,r,col,y,'电桥输出',Math.max(.0005,Math.abs(y)*c.noise*5));set(c,t,r,col,y+nrm(c)*Math.max(Math.abs(y),.01)*c.noise,5);
    }
   }
   const points=[];for(let col=1;col<=9;col++)for(const r of [1,2,3])if(locked(c,3,r,col))points.push([col,get(c,3,r,col)-(r===1?p.hysteresis/2:r===2?-p.hysteresis/2:0)]);
   const f=fit(points);if(f){if(!c.fixedParams?.sensitivity&&!c.fixedParams?.offset){infer(c,'sensitivity',f.slope);infer(c,'offset',f.intercept);}else if(!c.fixedParams?.sensitivity)infer(c,'sensitivity',mean(points.map(([m,u])=>(u-p.offset)/m)));else if(!c.fixedParams?.offset)infer(c,'offset',mean(points.map(([m,u])=>u-p.sensitivity*m)));}
   else if(points.length&&!c.fixedParams?.sensitivity)infer(c,'sensitivity',mean(points.map(([m,u])=>(u-p.offset)/m)));
   for(let col=1;col<=9;col++){
    let center=p.offset+p.sensitivity*col;if(locked(c,3,3,col))center=get(c,3,3,col);
    const plusLocked=locked(c,3,1,col),minusLocked=locked(c,3,2,col);
    let up=center+p.hysteresis/2+nrm(c)*Math.abs(p.sensitivity)*c.noise,down=center-p.hysteresis/2+nrm(c)*Math.abs(p.sensitivity)*c.noise;
    if(locked(c,3,3,col)){if(plusLocked)down=2*center-get(c,3,1,col);else if(minusLocked)up=2*center-get(c,3,2,col);else down=2*center-up;}
    compare(c,3,1,col,p.offset+p.sensitivity*col+p.hysteresis/2,'电子秤加载标定',Math.max(.005,Math.abs(p.sensitivity)*c.noise*6));
    compare(c,3,2,col,p.offset+p.sensitivity*col-p.hysteresis/2,'电子秤卸载标定',Math.max(.005,Math.abs(p.sensitivity)*c.noise*6));
    set(c,3,1,col,up,4);set(c,3,2,col,down,4);const av=(get(c,3,1,col)+get(c,3,2,col))/2;compare(c,3,3,col,av,'加载卸载均值',.0002);set(c,3,3,col,av,4,'computed');
   }
   const cal=fit(Array.from({length:9},(_,i)=>[i+1,get(c,3,3,i+1)]).filter(x=>finite(x[1])))||{slope:p.sensitivity,intercept:p.offset};
   if(cal.slope<=0)c.warn('电子秤标定斜率不是正数，请检查已填标定数据。');
   for(let col=1;col<=3;col++){
    let m=locked(c,4,5,col)?get(c,4,5,col):p[`mass${col}`];
    const raw=[1,2,3].filter(r=>locked(c,4,r,col)).map(r=>get(c,4,r,col));
    if(!c.fixedParams?.[`mass${col}`]&&!locked(c,4,5,col)&&(raw.length||locked(c,4,4,col)))m=infer(c,`mass${col}`,((locked(c,4,4,col)?get(c,4,4,col):mean(raw))-cal.intercept)/cal.slope);
    const target=cal.intercept+cal.slope*m;
    for(const r of [1,2,3])compare(c,4,r,col,target,`物体 ${col} 电压`,Math.max(.005,Math.abs(target)*c.noise*5));
    const av=fillRepeats(c,4,[1,2,3],col,target,[4,col],4),computedMass=(av-cal.intercept)/cal.slope;
    compare(c,4,5,col,computedMass,'物体质量',.002);set(c,4,5,col,computedMass,3,'computed');
   }
   const coeff=p.probeR3/(p.probeR3+p.baseR)-.5;
   for(let col=1;col<=10;col++){compare(c,5,1,col,col*coeff,'供电扫描输出',Math.max(.0005,Math.abs(col*coeff)*c.noise*5));set(c,5,1,col,col*coeff*(1+nrm(c)*c.noise),5);}
  },
  measurements(c){const p=c.params,values=[];for(let col=1;col<=6;col++){const u=get(c,1,1,col),R3=10+.2*col,k=R3/(R3+p.baseR)-.5;if(finite(u)&&Math.abs(k)>1e-8)values.push(u/k);}const groups=[{label:'四分之一桥反算供电',unit:'V',values,reference:p.supply}];for(let col=1;col<=3;col++)groups.push({label:`物体 ${col} 重复电压`,unit:'V',values:[1,2,3].map(r=>get(c,4,r,col)).filter(finite)});return groups;}
 },
 exp14:{
  description:'依照爱因斯坦光电方程生成截止电压，并模拟两种光源距离下的光电管伏安曲线。',
  parameters:[P('planck','普朗克常数 h','×10⁻³⁴ J·s',6.62607015,3,10,.001),P('work','有效逸出功（含接触势偏移）','eV',2.0,0.5,2.13,.001),P('ivWavelength','伏安曲线光波长','nm',577,300,700,1),P('saturation','30 cm 饱和光电流','×10⁻¹¹ A',15,.001,10000,.1),P('collection','收集电压尺度','V',5,.1,30,.1),P('dark','残余背景电流','×10⁻¹¹ A',.02,-5,5,.001)],
  formulas:['ν = c/λ；eUₛ = hν − W；表中 Uₛ 按正的截止电压幅值填写。','I(U,d) = I暗 + I饱和·(30/d)²·{1−exp[−max(U+Uₛ,0)/V尺度]}。'],
  note:'光电流饱和曲线采用教学近似，反向区仅含背景电流。逸出功参数包含仪器接触势影响。若手填频率，后续截止电压按该频率计算，并检查其是否匹配原表波长。',
  simulate(c){
   const p=c.params,waves=[365,405,436,546,577];
   for(let r=1;r<=5;r++){const expected=LIGHT/(waves[r-1]*1e-9);compare(c,1,r,1,expected,'波长与频率',expected*0.00005);set(c,1,r,1,expected.toExponential(6),6,'computed');}
   const points=[];for(let r=1;r<=5;r++)if(locked(c,1,r,2))points.push([get(c,1,r,1)/1e14,get(c,1,r,2)]);
   const f=fit(points);if(f&&!c.fixedParams?.planck&&!c.fixedParams?.work){infer(c,'planck',f.slope*ECHARGE*1e20);infer(c,'work',-f.intercept);}else if(points.length&&!c.fixedParams?.work)infer(c,'work',mean(points.map(([nu,u])=>p.planck*1e-20/ECHARGE*nu-u)));else if(points.length&&!c.fixedParams?.planck)infer(c,'planck',mean(points.map(([nu,u])=>(u+p.work)*ECHARGE*1e20/nu)));
   if(!(p.planck>0))c.warn('已填截止电压对应的拟合斜率非正；请核对截止电压的符号约定。');
   for(let r=1;r<=5;r++){
    const expected=p.planck*1e-34/ECHARGE*get(c,1,r,1)-p.work;
    if(expected<0)c.warn(`${waves[r-1]} nm 光子的能量低于所设有效逸出功，不能产生本模型中的光电发射；该截止电压留空。`);
    else{compare(c,1,r,2,expected,'截止电压',Math.max(.003,Math.abs(expected)*c.noise*5));set(c,1,r,2,Math.max(0,expected+nrm(c)*Math.max(expected,.05)*c.noise),4);}
   }
   const Us=p.planck*1e-34*LIGHT/(ECHARGE*p.ivWavelength*1e-9)-p.work;
   const sets=[[-2,0,2,4,6,8,10,12],[14,16,18,20,22,24,28,30],[32,34,36,38,40,43,46,50]],est=[];
   for(let k=0;k<3;k++)for(let j=0;j<8;j++)for(const [r,d]of[[k*3+1,30],[k*3+2,40]])if(locked(c,2,r,j+1)){const coeff=(30/d)**2*(1-Math.exp(-Math.max(sets[k][j]+Us,0)/p.collection));if(coeff>.02)est.push((get(c,2,r,j+1)-p.dark)/coeff);}
   const sat=median(est);if(sat>0)infer(c,'saturation',sat);
   for(let k=0;k<3;k++)for(let j=0;j<8;j++)for(const [r,d]of[[k*3+1,30],[k*3+2,40]]){
    const y=p.dark+(Us>0?p.saturation*(30/d)**2*(1-Math.exp(-Math.max(sets[k][j]+Us,0)/p.collection)):0);
    compare(c,2,r,j+1,y,'光电流',Math.max(.01,p.saturation*c.noise*5));set(c,2,r,j+1,y+nrm(c)*Math.max(Math.abs(y),.01)*c.noise,4);
   }
  },
  measurements(c){const values=[];for(let r=1;r<=5;r++){const v=get(c,1,r,1),u=get(c,1,r,2);if(finite(v)&&finite(u))values.push(c.params.planck*1e-34/ECHARGE*v-u);}return[{label:'给定 h 时各谱线的有效逸出功',unit:'eV',values,reference:c.params.work}];}
 },
 exp15:{
  description:'按原表 35–85 ℃ 的温度点生成热电偶电动势，支持冷端温度、塞贝克系数和温度非线性。',
  parameters:[P('cold','冷端/室温','℃',25,-20,35,.1),P('seebeck','一次塞贝克系数','μV/℃',40,1,100,.1),P('quadratic','二次温度系数','μV/℃²',.01,-.1,.1,.001),P('offset','电势零点偏移','mV',0,-1,1,.001),P('multiplier','电位差计倍率','倍',1,.001,1000,.001)],
  formulas:['Eₓ(mV) = [a(T−T₀) + b(T−T₀)²]/1000 + E₀。','原表填写实际电动势 Eₓ；电位差计刻度读数 = Eₓ/倍率。'],
  note:'默认系数仅代表示例热电偶，不对应指定型号标准分度表；请按所用热电偶与冷端条件输入。倍率记录为仪器参数，不重复乘入实际电动势。',
  simulate(c){
   const p=c.params,points=[];
   for(let col=1;col<=6;col++)if(locked(c,1,1,col)){const dt=25+10*col-p.cold;points.push([dt,(get(c,1,1,col)-p.offset)*1000-p.quadratic*dt*dt]);}
   if(points.length&&!c.fixedParams?.seebeck)infer(c,'seebeck',points.reduce((s,[dt,E])=>s+dt*E,0)/points.reduce((s,[dt])=>s+dt*dt,0));
   for(let col=1;col<=6;col++){
    const dt=25+10*col-p.cold,y=(p.seebeck*dt+p.quadratic*dt*dt)/1000+p.offset;
    compare(c,1,1,col,y,'热电动势',Math.max(.002,Math.abs(y)*c.noise*5));set(c,1,1,col,y+nrm(c)*Math.max(Math.abs(y),.01)*c.noise,4);
   }
  },
  measurements(c){const p=c.params,values=[];for(let col=1;col<=6;col++){const dt=25+10*col-p.cold,E=get(c,1,1,col);if(finite(E)&&Math.abs(dt)>1e-6)values.push(((E-p.offset)*1000-p.quadratic*dt*dt)/dt);}return[{label:'各温度点反算一次塞贝克系数',unit:'μV/℃',values,reference:p.seebeck}];}
 }
};
