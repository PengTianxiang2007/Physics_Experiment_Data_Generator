// Physical models transcribed from the uploaded tables and University Physics Experiments (2017).
const id = (e,t,r,c)=>`${e}-t${t}-r${r}c${c}`;
const mean = a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:NaN;
const finite = a=>a.filter(Number.isFinite);
const mod = a=>((a%360)+360)%360;
const delta = (a,b)=>((a-b+540)%360)-180;
const circularMean = a=>{a=finite(a);return a.length?mod(a[0]+mean(a.map(v=>delta(v,a[0])))):NaN;};
const angleString=(deg,stepMin=1)=>{let m=Math.round(mod(deg)*60/stepMin)*stepMin;m=((m%21600)+21600)%21600;const d=Math.floor(m/60),min=m-d*60;return `${d}° ${min.toFixed(stepMin<1?1:0)}′`;};
const roundStep=(x,s)=>Math.round(x/s)*s;
const param=(key,label,unit,value,min,max,step)=>({key,label,unit,default:value,min,max,step});
const isLocked=(c,i)=>Boolean(c.locked?.[i])&&Number.isFinite(c.get(i));
const fixed=(c,k)=>Boolean(c.fixedParams?.[k]);
function fitLine(points,slope,intercept,fixSlope,fixIntercept){
 if(!points.length)return{slope,intercept};
 if(points.length>=2&&!fixSlope){
  if(fixIntercept){const den=points.reduce((s,p)=>s+p[0]*p[0],0);if(den)slope=points.reduce((s,p)=>s+p[0]*(p[1]-intercept),0)/den;}
  else{const x=mean(points.map(p=>p[0])),y=mean(points.map(p=>p[1])),den=points.reduce((s,p)=>s+(p[0]-x)**2,0);if(den)slope=points.reduce((s,p)=>s+(p[0]-x)*(p[1]-y),0)/den;}
 }
 if(!fixIntercept)intercept=mean(points.map(p=>p[1]-p[0]*slope));
 return{slope,intercept};
}
function checkLine(c,points,a,b,tolerance,label){if(points.some(([x,y])=>Math.abs(y-(a*x+b))>tolerance))c.warn(`${label}：已锁定数据与当前物理参数不一致；原值已保留，请检查参数或读数。`);}
function writeComputed(c,i,v,dp,tol=10**(-dp)*2){
 if(!Number.isFinite(v))return;
 if(isLocked(c,i)&&Math.abs(c.get(i)-v)>tol)c.warn(`计算结果 ${i} 与已锁定值不一致；已保留锁定值。`);
 c.set(i,v,dp,'computed');
}
function writeAngleComputed(c,i,v){
 if(!Number.isFinite(v))return;
 if(isLocked(c,i)&&Math.abs(delta(c.get(i),v))>0.1/60)c.warn(`角度平均值 ${i} 与锁定值不一致。`);
 c.set(i,angleString(v,0.1),undefined,'computed');
}
function pairDiff(c,e,t,r,a,b){const x=c.get(id(e,t,r,a)),y=c.get(id(e,t,r,b));return Number.isFinite(x)&&Number.isFinite(y)?Math.abs(delta(x,y)):NaN;}

const michelson={
 description:'镜面位移与条纹计数满足 2Δd=Nλ；气室压力差按原表 60 条纹计算。',
 parameters:[param('laser','He–Ne 激光波长','nm',632.8,400,800,0.1),param('start','位移初始读数','mm',12.5,0,100,0.00001),param('resolution','位移读数分辨率','mm',0.00001,0.000001,0.001,0.000001),param('gasLength','气室长度 L','mm',95,10,500,0.1),param('laserRef','气室测量参考波长 λ₀','nm',633,400,800,0.1),param('atmosphere','大气压 p','MPa',0.101325,0.05,0.15,0.000001),param('airIndex','空气折射率 n','',1.00027,1.0001,1.001,0.000001),param('pressureStart','起始压力 p₁','MPa',0.005,0,0.1,0.0001)],
 formulas:['λ = 2平均(d₁₅₀−d₀, d₂₀₀−d₅₀, d₂₅₀−d₁₀₀) / 150','n = 1 + λ₀ × 60 × p / (2L × 平均Δp)','位移以 mm 读取，输出波长换算为 nm；气压统一使用 MPa。'],
 note:'原表气室默认 L=95.0 mm、λ₀=633.0 nm、m=60。压力按递增方向生成，使 Δp=p₂−p₁>0。A 类统计分别针对三组波长、三次气室折射率估计。',
 simulate(c){
  const p=c.params,e='exp08',pts=[];
  for(let j=1;j<=6;j++){const i=id(e,1,1,j);if(isLocked(c,i))pts.push([(j-1)*50,c.get(i)]);}
  let wave=p.laser;
  if(!fixed(c,'laser')&&isLocked(c,id(e,1,4,1)))wave=c.get(id(e,1,4,1));
  if(!fixed(c,'laser')&&pts.length<2){if(isLocked(c,id(e,1,3,1)))wave=2*c.get(id(e,1,3,1))*1e6/150;const ds=[1,3,5].map(j=>id(e,1,2,j)).filter(i=>isLocked(c,i)).map(i=>c.get(i));if(ds.length)wave=2*mean(ds)*1e6/150;}
  const fit=fitLine(pts,wave/2e6,p.start,fixed(c,'laser')||isLocked(c,id(e,1,4,1)),fixed(c,'start'));
  if(fit.slope<=0||fit.slope*2e6<100||fit.slope*2e6>2000)c.warn('锁定位移推导的波长超出合理光学范围，请检查 mm 单位及位移方向。');
  wave=fit.slope*2e6;p.laser=wave;p.start=fit.intercept;
  const res=p.resolution,sigma=Math.abs(fit.slope*50)*c.noise;
  checkLine(c,pts,fit.slope,fit.intercept,Math.max(3*sigma,2*res),'激光波长约束');
  for(let j=1;j<=6;j++)c.set(id(e,1,1,j),roundStep(fit.intercept+(j-1)*50*fit.slope+c.normal()*sigma,res),Math.max(3,Math.min(7,Math.ceil(-Math.log10(res)))));
  const differences=[];
  for(let j=1;j<=3;j++){const d=c.get(id(e,1,1,j+3))-c.get(id(e,1,1,j));differences.push(d);writeComputed(c,id(e,1,2,2*j-1),d,6);}
  writeComputed(c,id(e,1,3,1),mean(differences),6);writeComputed(c,id(e,1,4,1),2*mean(differences)/150*1e6,2);
  let n=p.airIndex;const dps=[];
  for(let j=1;j<=3;j++){let d=null;if(isLocked(c,id(e,2,1,j))&&isLocked(c,id(e,2,2,j)))d=c.get(id(e,2,2,j))-c.get(id(e,2,1,j));else if(isLocked(c,id(e,2,3,j)))d=c.get(id(e,2,3,j));if(d>0)dps.push(d);}
  const factor=p.laserRef*1e-6*60*p.atmosphere/(2*p.gasLength);
  if(!fixed(c,'airIndex')){if(isLocked(c,id(e,2,5,1)))n=c.get(id(e,2,5,1));else if(dps.length)n=1+factor/mean(dps);else if(isLocked(c,id(e,2,4,1))&&c.get(id(e,2,4,1))>0)n=1+factor/c.get(id(e,2,4,1));}
  p.airIndex=n;const targetDp=factor/(n-1);
  if(!Number.isFinite(targetDp)||!(targetDp>0)){c.warn('空气折射率必须大于 1。');return;}
  if(targetDp>p.atmosphere)c.warn('60 条纹需要的压差大于当前大气压；请核对气室长度或折射率参数。');
  const finalDp=[];
  for(let j=1;j<=3;j++){
   const i1=id(e,2,1,j),i2=id(e,2,2,j),di=id(e,2,3,j);let dp=isLocked(c,di)?c.get(di):targetDp*(1+c.normal()*c.noise);
   let p1=p.pressureStart+(j-1)*0.0004,p2=p1+dp;
   if(isLocked(c,i1)){p1=c.get(i1);p2=p1+dp;}else if(isLocked(c,i2)){p2=c.get(i2);p1=p2-dp;}
   c.set(i1,p1,5);c.set(i2,p2,5);dp=c.get(i2)-c.get(i1);finalDp.push(dp);
   if(!(dp>0))c.warn(`气室第 ${j} 次的 p₂ 必须大于 p₁（本表采用递增计数方向）。`);
   if(Math.abs(dp-targetDp)>Math.max(0.00003,3*c.noise*targetDp))c.warn(`气室第 ${j} 次压差与折射率约束不符。`);
   writeComputed(c,di,dp,5);
  }
  writeComputed(c,id(e,2,4,1),mean(finalDp),6);if(mean(finalDp)>0)writeComputed(c,id(e,2,5,1),1+factor/mean(finalDp),7);
 },
 measurements(c){
  const wavelength=[],indices=[],p=c.params,e='exp08';
  for(let j=1;j<=3;j++){const a=c.get(id(e,1,1,j)),b=c.get(id(e,1,1,j+3));if(Number.isFinite(a)&&Number.isFinite(b))wavelength.push(2*(b-a)*1e6/150);const p1=c.get(id(e,2,1,j)),p2=c.get(id(e,2,2,j));if(Number.isFinite(p1)&&Number.isFinite(p2)&&p2>p1)indices.push(1+p.laserRef*1e-6*60*p.atmosphere/(2*p.gasLength*(p2-p1)));}
  return[{label:'He–Ne 激光波长（逐差法）',unit:'nm',values:wavelength,reference:p.laser},{label:'空气折射率增量 n−1',unit:'',values:indices.map(n=>n-1),reference:p.airIndex-1}];
 }
};

const spectrometer={
 description:'按原表记录双游标角度；棱镜采用教材自准直法，汞谱采用光栅左右一级衍射。',
 parameters:[param('apex','棱镜顶角 A','°',60,10,170,0.01),param('prismStart','棱镜左侧游标 1 起读','°',35,0,359.9,0.01),param('grating','光栅线密度','线/mm',600,50,1200,1),param('spectrumZero','光谱零级游标 1 方向','°',95,0,359.9,0.01),param('angleResolution','游标最小读数','角分',1,0.1,5,0.1),param('green','汞绿线参考波长','nm',546.07,500,570,0.01),param('yellow1','汞黄线 1 参考波长','nm',577,570,580,0.1),param('yellow2','汞黄线 2 参考波长','nm',579.0,575,590,0.1)],
 formulas:['自准直法：A = 180° − (α₁+α₂)/2，α 为同一游标两位置的最小圆周角差','光栅：λ = d sin φ（一级），φ = (左右角差游标 1 + 左右角差游标 2)/4','d = 10⁶ / 光栅线密度（nm）；角度平均使用圆周平均以正确处理跨 0°。'],
 note:'角度支持输入 35° 20′ 或十进制度数 35.3333；35.20 表示十进制度，不能表示 35°20′。默认光栅 600 线/mm 是可修改的演示参数。未固定线密度时按教材用绿线 546.07 nm 标定光栅间距，再计算黄线；固定线密度后按该参数计算各线波长。原表无波长结果栏，结果显示于统计区。',
 simulate(c){
  const e='exp09',p=c.params,res=p.angleResolution;
  // The noise slider controls the angular reading spread; 1% corresponds to one arcminute.
  const sigma=c.noise*100/60;let A=p.apex;
  const apexObs=[];for(let r=3;r<=6;r++)for(const v of [[1,3],[2,4]])if(v.every(col=>isLocked(c,id(e,1,r,col))))apexObs.push(180-pairDiff(c,e,1,r,v[0],v[1]));
  if(apexObs.length&&!fixed(c,'apex'))A=mean(apexObs);p.apex=A;
  const sep=180-A;if(!(A>0&&A<180)){c.warn('棱镜顶角必须位于 0° 与 180° 之间。');return;}
  for(let r=3;r<=5;r++){
   let start=p.prismStart;const anchors=[];
   for(let col=1;col<=4;col++){const i=id(e,1,6,col);if(isLocked(c,i))anchors.push(mod(c.get(i)-(col>=3?sep:0)-(col%2===0?180:0)));}
   for(let col=1;col<=4;col++){const i=id(e,1,r,col);if(isLocked(c,i))anchors.push(mod(c.get(i)-(col>=3?sep:0)-(col%2===0?180:0)));}
   if(anchors.length&&!fixed(c,'prismStart'))start=circularMean(anchors);
   for(let col=1;col<=4;col++){
    const i=id(e,1,r,col),value=start+(col>=3?sep:0)+(col%2===0?180:0),obs=c.get(i);
    if(isLocked(c,i)&&Math.abs(delta(obs,value))>Math.max(3*sigma,2*res/60))c.warn(`棱镜第 ${r-2} 次锁定角度与顶角/双游标相差 180° 的约束不一致。`);
    c.set(i,angleString(value+c.normal()*sigma,res));
   }
  }
  for(let col=1;col<=4;col++)writeAngleComputed(c,id(e,1,6,col),circularMean([3,4,5].map(r=>c.get(id(e,1,r,col)))));
  const lines=[{key:'yellow2',left:1,right:11},{key:'yellow1',left:3,right:9},{key:'green',left:5,right:7}];
  let g=p.grating;const inferred=[];
  for(let r=3;r<=5;r++)for(const line of lines)for(let v=0;v<2;v++)if(isLocked(c,id(e,2,r,line.left+v))&&isLocked(c,id(e,2,r,line.right+v)))inferred.push(1e6*Math.sin(pairDiff(c,e,2,r,line.left+v,line.right+v)*Math.PI/360)/p[line.key]);
  if(inferred.length&&!fixed(c,'grating'))g=mean(inferred);p.grating=g;
  if(!(g>0)||lines.some(line=>g*p[line.key]/1e6>=1)){c.warn('当前光栅密度与波长使一级衍射不可达（λ/d ≥ 1）。请减小线密度。');return;}
  for(let r=3;r<=4;r++){
   const angles=Object.fromEntries(lines.map(line=>[line.key,Math.asin(g*p[line.key]/1e6)*180/Math.PI]));let zero=p.spectrumZero;const anchors=[];
   for(const line of lines)for(const side of ['left','right'])for(let v=0;v<2;v++){const i=id(e,2,5,line[side]+v),sign=side==='left'?-1:1;if(isLocked(c,i))anchors.push(mod(c.get(i)-sign*angles[line.key]-v*180));}
   for(const line of lines)for(const side of ['left','right'])for(let v=0;v<2;v++){const i=id(e,2,r,line[side]+v),sign=side==='left'?-1:1;if(isLocked(c,i))anchors.push(mod(c.get(i)-sign*angles[line.key]-v*180));}
   if(anchors.length&&!fixed(c,'spectrumZero'))zero=circularMean(anchors);
   for(const line of lines)for(const side of ['left','right'])for(let v=0;v<2;v++){
    const i=id(e,2,r,line[side]+v),sign=side==='left'?-1:1,value=zero+sign*angles[line.key]+v*180;
    if(isLocked(c,i)&&Math.abs(delta(c.get(i),value))>Math.max(3*sigma,2*res/60))c.warn(`汞谱第 ${r-2} 次已填角度与光栅/波长参数不一致。`);
    c.set(i,angleString(value+c.normal()*sigma,res));
   }
  }
  for(let col=1;col<=12;col++)writeAngleComputed(c,id(e,2,5,col),circularMean([3,4].map(r=>c.get(id(e,2,r,col)))));
 },
 measurements(c){
  const p=c.params,e='exp09',apex=[];
  for(let r=3;r<=5;r++){const a=pairDiff(c,e,1,r,1,3),b=pairDiff(c,e,1,r,2,4);if(Number.isFinite(a)&&Number.isFinite(b))apex.push(180-(a+b)/2);}
  const out=[{label:'棱镜顶角（自准直法）',unit:'°',values:apex,reference:p.apex}];
  const ds={};for(let r=3;r<=4;r++){const a=pairDiff(c,e,2,r,5,7),b=pairDiff(c,e,2,r,6,8);if(Number.isFinite(a)&&Number.isFinite(b)){const phi=(a+b)/4*Math.PI/180;if(phi>0)ds[r]=p.green/Math.sin(phi);}}
  if(!fixed(c,'grating'))out.push({label:'绿线标定光栅间距',unit:'nm',values:Object.values(ds),reference:1e6/p.grating});
  for(const [key,label,left,right] of [['green','汞绿线波长',5,7],['yellow1','汞黄线 1 波长',3,9],['yellow2','汞黄线 2 波长',1,11]]){
   if(key==='green'&&!fixed(c,'grating'))continue;
   const values=[];for(let r=3;r<=4;r++){const a=pairDiff(c,e,2,r,left,right),b=pairDiff(c,e,2,r,left+1,right+1),d=fixed(c,'grating')?1e6/p.grating:ds[r];if(Number.isFinite(a)&&Number.isFinite(b)&&Number.isFinite(d))values.push(d*Math.sin((a+b)/4*Math.PI/180));}
   out.push({label,unit:'nm',values,reference:p[key]});
  }return out;
 }
};

const ultrasound={
 description:'驻波法使用相邻振幅极大值，相位法使用相同倾斜方向直线的再次出现。',
 parameters:[param('temperature','室温 T','°C',22,0,45,0.1),param('frequency','共振频率 f','kHz',40,20,100,0.001),param('soundSpeed','声速（未固定时按室温计算）','m/s',344.54,300,400,0.01),param('standingStart','驻波法初始位置','mm',20,0,500,0.01),param('phaseStart','相位法初始位置','mm',20,0,500,0.01),param('resolution','位置读数分辨率','mm',0.01,0.001,0.5,0.001)],
 formulas:['空气理论声速 v = 331.45 √(1 + T/273.15) m/s；λ(mm) = v(m/s) / f(kHz)','驻波法：λ = 2(lᵢ₊₅−lᵢ)/5；相位法：λ = (lᵢ₊₅−lᵢ)/5','声速 v = fλ；逐差法各取五组独立位置对计算。'],
 note:'同相位直线每隔 λ 重现；若你记录的是每次任意斜向直线出现（含相反斜率），应间隔 λ/2，本工具当前采用教材的“相同倾斜方向”定义。声速按干燥空气近似；手动固定声速可覆盖室温模型。',
 simulate(c){
  const p=c.params,e='exp13',theory=331.45*Math.sqrt(1+p.temperature/273.15),points={};let speed=fixed(c,'soundSpeed')?p.soundSpeed:theory;
  const estimates=[];
  for(let t=1;t<=2;t++){points[t]=[];for(let col=1;col<=10;col++){const i=id(e,t,1,col);if(isLocked(c,i))points[t].push([col-1,c.get(i)]);}if(points[t].length>=2){const f=fitLine(points[t],1,0,false,false);if(f.slope>0)estimates.push(f.slope*p.frequency*(t===1?2:1));}}
  if(estimates.length&&!fixed(c,'soundSpeed'))speed=mean(estimates);p.soundSpeed=speed;
  if(Math.abs(speed-theory)>Math.max(1,3*c.noise*theory))c.warn('锁定位置推导的声速与室温下空气声速不符；请检查共振频率及相位法间隔定义。');
  for(let t=1;t<=2;t++){
   const key=t===1?'standingStart':'phaseStart',step=speed/p.frequency/(t===1?2:1),sigma=step*c.noise;
   const fit=fitLine(points[t],step,p[key],true,fixed(c,key));p[key]=fit.intercept;
   checkLine(c,points[t],step,fit.intercept,Math.max(3*sigma,p.resolution*2),t===1?'驻波法约束':'相位法约束');
   for(let col=1;col<=10;col++)c.set(id(e,t,1,col),roundStep(fit.intercept+(col-1)*step+c.normal()*sigma,p.resolution),Math.max(1,Math.min(5,Math.ceil(-Math.log10(p.resolution)))));
   for(let col=2;col<=10;col++)if(c.get(id(e,t,1,col))<=c.get(id(e,t,1,col-1)))c.warn('位置读数应按同一方向单调增加；请检查已锁定的读数。');
  }
 },
 measurements(c){
  const out=[],p=c.params,e='exp13';
  for(let t=1;t<=2;t++){const waves=[];for(let col=1;col<=5;col++){const a=c.get(id(e,t,1,col)),b=c.get(id(e,t,1,col+5));if(Number.isFinite(a)&&Number.isFinite(b))waves.push((b-a)/5*(t===1?2:1));}const name=t===1?'驻波法':'相位法';out.push({label:`${name}波长（逐差法）`,unit:'mm',values:waves,reference:p.soundSpeed/p.frequency});out.push({label:`${name}声速`,unit:'m/s',values:waves.map(v=>v*p.frequency),reference:p.soundSpeed});}
  return out;
 }
};

export const models={exp08:michelson,exp09:spectrometer,exp13:ultrasound};
