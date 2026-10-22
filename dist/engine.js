import {models as first} from './models-first.js';
import {models as optics} from './models-optics.js';
import {models as modern} from './models-modern.js';

const models = {...first, ...optics, ...modern};
export function getModel(id) {return models[id] || {parameters:[],description:'该实验尚未配置。',formulas:[],note:''};}
export function parseNumber(value) {
  if(value === null || value === undefined || String(value).trim()==='') return null;
  if(typeof value==='number') return Number.isFinite(value)?value:null;
  let s=String(value).trim().replace(/[−–]/g,'-').replace(/[，,]/g,'');
  const angle=s.match(/^([+-]?\d+(?:\.\d+)?)\s*[°度]\s*(?:(\d+(?:\.\d+)?)\s*['′分])?\s*(?:(\d+(?:\.\d+)?)\s*["″秒])?\s*$/);
  if(angle) {const d=+angle[1],m=+(angle[2]||0),sec=+(angle[3]||0);if(m>=60||sec>=60)return null;return (d<0?-1:1)*(Math.abs(d)+m/60+sec/3600);}
  const pair=s.match(/^([+-]?\d+)\s*[:：]\s*(\d+(?:\.\d+)?)$/);
  if(pair && +pair[2]<60) return (+pair[1]<0?-1:1)*(Math.abs(+pair[1])+(+pair[2])/60);
  if(!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?(?:\s*(?:[a-zA-ZµμΩ°%℃/²³^·−₀-₉-]+))?$/i.test(s))return null;
  const n=parseFloat(s);return Number.isFinite(n)?n:null;
}
function random(seed) {
  let h=2166136261;for(const c of String(seed)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}
  return ()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}
const present=v=>v!==null&&v!==undefined&&String(v).trim()!=='';
function cells(exp){return exp.tables.flatMap(t=>t.rows.flat());}
function normalize(model,state,options,warnings) {
  const params={};
  for(const p of model.parameters || []) {
    let n=Number(state.params?.[p.key] ?? p.default);
    if(!Number.isFinite(n)||n<(p.min??-Infinity)||n>(p.max??Infinity)) {
      warnings.push(`参数「${p.label}」不在允许范围内，请修改后生成。`);
      n=Number(p.default);
    }
    params[p.key]=n;
  }
  return params;
}
function context(exp,state,options,noise,run=0,readonly=false) {
  const model=getModel(exp.id),warnings=[];
  const values={...(state.values||{})},provenance={...(state.provenance||{})};
  const locked={...(state.locked||{})};
  // Rebuild free cells from current constraints; skipped or invalid results must not retain old samples.
  if(!readonly&&options.mode==='regenerate')for(const cell of cells(exp))if(cell.input&&!locked[cell.id]){
    delete values[cell.id];delete provenance[cell.id];
  }
  if(options.mode==='fill')for(const [id,v]of Object.entries(values))if(present(v))locked[id]=true;
  const rng=random(`${options.seed??'20261022'}:${run}`), map=new Map(cells(exp).map(c=>[c.id,c]));
  const params=normalize(model,state,options,warnings);
  const fixedParams={...(state.fixedParams||{})};
  const ctx={exp,params,values,locked,fixedParams,rng,noise:noise/100,
    normal(){return Math.sqrt(-2*Math.log(Math.max(rng(),1e-12)))*Math.cos(2*Math.PI*rng());},
    get(id){const cell=map.get(id);return parseNumber(present(values[id])?values[id]:cell?.text);},
    warn(message){if(!warnings.includes(String(message)))warnings.push(String(message));},
    set(id,value,decimals,kind='generated') {
      const cell=map.get(id);
      if(!cell||!cell.input)return;
      if(readonly){
        if(kind==='computed'&&present(values[id])){
          const a=parseNumber(values[id]),b=parseNumber(value),t=Number.isInteger(decimals)?Math.pow(10,-decimals)*1.1:Math.max(Math.abs(b||0)*1e-4,1e-8);
          if(a!==null&&b!==null&&Math.abs(a-b)>t)ctx.warn(`计算栏 ${id} 与当前原始读数不一致；请点击「生成数据」更新。`);
        }
        return;
      }
      if(typeof value==='number'&&!Number.isFinite(value)){ctx.warn(`单元格 ${id} 无法由当前约束求解，请检查参数。`);return;}
      const formatted=typeof value==='number'&&Number.isInteger(decimals)?value.toFixed(Math.max(0,Math.min(12,decimals))):String(value);
      if(locked[id]&&present(values[id])) {
        if(kind==='computed') {
          const a=parseNumber(values[id]),b=parseNumber(formatted);
          const tolerance=Number.isInteger(decimals)?Math.pow(10,-decimals)*1.1:Math.max(Math.abs(b||0)*1e-4,1e-8);
          if(a!==null&&b!==null&&Math.abs(a-b)>tolerance)ctx.warn(`已锁定的计算结果 ${id} 与原始数据计算值 ${formatted} 不一致，已保留输入。`);
        }
        return;
      }
      values[id]=formatted;provenance[id]=kind;
    }
  };
  return {ctx,values,provenance,warnings,params};
}
function statistics(model,ctx,options) {
  const groups=[];
  const source=typeof model.measurements==='function'?model.measurements(ctx):[];
  const available=(source||[]).filter(g=>(g.values||[]).filter(Number.isFinite).length);
  let primaryIndex=options.measurement?available.findIndex(g=>g.label===options.measurement&&(g.values||[]).filter(Number.isFinite).length>=2):-1;
  if(primaryIndex<0)primaryIndex=available.findIndex(g=>(g.values||[]).filter(Number.isFinite).length>=2);
  for(const group of source || []){
    const arr=(group.values||[]).filter(v=>Number.isFinite(v));
    if(!arr.length)continue;
    const n=arr.length,mean=arr.reduce((a,b)=>a+b,0)/n;
    const s=n>1?Math.sqrt(arr.reduce((a,b)=>a+(b-mean)**2,0)/(n-1)):null;
    const uA=s===null?null:s/Math.sqrt(n);
    const selected=primaryIndex===groups.length;
    const uB=selected&&options.bLimit>0?options.bLimit/Math.sqrt(3):0;
    const uc=uA===null?null:Math.hypot(uA,uB),U=uc===null?null:(options.k||2)*uc;
    groups.push({...group,values:arr,n,mean,s,uA,uB,uc,U,relativeU:mean!==0&&U!==null?Math.abs(U/mean)*100:null,
      relativeError:group.reference?Math.abs((mean-group.reference)/group.reference)*100:null,
      uncertaintyNote:uB>0?'A 类与用户指定 B 类合成':'仅由组内散布估计 A 类，未计仪器 B 类；存在相关性时不可直接作为完整测量不确定度'});
  }
  return {groups,primary:primaryIndex>=0?groups[primaryIndex]:null};
}
function finish(exp,state,options,run,noise,attempts){
  const model=getModel(exp.id),result=context(exp,state,options,noise,run);
  try {model.simulate(result.ctx);}catch(e){result.ctx.warn(`生成遇到问题：${e.message}`);}
  let summary;
  try{summary=statistics(model,result.ctx,options);}catch(e){summary={groups:[],primary:null};result.ctx.warn(`统计未完成：${e.message}`);}
  const editable=cells(exp).filter(c=>c.input),target=options.targetU!==null&&options.targetU!==undefined&&options.targetU!==''?Number(options.targetU):null;
  const primary=summary.primary;
  const meetsTarget=target!==null&&primary?.relativeU!==null&&primary?.relativeU!==undefined?primary.relativeU<=target:null;
  const stats={...summary,generatedCount:editable.filter(c=>present(result.values[c.id])&&result.provenance[c.id]==='generated').length,
    computedCount:editable.filter(c=>present(result.values[c.id])&&result.provenance[c.id]==='computed').length,
    lockedCount:editable.filter(c=>state.locked?.[c.id]&&present(result.values[c.id])).length,
    filledCount:editable.filter(c=>present(result.values[c.id])).length,totalCount:editable.length,
    targetU:target,meetsTarget,actualNoise:noise,seed:String(options.seed||'20261022'),attempts};
  return {values:result.values,provenance:result.provenance,stats,warnings:result.warnings,usedParameters:result.params};
}
export function generate(exp,state={},options={}){
  const opts={seed:'20261022',noise:0.3,k:2,bLimit:0,mode:'regenerate',...options};
  if(!Number.isFinite(+opts.noise)||+opts.noise<0||+opts.noise>30)throw new Error('随机扰动应介于 0% 与 30% 之间。');
  if(!Number.isFinite(+opts.k)||+opts.k<=0)throw new Error('包含因子 k 必须大于 0。');
  if(!Number.isFinite(+opts.bLimit)||+opts.bLimit<0)throw new Error('B 类误差限不能为负。');
  if(opts.targetU!==null&&opts.targetU!==undefined&&opts.targetU!==''&&(!Number.isFinite(+opts.targetU)||+opts.targetU<0))throw new Error('目标相对扩展不确定度不能为负。');
  const model=getModel(exp.id);
  for(const p of model.parameters||[]){const n=Number(state.params?.[p.key]??p.default);if(!Number.isFinite(n)||n<(p.min??-Infinity)||n>(p.max??Infinity))throw new Error(`请检查参数「${p.label}」的有效范围。`);}
  for(const cell of cells(exp))if(cell.input&&state.locked?.[cell.id]&&present(state.values?.[cell.id])&&!/^exp07-t2-r5c/.test(cell.id)&&parseNumber(state.values[cell.id])===null)throw new Error(`单元格 ${cell.id} 需要有效数值（角度可填 35° 20′）；已保留你的输入。`);
  let best=finish(exp,state,opts,0,+opts.noise,1);
  if(best.stats.meetsTarget===false){
    for(let i=1;i<=24;i++){
      const noise=i===24?0:(+opts.noise)*Math.pow(0.72,Math.floor(i/3));
      const test=finish(exp,state,opts,i,noise,i+1);
      if(test.stats.primary?.relativeU<best.stats.primary?.relativeU)best=test;
      if(test.stats.meetsTarget){best=test;break;}
    }
    if(!best.stats.meetsTarget)best.warnings.push('当前锁定数据、读数精度或 B 类误差限使目标不确定度无法达到；显示的是搜索中最接近的一组，未修改锁定数据，也未宣称满足约束。');
  }
  if(best.stats.targetU!==null&&!best.stats.primary)best.warnings.push('此表当前没有足够的同一被测量的重复估计，无法检验指定的不确定度上限。');
  if(best.stats.primary&&!(opts.bLimit>0))best.warnings.push('不确定度面板仅显示 A 类估计，尚未包含仪器误差及完整传播；k 为用户指定的包含因子。');
  if(best.stats.filledCount<best.stats.totalCount)best.warnings.push(`还有 ${best.stats.totalCount-best.stats.filledCount} 个输入项未生成，请按表中说明补充。`);
  return best;
}
export function analyze(exp,state={},options={}){
  const opts={seed:'20261022',noise:0.3,k:2,bLimit:0,...options};
  const result=context(exp,state,{...opts,mode:'analyze'},+opts.noise,0,true);
  if(cells(exp).filter(c=>c.input).every(c=>present(state.values?.[c.id]))){try{getModel(exp.id).simulate(result.ctx);}catch{}}
  let summary={groups:[],primary:null};try{summary=statistics(getModel(exp.id),result.ctx,opts);}catch(e){result.warnings.push(e.message);}
  const editable=cells(exp).filter(c=>c.input);
  return {values:{...state.values},provenance:{...state.provenance},usedParameters:result.params,warnings:result.warnings,stats:{...summary,
    filledCount:editable.filter(c=>present(state.values?.[c.id])).length,totalCount:editable.length,
    lockedCount:editable.filter(c=>state.locked?.[c.id]&&present(state.values?.[c.id])).length,
    generatedCount:editable.filter(c=>state.provenance?.[c.id]==='generated').length,computedCount:editable.filter(c=>state.provenance?.[c.id]==='computed').length,
    targetU:opts.targetU??null,meetsTarget:opts.targetU!==null&&opts.targetU!==undefined&&summary.primary?.relativeU!==null&&summary.primary?.relativeU!==undefined?summary.primary.relativeU<=Number(opts.targetU):null,seed:opts.seed,actualNoise:opts.noise,attempts:0}};
}
