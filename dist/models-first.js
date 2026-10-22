/* Semester I physical models. Numeric values follow units printed in the worksheets. */
const P=(key,label,unit,value,min,max,step)=>({key,label,unit,default:value,min,max,step});
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:NaN;
const id=(e,t,r,c)=>`${e}-t${t}-r${r}c${c}`;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
function get(c,t,r,k){return c.get(id(c.exp.id,t,r,k));}
function islock(c,t,r,k){return !!c.locked[id(c.exp.id,t,r,k)]&&finite(get(c,t,r,k));}
function set(c,t,r,k,v,d=3,kind='generated'){
  const key=id(c.exp.id,t,r,k);
  if(kind==='computed'&&c.locked[key]&&finite(v)){
    const old=c.get(key),tol=Math.max(1e-8,0.51*10**(-d));
    if(finite(old)&&Math.abs(old-v)>tol)c.warn(`${key}：锁定值 ${old} 与按原表公式计算的 ${v.toFixed(d)} 不一致，已保留锁定值。`);
  }
  c.set(key,v,d,kind);
}
function read(c,key,t,r,k){
  const p=c.params[key];
  if(islock(c,t,r,k)){
    const v=get(c,t,r,k);
    if(c.fixedParams?.[key]&&Math.abs(v-p)>Math.max(1e-6,Math.abs(p)*1e-4))c.warn(`仪器参数「${key}」与锁定单元格不一致；计算使用表格中的实测值。`);
    return v;
  }
  return p;
}
function fit(points){
  if(points.length<2)return null;
  const mx=mean(points.map(v=>v[0])),my=mean(points.map(v=>v[1]));
  const den=points.reduce((s,[x])=>s+(x-mx)**2,0);
  if(den<1e-14)return null;
  const slope=points.reduce((s,[x,y])=>s+(x-mx)*(y-my),0)/den;
  return {slope,intercept:my-slope*mx};
}
function infer(c,key,vals){
  const v=mean(vals.filter(x=>finite(x)&&x>0));
  if(!c.fixedParams?.[key]&&finite(v)){c.params[key]=v;return v;}
  return c.params[key];
}
function check(c,actual,expected,label,scale=1){
  if(finite(actual)&&finite(expected)&&Math.abs(actual-expected)>Math.max(Math.abs(expected)*Math.max(0.05,6*c.noise),Math.abs(scale)*0.002))c.warn(`${label}：锁定读数与当前物理参数偏差较大，请检查单位或固定参数。`);
}
function jitter(c,value,scale=Math.abs(value)){return value+c.normal()*c.noise*scale;}
function positive(c,value,scale=Math.abs(value)){return Math.max(0,jitter(c,value,scale));}
const G=9.79;

const exp01={
  description:'根据欧姆定律、内外接法的电表负载效应和二极管伏安关系生成。原表电流用 mA，计算电阻时自动换算为 A。',
  parameters:[P('smallR','小电阻标称值','Ω',100,1,1e5,1),P('largeR','大电阻标称值','Ω',1000,1,1e7,10),P('vRange','选用电压量程','V',3,.1,1000,.1),P('iRange','小电阻电流量程','mA',50,.1,10000,.1),P('rv','电压表内阻（选用量程）','Ω',30000,1,1e9,100),P('ra','电流表内阻（选用量程）','Ω',2,.001,1e5,.1),P('vClass','电压表准确度等级','%',.5,.01,10,.1),P('iClass','电流表准确度等级','%',.5,.01,10,.1),P('divisions','满量程分格数','格',150,10,1000,1),P('diodeV','正向 10 mA 时电压','V',.65,.1,2,.01),P('diodeN','二极管理想因子','',2,1,4,.1),P('zenerV','反向 10 mA 击穿电压（可选）','V',5.1,3.2,100,.1),P('zenerR','击穿区动态电阻','Ω',10,.1,1000,1)],
  formulas:['外接法：I = V/R + V/Rᵥ；R = V/(I−V/Rᵥ)','内接法：V = I(R+Rₐ)；R = V/I−Rₐ','仪器误差限 = 准确度等级 × 量程 / 100；读数误差限 = 半个分格','正向：I = Iₛ[exp(V/(nVₜ))−1]；反向可选表使用稳压二极管击穿模型'],
  note:'表 1-1 的前三列为电压档（V、Ω、V、V），后两列为电流档（mA、Ω、mA、mA）。表 1-6/1-7 为原表可选项；反向 mA 级数据假设使用稳压二极管，不适用于普通硅二极管。',
  simulate(c){
    let {vRange,iRange,rv,ra,vClass,iClass,divisions}=c.params;
    vClass=read(c,'vClass',1,1,1); iClass=read(c,'iClass',1,1,4);
    vRange=read(c,'vRange',1,2,2); iRange=read(c,'iRange',1,2,5);
    rv=read(c,'rv',1,3,2); ra=read(c,'ra',1,3,5);
    Object.assign(c.params,{vRange,iRange,rv,ra,vClass,iClass});
    set(c,1,1,1,vClass,2);set(c,1,1,4,iClass,2);
    [0.2,1,5].forEach((f,j)=>{const k=j+1;set(c,1,2,k,vRange*f,3);set(c,1,3,k,rv*f,1);set(c,1,4,k,get(c,1,2,k)*get(c,1,1,1)/100,4,'computed');set(c,1,5,k,get(c,1,2,k)/(2*divisions),4,'computed');});
    [0.1,1].forEach((f,j)=>{const k=j+4;set(c,1,2,k,iRange*f,3);set(c,1,3,k,ra/f,3);set(c,1,4,k,get(c,1,2,k)*get(c,1,1,4)/100,4,'computed');set(c,1,5,k,get(c,1,2,k)/(2*divisions),4,'computed');});
    for(const large of [false,true]){
      const first=large?4:2,key=large?'largeR':'smallR',samples=[];
      for(const t of [first,first+1]){if(islock(c,t,6,6))samples.push(get(c,t,6,6));if(islock(c,t,6,5)){const ar=get(c,t,6,5);samples.push(t===first?1/(1/ar-1/rv):ar-ra/(large?.1:1));}}
      for(const t of [first,first+1])for(let r=3;r<=5;r++){
        if(islock(c,t,r,6))samples.push(get(c,t,r,6));
        if(islock(c,t,r,1)&&islock(c,t,r,3)){
          const I=get(c,t,r,1)/1000,V=get(c,t,r,3);
          samples.push(t===first?V/(I-V/rv):V/I-ra/(large?.1:1));
        }
      }
      const R=infer(c,key,samples);
      for(const t of [first,first+1]){
        const outside=t===first,IR=iRange*(large?.1:1),RA=ra/(large?.1:1);
        set(c,t,2,1,IR,3);set(c,t,2,2,get(c,t,2,1)*iClass/100,4,'computed');set(c,t,2,3,vRange,3);set(c,t,2,4,get(c,t,2,3)*vClass/100,4,'computed');
        for(let r=3;r<=5;r++){
          const volts=vRange*(.25+.25*(r-3));
          const apparent=outside?1/(1/R+1/rv):R+RA;
          let V=volts,I=V/apparent*1000;
          if(islock(c,t,r,3)){V=get(c,t,r,3);I=V/apparent*1000;}
          else if(islock(c,t,r,1)){I=get(c,t,r,1);V=I/1000*apparent;}
          else if(islock(c,t,r,5)){I=V/get(c,t,r,5)*1000;}
          else if(islock(c,t,r,6)){const CR=get(c,t,r,6);I=V/(outside?1/(1/CR+1/rv):CR+RA)*1000;}
          const constrainedR=islock(c,t,r,5)||islock(c,t,r,6);
          set(c,t,r,3,constrainedR?V:(islock(c,t,r,1)?jitter(c,V):V),constrainedR?6:4);
          if(constrainedR&&!islock(c,t,r,1)){const vv=get(c,t,r,3);const rr=islock(c,t,r,5)?get(c,t,r,5):(outside?1/(1/get(c,t,r,6)+1/rv):get(c,t,r,6)+RA);I=vv/rr*1000;}
          set(c,t,r,1,constrainedR?I:jitter(c,I),constrainedR?8:4);
          V=get(c,t,r,3);I=get(c,t,r,1)/1000;
          if(I<=0||V<0){c.warn(`表 1-${t} 第 ${r-2} 次的电压或电流无效。`);continue;}
          if(V>get(c,t,2,3)||I*1000>get(c,t,2,1))c.warn(`表 1-${t} 第 ${r-2} 次读数超过选用量程。`);
          const rr=V/I,corrected=outside?V/(I-V/rv):rr-RA;
          if(!(corrected>0))c.warn(`表 1-${t} 第 ${r-2} 次校正电阻非正，请检查电压表内阻与电流。`);
          set(c,t,r,5,rr,3,'computed');set(c,t,r,6,corrected,3,'computed');
          check(c,corrected,R,`表 1-${t} 第 ${r-2} 次校正电阻`);
        }
        for(const col of [5,6]){
          const target=islock(c,t,6,col)?get(c,t,6,col):(islock(c,t,7,col)?R*(1+get(c,t,7,col)/100):null);
          if(!finite(target))continue;
          for(let r=5;r>=3;r--){
            if(islock(c,t,r,5)||islock(c,t,r,6)||(islock(c,t,r,1)&&islock(c,t,r,3)))continue;
            const desired=3*target-[3,4,5].filter(n=>n!==r).reduce((a,n)=>a+get(c,t,n,col),0);
            const apparent=col===5?desired:(outside?1/(1/desired+1/rv):desired+RA);
            if(!(apparent>0))break;
            if(islock(c,t,r,1))set(c,t,r,3,get(c,t,r,1)/1000*apparent,8);else set(c,t,r,1,get(c,t,r,3)/apparent*1000,8);
            const rr=get(c,t,r,3)/(get(c,t,r,1)/1000),cr=outside?1/(1/rr-1/rv):rr-RA;
            set(c,t,r,5,rr,3,'computed');set(c,t,r,6,cr,3,'computed');break;
          }
        }
        for(const col of [5,6]){const avg=mean([3,4,5].map(r=>get(c,t,r,col)).filter(finite));set(c,t,6,col,avg,3,'computed');set(c,t,7,col,(avg-R)/R*100,3,'computed');}
      }
    }
    const vt=.02585*c.params.diodeN,Is=10/Math.expm1(c.params.diodeV/vt);
    for(let col=1;col<=6;col++){
      const V=col<6?(col-1)*.1:.5;
      if(col===6)set(c,6,0,col,V,3);
      const actualV=col===6?get(c,6,0,col):V;
      set(c,6,1,col,positive(c,Is*Math.expm1(actualV/vt)),5);
    }
    for(let col=7;col<=12;col++){const I=(col-6)*5;set(c,6,0,col,jitter(c,vt*Math.log1p(I/Is),.02),4);}
    const vz=c.params.zenerV,rz=c.params.zenerR;
    for(let col=1;col<=6;col++){
      const V=[0,1,2,2.5,3,Math.min(3.5,vz-.5)][col-1];
      if(col===6)set(c,7,0,col,V,3);
      const av=col===6?get(c,7,0,col):V;
      const I=av===0?0:Math.max(.0002*av,(av-vz)*1000/rz+10);
      set(c,7,1,col,positive(c,I),5);
    }
    for(let col=7;col<=12;col++){const I=(col-6)*5;set(c,7,0,col,jitter(c,vz+(I-10)/1000*rz,.01),4);}
  },
  measurements(c){return [2,3,4,5].map(t=>({label:`表 1-${t} 校正电阻`,unit:'Ω',values:[3,4,5].map(r=>get(c,t,r,6)).filter(finite),reference:c.params[t<4?'smallR':'largeR']}));}
};

const exp03={
  description:'按示波器垂直、水平灵敏度计算幅度与周期，并按原表李萨如频率比生成信号源读数。',
  parameters:[P('vSens','垂直灵敏度','V/div',1,.001,100,.1),P('tSens','水平灵敏度','ms/div',.2,.0001,1000,.01),P('vpp','信号峰峰值','V',4,.001,1000,.1),P('frequency','正弦信号频率','Hz',1000,.1,1e8,10)],
  formulas:['Vpp = 垂直灵敏度 × 波形高度 H','T = 水平灵敏度 × 一个周期长度 L；f = 1000/T（T 用 ms）','李萨如：fₓ = (Nᵧ/Nₓ)fᵧ；原表固定 fᵧ = 50.00 Hz'],
  note:'表 3-1 垂直灵敏度用 V/div，水平灵敏度用 ms/div，H 与 L 用 div，计算周期用 ms。表 3-2 的 CH2=50.00 Hz 是原表固定条件。',
  simulate(c){
    const vs=read(c,'vSens',1,1,1),ts=read(c,'tSens',1,1,3);
    set(c,1,1,1,vs,4);set(c,1,1,3,ts,5);
    if(!c.fixedParams?.vpp&&islock(c,1,2,1))c.params.vpp=get(c,1,2,1)*vs;
    if(!c.fixedParams?.frequency&&islock(c,1,2,3))c.params.frequency=1000/(get(c,1,2,3)*ts);
    let H=c.params.vpp/vs,L=1000/c.params.frequency/ts;
    if(islock(c,1,3,1)&&!islock(c,1,2,1))H=get(c,1,3,1)/vs;
    if(islock(c,1,3,3)&&!islock(c,1,2,3))L=get(c,1,3,3)/ts;
    set(c,1,2,1,islock(c,1,3,1)?H:jitter(c,H),islock(c,1,3,1)?6:3);set(c,1,2,3,islock(c,1,3,3)?L:jitter(c,L),islock(c,1,3,3)?7:3);
    set(c,1,3,1,get(c,1,1,1)*get(c,1,2,1),4,'computed');set(c,1,3,3,get(c,1,1,3)*get(c,1,2,3),5,'computed');
    if(get(c,1,2,1)>8||get(c,1,2,3)>10)c.warn('波形高度超过 8 div 或周期长度超过 10 div，请调整灵敏度以适配屏幕。');
    const ratios=[1,2,3,1.5,.5];
    ratios.forEach((ratio,i)=>{set(c,2,4,i+2,jitter(c,50*ratio),2);set(c,2,5,i+2,50*ratio,2,'computed');check(c,get(c,2,4,i+2),50*ratio,'李萨如信号源频率');});
  },
  measurements(c){const ratios=[1,2,3,1.5,.5];return [{label:'李萨如换算的参考频率',unit:'Hz',values:ratios.map((r,i)=>finite(get(c,2,4,i+2))?get(c,2,4,i+2)/r:NaN).filter(finite),reference:50}];}
};

function youngParams(c){
  const d=mean(Array.from({length:9},(_,j)=>get(c,1,3,j+2)).filter(finite)),L=get(c,1,8,2),D=get(c,1,8,6),b=get(c,1,8,10);
  return {d,L,D,b};
}
const exp04={
  description:'模拟光杠杆法测杨氏模量：先生成仪器参数与金属丝直径，再生成加载、卸载和平均尺读数。',
  parameters:[P('diameter','金属丝直径','mm',.5,.05,5,.001),P('zero','螺旋测微器零读数','mm',.002,-.1,.1,.001),P('length','金属丝有效长度 L','mm',1000,50,5000,1),P('distance','望远镜至标尺距离 D','mm',1500,100,5000,1),P('lever','光杠杆臂长 b','mm',70,10,200,.1),P('young','杨氏模量','GPa',200,1,1000,1),P('base','2 kg 时标尺读数','mm',20,-1000,1000,.1),P('readError','直径读数误差限','mm',.001,.0001,.1,.001),P('vernierError','游标卡尺误差限','mm',.02,.001,1,.01)],
  formulas:['dᵢ = dᵢ′ − d₀；每级加 1 kg，原表为 2–9 kg','Δn = [(n₇−n₃)+(n₆−n₂)+(n₅−n₁)+(n₄−n₀)]/4','E = 8FLD/(πd²bΔn)，F = 4g，g = 9.79 m/s²'],
  note:'原表所有几何量和标尺读数使用 mm。9 次直径、8 级加载/卸载均按原表保留。结果面板的 E 散布来自 4 组相隔 4 kg 的逐差值，完整 E 不确定度还需传播 L、D、d、b 的误差。',
  simulate(c){
    let zero=read(c,'zero',1,0,2),L=read(c,'length',1,5,2),D=read(c,'distance',1,5,6),b=read(c,'lever',1,5,10);
    if(islock(c,1,8,2)&&!islock(c,1,5,2))L=get(c,1,8,2);if(islock(c,1,8,6)&&!islock(c,1,5,6))D=get(c,1,8,6);if(islock(c,1,8,10)&&!islock(c,1,5,10))b=get(c,1,8,10);
    const ds=[];for(let k=2;k<=10;k++){if(islock(c,1,3,k))ds.push(get(c,1,3,k));else if(islock(c,1,2,k))ds.push(get(c,1,2,k)-zero);}
    const diameter=infer(c,'diameter',ds);
    set(c,1,0,2,zero,3);set(c,1,0,10,c.params.readError,4);
    for(let k=2;k<=10;k++){
      let d=diameter;if(islock(c,1,3,k)&&!islock(c,1,2,k))d=get(c,1,3,k);
      set(c,1,2,k,islock(c,1,3,k)?d+zero:jitter(c,d+zero,d*.15),3);
      set(c,1,3,k,get(c,1,2,k)-get(c,1,0,2),3,'computed');
    }
    set(c,1,5,2,L,1);set(c,1,5,6,D,1);set(c,1,5,10,b,2);
    set(c,1,6,2,.2*get(c,1,5,2)/1000+.3,3,'computed');set(c,1,6,6,.2*get(c,1,5,6)/1000+.3,3,'computed');set(c,1,6,10,c.params.vernierError,3);
    set(c,1,8,2,Math.round(get(c,1,5,2)),0,'computed');set(c,1,8,6,Math.round(get(c,1,5,6)),0,'computed');set(c,1,8,10,get(c,1,5,10),1,'computed');
    const geometry=youngParams(c);L=geometry.L;D=geometry.D;b=geometry.b;const d=geometry.d;
    let E=c.params.young,base=c.params.base,slope=8*G*L*D/(Math.PI*d*d*b*E*1000);
    const points=[];for(let k=1;k<=8;k++)for(const r of [2,3,4])if(islock(c,2,r,k))points.push([k-1,get(c,2,r,k)]);
    const fitted=fit(points);
    if(!c.fixedParams?.young&&fitted&&fitted.slope>0){slope=fitted.slope;E=8*G*L*D/(Math.PI*d*d*b*slope*1000);c.params.young=E;}
    if(!c.fixedParams?.base&&points.length){base=mean(points.map(([x,y])=>y-slope*x));c.params.base=base;}
    for(let k=1;k<=8;k++){
      let load=base+slope*(k-1),unload=load;
      if(islock(c,2,4,k)){
        const m=get(c,2,4,k);
        if(islock(c,2,2,k))unload=2*m-get(c,2,2,k);
        else if(islock(c,2,3,k))load=2*m-get(c,2,3,k);
        else {const dev=c.normal()*c.noise*slope;load=m+dev;unload=m-dev;}
      }else{load=jitter(c,load,slope);unload=jitter(c,unload,slope);}
      set(c,2,2,k,load,2);set(c,2,3,k,unload,2);set(c,2,4,k,(get(c,2,2,k)+get(c,2,3,k))/2,3,'computed');
      check(c,get(c,2,4,k),base+slope*(k-1),`第 ${k-1} 级平均尺读数`,slope);
    }
    if(!(d>0&&L>0&&D>0&&b>0))c.warn('直径和几何长度必须为正。');
  },
  measurements(c){const {d,L,D,b}=youngParams(c);const vals=[];for(let k=1;k<=4;k++){const a=get(c,2,4,k+4),z=get(c,2,4,k),dn=a-z;if(finite(a)&&finite(z)&&dn>0&&[d,L,D,b].every(v=>finite(v)&&v>0))vals.push(8*4*G*L*D/(Math.PI*d*d*b*dn*1000));}return [{label:'逐差法杨氏模量（仅重复性）',unit:'GPa',values:vals,reference:c.params.young}];}
};

const exp06={
  description:'由暗环级次、光源波长和曲率半径生成读数，再按原表计算直径、平方与逐差结果。',
  parameters:[P('wavelength','光源波长','nm',588.995,100,2000,.001),P('radius','透镜曲率半径','mm',1000,10,1e5,1),P('center','测微镜中心位置','mm',10,-1000,1000,.001),P('contact','中心接触偏移级次','级',0,-4,10,.1)],
  formulas:['Dₘ² = 4(m+ε)λR；λ 由 nm 换算成 mm','D = Dᴸ − Dᴿ（采用原表读数方向）','R = 平均(Dₘ²−Dₙ²)/(4×15×λ)'],
  note:'默认波长 588.9950 nm 取自上传公式。两侧坐标采用原表 D=Dᴸ−Dᴿ 的方向；读数单位 mm。ε 表示微小接触偏移，逐差法将其抵消。',
  simulate(c){
    const orders=[30,25,20,15,10,5],lambda=c.params.wavelength*1e-6,offset=c.params.contact;
    const rvals=[],centers=[];
    orders.forEach((m,i)=>{const k=i+2;
      if(islock(c,1,1,k)&&islock(c,1,2,k)){const l=get(c,1,1,k),r=get(c,1,2,k);rvals.push((l-r)**2/(4*(m+offset)*lambda));centers.push((l+r)/2);}
      else if(islock(c,1,3,k))rvals.push(get(c,1,3,k)**2/(4*(m+offset)*lambda));
      else if(islock(c,1,4,k))rvals.push(get(c,1,4,k)/(4*(m+offset)*lambda));
    });
    if(islock(c,1,7,2))rvals.push(get(c,1,7,2));
    if(islock(c,1,6,2))rvals.push(get(c,1,6,2)/(60*lambda));
    for(let i=0;i<3;i++)if(islock(c,1,5,i*2+2))rvals.push(get(c,1,5,i*2+2)/(60*lambda));
    const R=infer(c,'radius',rvals);let center=c.params.center;
    if(!c.fixedParams?.center&&centers.length){center=mean(centers);c.params.center=center;}
    orders.forEach((m,i)=>{const k=i+2;let d=2*Math.sqrt((m+offset)*lambda*R);
      if(islock(c,1,3,k))d=get(c,1,3,k);else if(islock(c,1,4,k))d=Math.sqrt(get(c,1,4,k));
      let left=center+d/2,right=center-d/2;
      if(islock(c,1,1,k)&&!islock(c,1,2,k))right=get(c,1,1,k)-d;
      if(islock(c,1,2,k)&&!islock(c,1,1,k))left=get(c,1,2,k)+d;
      const constrained=islock(c,1,3,k)||islock(c,1,4,k);
      set(c,1,1,k,constrained?left:jitter(c,left,d*.1),constrained?6:3);
      if(constrained&&!islock(c,1,2,k))right=get(c,1,1,k)-d;
      set(c,1,2,k,constrained?right:jitter(c,right,d*.1),constrained?6:3);
      set(c,1,3,k,get(c,1,1,k)-get(c,1,2,k),constrained?6:3,'computed');set(c,1,4,k,get(c,1,3,k)**2,6,'computed');
      if(get(c,1,3,k)<=0)c.warn(`第 ${m} 级 Dᴸ−Dᴿ 非正，请检查读数方向。`);
    });
    // A supplied derived difference or final R is also a constraint: solve a free reading pair.
    function adjustSquare(k,newSquare){
      if(!(newSquare>0)||islock(c,1,3,k)||islock(c,1,4,k)||(islock(c,1,1,k)&&islock(c,1,2,k)))return false;
      const d=Math.sqrt(newSquare);let l=center+d/2,r=center-d/2;
      if(islock(c,1,1,k))r=get(c,1,1,k)-d;else if(islock(c,1,2,k))l=get(c,1,2,k)+d;
      set(c,1,1,k,l,9);set(c,1,2,k,r,9);set(c,1,3,k,get(c,1,1,k)-get(c,1,2,k),9,'computed');set(c,1,4,k,get(c,1,3,k)**2,9,'computed');return true;
    }
    for(let i=0;i<3;i++)if(islock(c,1,5,i*2+2)){
      const target=get(c,1,5,i*2+2),high=i+2,low=i+5;
      if(!adjustSquare(high,get(c,1,4,low)+target))adjustSquare(low,get(c,1,4,high)-target);
    }
    const overall=islock(c,1,6,2)?get(c,1,6,2):(islock(c,1,7,2)?get(c,1,7,2)*60*lambda:null);
    if(finite(overall)){
      const current=[0,1,2].reduce((sum,i)=>sum+get(c,1,4,i+2)-get(c,1,4,i+5),0),change=3*overall-current;
      for(let i=2;i>=0;i--){if(islock(c,1,5,i*2+2))continue;if(adjustSquare(i+2,get(c,1,4,i+2)+change)||adjustSquare(i+5,get(c,1,4,i+5)-change))break;}
    }
    const diffs=[];for(let i=0;i<3;i++){const diff=get(c,1,4,i+2)-get(c,1,4,i+5);diffs.push(diff);set(c,1,5,i*2+2,diff,6,'computed');}
    set(c,1,6,2,mean(diffs),6,'computed');set(c,1,7,2,get(c,1,6,2)/(60*lambda),3,'computed');
    check(c,get(c,1,7,2),R,'牛顿环曲率半径');
  },
  measurements(c){const l=c.params.wavelength*1e-6;return [{label:'三组逐差曲率半径',unit:'mm',values:[0,1,2].map(i=>finite(get(c,1,4,i+2))&&finite(get(c,1,4,i+5))?(get(c,1,4,i+2)-get(c,1,4,i+5))/(60*l):NaN).filter(finite),reference:c.params.radius}];}
};

const exp07={
  description:'根据马吕斯定律、理想四分之一波片和半波片模型生成光电流、极值次数、偏振态及消光角。',
  parameters:[P('intensity','偏振光最大光电流（扣暗电流）','μA',100,.001,1e6,1),P('dark','暗电流','μA',.2,0,1e4,.01),P('offset','马吕斯定律零位偏差','°',0,-10,10,.1),P('extinction','半波片零位的第一消光角','°',90,0,179,.1)],
  formulas:['Iθ = I暗 + I₀ cos²(θ−θ₀)','λ/4 波片：Imax/min = I暗 + I₀[1±|cos(2α)|]/2','λ/2 波片：偏振方向转过 2α；两消光位置相差 180°'],
  note:'原表未印光电流单位，本模型统一用 μA。λ/4 波片在 45° 产生理想圆偏振，转动检偏器无可区分极值；0°、90° 为线偏振，其余为椭圆偏振。角度均以模型零位为参考。',
  simulate(c){
    let dark=c.params.dark,I0=c.params.intensity;const offset=c.params.offset;
    const locked=[];for(let j=0;j<=18;j++){const r=j<10?1:3,k=j<10?j+1:j-9,theta=j*10; if(islock(c,1,r,k))locked.push([Math.cos((theta-offset)*Math.PI/180)**2,get(c,1,r,k)]);}
    const f=fit(locked);
    if(f&&f.slope>0){if(!c.fixedParams?.intensity)I0=f.slope;if(!c.fixedParams?.dark)dark=Math.max(0,f.intercept);}
    else if(locked.length){if(!c.fixedParams?.intensity&&locked[0][0]>.05)I0=Math.max(0,(locked[0][1]-dark)/locked[0][0]);if(!c.fixedParams?.dark&&locked[0][0]<.0001)dark=Math.max(0,locked[0][1]);}
    if(!c.fixedParams?.extinction){const positions=[];for(let j=0;j<7;j++)for(const r of [1,2])if(islock(c,3,r,j+2))positions.push(((get(c,3,r,j+2)-2*j*15)%180+180)%180);if(positions.length)c.params.extinction=positions[0];}
    Object.assign(c.params,{dark,intensity:I0});
    for(let j=0;j<=18;j++){const r=j<10?1:3,k=j<10?j+1:j-9,theta=j*10;const expected=dark+I0*Math.cos((theta-offset)*Math.PI/180)**2;set(c,1,r,k,positive(c,expected,Math.max(expected,I0*.03)),3);check(c,get(c,1,r,k),expected,`偏振 ${theta}° 光电流`,I0);}
    for(let j=0;j<7;j++){
      const a=j*15,col=2*j+1,contrast=Math.abs(Math.cos(2*a*Math.PI/180));
      set(c,2,2,col,j===3?0:2,0,'computed');set(c,2,2,col+1,j===3?0:2,0,'computed');
      let mx=dark+I0*(1+contrast)/2,mn=dark+I0*(1-contrast)/2;
      if(j===3){const v=positive(c,mx);mx=v;mn=v;}else {mx=positive(c,mx);mn=positive(c,mn,Math.max(mn,I0*.03));}
      set(c,2,4,col,mx,3);set(c,2,4,col+1,mn,3);
      set(c,2,5,col,j===0||j===6?'线偏振 Linear':j===3?'圆偏振 Circular':'椭圆偏振 Elliptical',null,'computed');
    }
    for(let j=0;j<7;j++){
      let angle=((c.params.extinction+2*j*15)%180+180)%180;
      if(islock(c,3,2,j+2)&&!islock(c,3,1,j+2))angle=get(c,3,2,j+2)-180;
      set(c,3,1,j+2,jitter(c,angle,.2),2);
      set(c,3,2,j+2,get(c,3,1,j+2)+180,2,'computed');
    }
  },
  measurements(c){const vals=[];for(let j=0;j<=18;j++){const r=j<10?1:3,k=j<10?j+1:j-9,co=Math.cos((j*10-c.params.offset)*Math.PI/180)**2;if(co>.2&&finite(get(c,1,r,k)))vals.push((get(c,1,r,k)-c.params.dark)/co);}return [{label:'马吕斯定律换算 I₀',unit:'μA',values:vals,reference:c.params.intensity}];}
};

export const models={exp01,exp03,exp04,exp06,exp07};
