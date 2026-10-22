import { getModel, generate, analyze } from './engine.js';
import { createDocx } from './export-docx.js';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const demoMode = new URLSearchParams(location.search).get('demo') === 'spectrometer';
const STORAGE = demoMode ? 'labform-spectrometer-demo-v1' : 'labform-projects-v1';
const englishNames = {exp01:'Resistance measurement · Volt–ampere method',exp03:'Oscilloscope · Signal measurement',exp04:'Young’s modulus of a metal wire',exp06:'Newton’s rings · Radius of curvature',exp07:'Polarization of light · Malus’s law',exp08:'Michelson interferometer',exp09:'Spectrometer · Prism & mercury spectrum',exp10:'Franck–Hertz experiment',exp11:'Millikan oil-drop experiment',exp12:'Bridge circuits & electronic balance',exp13:'Measurement of ultrasonic velocity',exp14:'Photoelectric effect · Planck’s constant',exp15:'Thermocouple · Thermoelectric potential'};
const tableTitles = {
exp01:['仪表参数与读数误差','小电阻 · 电流表外接法','小电阻 · 电流表内接法','大电阻 · 电流表外接法','大电阻 · 电流表内接法','二极管正向伏安特性','二极管反向伏安特性'],
exp03:['正弦信号的电压与周期','李萨如图形与频率'],exp04:['仪器参数','加载与卸载读数'],exp06:['牛顿环与曲率半径'],exp07:['马吕斯定律','偏振光的测量','偏振特性'],exp08:['氦氖激光波长','空气折射率'],exp09:['三棱镜顶角的测量','汞灯光谱波长的测量'],exp10:['手动测量 · 氩原子第一激发电势','计算机测量 · 数据组一','计算机测量 · 数据组二'],exp11:['油滴平衡电压与下落时间'],exp12:['四分之一电桥','半桥电路','电子秤灵敏度','待测物体质量','输入电压与输出电压'],exp13:['驻波法','相位比较法'],exp14:['遏止电压与光频率','光电管伏安特性'],exp15:['热电偶温度与热电动势']};
let experiments = [], currentId = 'exp09', semester = 2, stateStore = {}, currentView = 'tables', lastResult = null, toastTimer;
try { stateStore = JSON.parse(localStorage.getItem(STORAGE) || '{}'); } catch { stateStore = {}; }
const current = () => experiments.find(e => e.id === currentId);
const model = () => { try { return getModel(currentId) || {}; } catch { return {}; } };
function state() {
  if (!stateStore[currentId]) stateStore[currentId] = {values:{}, locked:{}, provenance:{}, params:{}, fixedParams:{}, options:{seed:'',seedFixed:false,noise:0.3,targetU:null,k:2,bLimit:0}};
  const s = stateStore[currentId];
  s.values ||= {}; s.locked ||= {}; s.provenance ||= {}; s.params ||= {}; s.fixedParams ||= {}; s.options ||= {seed:'',seedFixed:false,noise:0.3,targetU:null,k:2,bLimit:0};
  for (const p of model().parameters || []) if (!(p.key in s.params)) s.params[p.key] = p.default;
  return s;
}
function persist() {
  try { localStorage.setItem(STORAGE, JSON.stringify(stateStore)); $('#saveStatus').innerHTML=demoMode?'<i></i> 案例进度已保存':'<i></i> 已自动保存'; }
  catch { $('#saveStatus').textContent='当前浏览器无法保存'; }
}
function toast(message) { $('#toast').textContent=message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3200); }
function options() {
  const enteredSeed=$('#seed').value.trim();
  return {seed:enteredSeed || state().options.seed || '', seedFixed:enteredSeed!=='', noise:Number($('#noise').value), targetU:$('#targetU').value.trim()===''?null:Number($('#targetU').value), k:Number($('#coverageK').value)||2, bLimit:Number($('#bLimit').value)||0, measurement:$('#measurement').value || state().options?.measurement || '', mode:'regenerate'};
}
function renderSeedHint() {$('#lastSeed').textContent=state().lastGeneratedSeed?`上次生成种子：${state().lastGeneratedSeed}`:'';}
function setOptions(o) {
  $('#seed').value=o.seedFixed===false?'':(o.seed ?? ''); $('#noise').value=o.noise ?? 0.3; $('#noiseLabel').textContent=`${$('#noise').value}%`; $('#targetU').value=o.targetU ?? ''; $('#coverageK').value=o.k ?? 2; $('#bLimit').value=o.bLimit || '';renderSeedHint();
  $('#measurement').innerHTML=`<option value="${escapeHTML(o.measurement||'')}">${escapeHTML(o.measurement||'生成后可选择')}</option>`;
}
function renderNav() {
  const query=$('#experimentSearch').value.trim().toLowerCase();
  const list=experiments.filter(e=>(query || e.semester===semester) && (!query || `${e.name} ${e.number} ${englishNames[e.id]}`.toLowerCase().includes(query)));
  $('#experimentNav').innerHTML=list.length?list.map(e=>`<button class="experiment-item ${e.id===currentId?'active':''}" data-exp="${e.id}" aria-current="${e.id===currentId?'page':'false'}"><span class="experiment-number">${String(e.number).padStart(2,'0')}</span><span>${escapeHTML(e.name)}</span><span class="arrow">›</span></button>`).join(''):'<p class="no-experiments">没有匹配的实验</p>';
  $$('[data-semester]').forEach(b=>b.classList.toggle('active',Number(b.dataset.semester)===semester));
  $('#experimentCount').textContent=experiments.length;
}
const lockSVG='<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="7" width="8" height="7" rx="1"/><path d="M5.5 7V4a2.5 2.5 0 0 1 5 0v3"/></svg>';
const unlockSVG='<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="7" width="8" height="7" rx="1"/><path d="M5.5 7V4a2.5 2.5 0 0 1 5 0"/></svg>';
function renderCell(cell, s) {
  const span=`${cell.rowspan>1?` rowspan="${cell.rowspan}"`:''}${cell.colspan>1?` colspan="${cell.colspan}"`:''}`;
  if(cell.kind==='image') return `<td${span} class="static-cell"><img src="${escapeHTML(cell.image)}" alt="${escapeHTML(cell.alt || '原表李萨如图形')}" class="table-image"></td>`;
  if (!cell.input) {const tag=cell.kind==='spacer'?'td':(cell.r<2?'th':'td'); return `<${tag}${span} class="${tag==='td'?'static-cell':''}">${escapeHTML(cell.text || '')}</${tag}>`;}
  const value=s.values[cell.id] ?? '', provenance=s.provenance[cell.id] || '', locked=!!s.locked[cell.id];
  return `<td${span} class="input-cell ${value!==''?`is-${locked?'manual':provenance}`:''}" data-cell="${cell.id}">${cell.inlineLabel?`<div class="inline-label">${escapeHTML(cell.text)}</div>`:''}<div class="cell-inner"><input type="text" inputmode="decimal" autocomplete="off" data-cell-input="${cell.id}" aria-label="${escapeHTML(cell.id)}${cell.inlineLabel?' '+escapeHTML(cell.text):''}" title="${escapeHTML(cell.id)} · 输入后自动锁定，支持小数与度分秒" placeholder="—" value="${escapeHTML(value)}"><button class="cell-lock ${locked?'locked':''}" data-lock="${cell.id}" title="${locked?'已锁定，点击允许重新生成':'点击锁定当前值'}" aria-label="${locked?'解锁':'锁定'} ${cell.id}">${locked?lockSVG:unlockSVG}</button></div></td>`;
}
function renderTables() {
  const e=current(), s=state();
  $('#tablesContainer').innerHTML=e.tables.map((t,i)=>`<article class="table-card" id="${t.id}"><div class="table-heading"><div><div class="table-index">DATA TABLE ${String(i+1).padStart(2,'0')}</div><h3>${escapeHTML(tableTitles[e.id]?.[i] || t.title)}</h3><p>${escapeHTML(t.title)}</p></div><div class="table-tools"><button data-clear-table="${t.id}" aria-label="清空这张表" title="清空这张表">⌫</button></div></div><div class="table-scroll"><table class="data-table ${t.colCount>8?'wide':''}" style="${t.colCount>8?`min-width:${t.colCount*76}px`:''}" aria-label="${escapeHTML(t.title)}"><tbody>${t.rows.map(row=>`<tr>${row.map(cell=>renderCell(cell,s)).join('')}</tr>`).join('')}</tbody></table></div>${(t.notes||[]).length?`<p class="source-paragraph">${escapeHTML(t.notes.join('\n'))}</p>`:''}<div class="table-bottom">${lockSVG}<span>直接输入读数即可锁定；生成时保留锁定值并更新其余数据。</span></div></article>`).join('');
  $('#tableCount').textContent=e.tables.length;
  updateCounts();
}
function updateCounts() {
  const s=state(), cells=current().tables.flatMap(t=>t.rows.flat().filter(c=>c.input));
  const filled=cells.filter(c=>s.values[c.id]!==undefined && String(s.values[c.id]).trim()!=='').length;
  const locked=cells.filter(c=>s.locked[c.id] && String(s.values[c.id]??'').trim()!=='').length;
  $('#filledCount').textContent=`${filled} / ${cells.length} 个单元格已填写${locked?` · ${locked} 个已锁定`:''}`;
}
function renderParameters() {
  const m=model(),s=state();
  $('#parameterFields').innerHTML=(m.parameters||[]).map(p=>`<div class="field parameter-field"><label for="param-${p.key}">${escapeHTML(p.label)} <span>${escapeHTML(p.unit||'')}</span></label><div class="parameter-input"><input type="number" id="param-${p.key}" data-param="${p.key}" value="${escapeHTML(s.params[p.key])}"${p.min!==undefined?` min="${p.min}"`:''}${p.max!==undefined?` max="${p.max}"`:''} step="any"><label class="fixed-param" title="勾选后作为固定参数；未勾选时可由已填数据推断"><input type="checkbox" data-fixed="${p.key}" ${s.fixedParams[p.key]?'checked':''}><span>固定</span></label></div>${p.help||p.note?`<p class="control-hint">${escapeHTML(p.help||p.note)}</p>`:''}</div>`).join('') || '<p class="control-hint">此实验使用表中已填数据作为约束。</p>';
  $('#modelContainer').innerHTML=`<h3>${escapeHTML(current().name)} · 生成模型</h3><p>${escapeHTML(m.description||'按照实验关系生成读数，并以已填写的单元格作为固定条件。')}</p>${(m.formulas||[]).map(f=>`<div class="formula-box">${escapeHTML(typeof f==='string'?f:JSON.stringify(f))}</div>`).join('')}<p class="model-note">${escapeHTML(m.note||'手动填写与勾选固定的参数具有优先级；不相容的条件会显示检查提示。')}</p><div class="model-source">原表来源：${escapeHTML(current().source)}<br>表内的标题、单位、预填常量及合并单元格来自上传资料。</div>`;
}
function fmt(n) {
  if(n===null || n===undefined || n==='') return '—';
  if(typeof n!=='number') return escapeHTML(n);
  if(!Number.isFinite(n)) return '—';
  if(n!==0 && (Math.abs(n)<0.001 || Math.abs(n)>=1e6)) return n.toExponential(4);
  return Number(n.toPrecision(6)).toLocaleString('en-US',{maximumSignificantDigits:6,useGrouping:false});
}
function renderStats(result) {
  const st=result?.stats, warns=(result?.warnings||[]).filter(Boolean);
  if(!st || !(st.filledCount || Object.values(state().values).some(v=>String(v).trim()))) { $('#statsContainer').innerHTML='<p class="empty-results">生成后查看计算结果、约束状态与不确定度。</p>'; $('#resultIndicator').textContent='待生成'; $('#resultIndicator').className='result-indicator'; return; }
  const p=st.primary || st.groups?.find(g=>Number.isFinite(g.mean));
  const chosen=state().options?.measurement || $('#measurement').value;
  const groups=(st.groups||[]).filter(g=>g.n>=2);
  $('#measurement').innerHTML=groups.length?'<option value="">首个有效统计量（默认）</option>'+groups.map(g=>`<option value="${escapeHTML(g.label)}">${escapeHTML(g.label)}</option>`).join(''):'<option value="">生成后可选择</option>';
  if(groups.some(g=>g.label===chosen))$('#measurement').value=chosen;
  $('#bUnit').textContent=p?.unit || '结果单位';
  const rows=[];
  if(p) {
    rows.push([p.label||'结果均值',`${fmt(p.mean)} ${escapeHTML(p.unit||'')}`]);
    if(p.n!==undefined) rows.push(['有效样本数',fmt(p.n)]);
    if(p.uA!==undefined) rows.push(['A 类标准不确定度',`${fmt(p.uA)} ${escapeHTML(p.unit||'')}`]);
    if(p.uB!==undefined) rows.push(['B 类标准不确定度',`${fmt(p.uB)} ${escapeHTML(p.unit||'')}`]);
    if(p.U!==undefined) rows.push([`扩展不确定度 U (k=${options().k})`,`${fmt(p.U)} ${escapeHTML(p.unit||'')}`]);
    if(p.relativeU!==undefined) rows.push(['相对扩展不确定度',`${fmt(p.relativeU)} %`]);
  }
  if(st.generatedCount!==undefined) rows.push(['生成 / 计算单元格',`${st.generatedCount} / ${st.computedCount||0}`]);
  if(st.targetU!==null && st.targetU!==undefined) rows.push(['不确定度上限',`${fmt(st.targetU)} %`]);
  $('#statsContainer').innerHTML=(rows.length?rows.map(([k,v])=>`<div class="stat-row"><span class="stat-label">${escapeHTML(k)}</span><span class="stat-value">${v}</span></div>`).join(''):'<p class="empty-results">数据已保存，尚无足够读数计算不确定度。</p>')+(options().bLimit===0?'<p class="control-hint uncertainty-note">仅 A 类估计；未计仪器 B 类。</p>':'')+(st.targetU!=null&&p?`<p class="control-hint">上限校验对象：${escapeHTML(p.label||'首个有效统计量')}。</p>`:'')+(warns.length?`<ul class="warning-list">${warns.map(w=>`<li>${escapeHTML(typeof w==='string'?w:w.message||JSON.stringify(w))}</li>`).join('')}</ul>`:'');
  $('#resultIndicator').textContent=st.meetsTarget===false?'未达上限':warns.length?'有提示':'已检查';
  $('#resultIndicator').className=`result-indicator ${warns.length||st.meetsTarget===false?'warning':'ready'}`;
}
function refreshAnalysis() {try {lastResult=analyze(current(),state(),options()); renderStats(lastResult);}catch(err){ console.warn('Analysis pending:',err); }}
function selectExperiment(id) {
  currentId=id; const e=current(); if(!e)return; semester=e.semester; currentView='tables'; lastResult=null;
  $('#eyebrow').textContent=`第${e.semester===1?'一':'二'}学期 · EXPERIMENT ${String(e.number).padStart(2,'0')}`;
  $('#experimentTitle').textContent=e.name; $('#experimentSubtitle').textContent=englishNames[e.id] || '填写已有读数，以固定条件为约束生成模拟数据。';
  $('#sourceLabel').textContent=`来源：${e.source}`; $('#generationMessage').textContent='';
  setOptions(state().options); renderNav(); renderTables(); renderParameters(); switchView('tables');refreshAnalysis();
  $('#sidebar').classList.remove('open');
}
function switchView(view) {currentView=view;$('#tablesContainer').classList.toggle('hidden',view!=='tables');$('#modelContainer').classList.toggle('hidden',view!=='model');$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));}
function validateControls() {
  for(const input of $$('.constraints-panel input[type=number]')) {if(!input.checkValidity()){input.reportValidity();return false;}}
  if(options().k<=0){toast('包含因子 k 应大于 0');return false;}return true;
}
async function runGeneration() {
  if(!validateControls())return;
  const e=current(),s=state(),o=options();
  if(!o.seedFixed)o.seed=Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16).padStart(8,'0')).join('');
  $('#generateButton').disabled=true;$('#generationMessage').textContent='正在按当前约束生成并检查数据…';
  await new Promise(resolve=>requestAnimationFrame(resolve));
  try {
    const before={...s.values}; const result=await generate(e,s,o);
    s.options={...o};s.lastGeneratedSeed=o.seed;
    if(result.values) s.values=result.values;
    if(result.provenance) s.provenance=result.provenance;
    for(const [id,locked] of Object.entries(s.locked)) if(locked && before[id]!==undefined){s.values[id]=before[id];s.provenance[id]='manual';}
    if(result.usedParameters) for(const [key,value] of Object.entries(result.usedParameters)) if(!s.fixedParams[key]) s.params[key]=value;
    lastResult=result;persist();renderTables();renderParameters();renderStats(result);renderSeedHint();
    const changed=Object.keys(s.values).filter(id=>s.values[id]!==before[id]).length;
    $('#generationMessage').textContent=changed?`已更新 ${changed} 个单元格，锁定数据已保留。`:'已按当前约束完成生成，结果无需改变；锁定数据已保留。';
    toast(changed?'模拟数据已生成':'检查完成');
  } catch(error) {$('#generationMessage').textContent=`暂时无法生成：${error.message||'请检查输入条件'}`;toast('请检查参数与已填写的数据');console.error(error);}
  finally {$('#generateButton').disabled=false;}
}
function clearCells(tableId=null) {
  const s=state(),tables=tableId?current().tables.filter(t=>t.id===tableId):current().tables;
  const ids=tables.flatMap(t=>t.rows.flat().filter(c=>c.input).map(c=>c.id));
  if(!ids.some(id=>s.values[id]!==undefined && s.values[id]!==''))return;
  if(!confirm(tableId?'清空这张表的所有数据与锁定状态？':'清空当前实验的所有数据与锁定状态？仪器参数将保留。'))return;
  ids.forEach(id=>{delete s.values[id];delete s.locked[id];delete s.provenance[id];});persist();renderTables();refreshAnalysis();$('#generationMessage').textContent='';toast('已清空数据');
}
function download(filename,content,type) {const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function exportData(format) {
  $('#exportMenu').classList.add('hidden');const e=current(),s=state(),stamp=new Date().toISOString().slice(0,10),name=`LabForm-${e.id}-${stamp}`;
  if(format==='json'){download(`${name}.json`,JSON.stringify({format:'LabForm',version:1,provenance:'SIMULATED',experimentId:e.id,experimentName:e.name,source:e.source,exportedAt:new Date().toISOString(),state:{...s,options:options()},analysis:lastResult?.stats||null},null,2),'application/json;charset=utf-8');toast('项目已导出，可再次导入');return;}
  if(format==='csv') {
    const quote=x=>`"${String(x??'').replace(/"/g,'""')}"`;const rows=[['SIMULATED DATA','模拟数据，仅用于预习与计算练习'],['Experiment',e.name],['Source',e.source],['Seed',options().seed],['Provenance','手动=manual，生成=generated，计算=computed'],[]];
    for(const t of e.tables){rows.push([t.title]);for(const row of t.rows){const out=Array(t.colCount).fill('');for(const c of row)out[c.c]=c.input?(s.values[c.id]??''):c.text||c.alt||'';rows.push(out);}rows.push([]);}
    rows.push(['Cell ID','Value','Provenance','Locked']);for(const t of e.tables)for(const c of t.rows.flat().filter(c=>c.input))rows.push([c.id,s.values[c.id]??'',s.provenance[c.id]||'',!!s.locked[c.id]]);
    download(`${name}.csv`,'\ufeff'+rows.map(r=>r.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8');toast('CSV 已导出');return;
  }
  if(format==='word') {
    try {const blob=await createDocx(e,s,options());download(`${name}.docx`,blob,'application/vnd.openxmlformats-officedocument.wordprocessingml.document');toast('Word 文档已导出');}catch(err){toast('Word 导出失败，请重试');console.error(err);}return;
  }
  if(format==='print'){switchView('tables');window.print();}
}
async function importProject(file) {
  try {const p=JSON.parse(await file.text());if(p.format!=='LabForm'||p.version!==1||!experiments.some(e=>e.id===p.experimentId)||!p.state)throw new Error('请选择 LabForm 导出的 JSON 项目');
    const e=experiments.find(e=>e.id===p.experimentId), allowed=new Set(e.tables.flatMap(t=>t.rows.flat().filter(c=>c.input).map(c=>c.id)));
    const clean={values:{},locked:{},provenance:{},params:{},fixedParams:{},options:{}};
    for(const [key,value] of Object.entries(p.state.values||{}))if(allowed.has(key)&&['string','number'].includes(typeof value)){clean.values[key]=String(value).slice(0,200);clean.locked[key]=!!p.state.locked?.[key];clean.provenance[key]=['manual','generated','computed'].includes(p.state.provenance?.[key])?p.state.provenance[key]:'manual';}
    for(const param of getModel(e.id)?.parameters||[]) {const n=Number(p.state.params?.[param.key]);if(Number.isFinite(n)){clean.params[param.key]=n;clean.fixedParams[param.key]=!!p.state.fixedParams?.[param.key];}}
    const o=p.state.options||{};clean.options={seed:String(o.seed??'').slice(0,80),seedFixed:o.seedFixed===undefined?!!o.seed:!!o.seedFixed,noise:Math.max(0,Math.min(3,Number(o.noise)||0)),targetU:o.targetU==null?null:Math.max(0,Number(o.targetU)||0),k:Math.max(.1,Number(o.k)||2),bLimit:Math.max(0,Number(o.bLimit)||0),measurement:String(o.measurement||'').slice(0,200)};
    if(p.state.lastGeneratedSeed)clean.lastGeneratedSeed=String(p.state.lastGeneratedSeed).slice(0,80);
    if(Object.values(stateStore[e.id]?.values||{}).some(v=>String(v).trim())&&!confirm('导入将替换这个实验当前保存的数据，是否继续？'))return;
    stateStore[e.id]=clean;persist();selectExperiment(e.id);toast('项目已导入，约束与读数已恢复');
  }catch(error){toast(error.message||'文件格式无效');}
}
document.addEventListener('click',event=>{
  const exp=event.target.closest('[data-exp]');if(exp){selectExperiment(exp.dataset.exp);return;}
  const sem=event.target.closest('[data-semester]');if(sem){semester=Number(sem.dataset.semester);$('#experimentSearch').value='';renderNav();return;}
  const view=event.target.closest('[data-view]');if(view){switchView(view.dataset.view);return;}
  const lock=event.target.closest('[data-lock]');if(lock){const s=state(),id=lock.dataset.lock;if(String(s.values[id]??'').trim()==='')return;s.locked[id]=!s.locked[id];persist();renderTables();refreshAnalysis();return;}
  const clear=event.target.closest('[data-clear-table]');if(clear){clearCells(clear.dataset.clearTable);return;}
  const ex=event.target.closest('[data-export]');if(ex){exportData(ex.dataset.export);return;}
  if(!event.target.closest('.export-wrap'))$('#exportMenu').classList.add('hidden');
});
$('#tablesContainer').addEventListener('input',event=>{
  const input=event.target.closest('[data-cell-input]');if(!input)return;const id=input.dataset.cellInput,s=state();s.values[id]=input.value;s.locked[id]=input.value.trim()!=='';s.provenance[id]=input.value.trim()!==''?'manual':'';
  const td=input.closest('td');td.className=`input-cell ${s.locked[id]?'is-manual':''}`;const button=$('.cell-lock',td);button.classList.toggle('locked',s.locked[id]);button.innerHTML=s.locked[id]?lockSVG:unlockSVG;button.title=s.locked[id]?'已锁定，点击允许重新生成':'点击锁定当前值';
  persist();updateCounts();refreshAnalysis();
});
$('#parameterFields').addEventListener('input',event=>{
  const input=event.target.closest('[data-param]');if(!input)return;const s=state(),key=input.dataset.param;if(input.value.trim()!==''&&Number.isFinite(Number(input.value))){s.params[key]=Number(input.value);s.fixedParams[key]=true;const cb=$(`[data-fixed="${key}"]`);if(cb)cb.checked=true;persist();refreshAnalysis();}
});
$('#parameterFields').addEventListener('change',event=>{const cb=event.target.closest('[data-fixed]');if(cb){state().fixedParams[cb.dataset.fixed]=cb.checked;persist();refreshAnalysis();}});
for(const id of ['noise','targetU','coverageK','bLimit','seed'])$(`#${id}`).addEventListener('input',()=>{$('#noiseLabel').textContent=`${$('#noise').value}%`;state().options=options();persist();refreshAnalysis();});
$('#measurement').addEventListener('change',()=>{const hadB=Number($('#bLimit').value)>0;$('#bLimit').value='';state().options={...options(),measurement:$('#measurement').value,bLimit:0};persist();refreshAnalysis();if(hadB)toast('已切换被测量，请按新的结果单位重新设置 B 类误差限');});
$('#experimentSearch').addEventListener('input',renderNav);
$('#generateButton').addEventListener('click',runGeneration);
$('#clearButton').addEventListener('click',()=>clearCells());
$('#resetParameters').addEventListener('click',()=>{state().params={};state().fixedParams={};state();renderParameters();persist();refreshAnalysis();toast('已恢复默认参数');});
$('#exportButton').addEventListener('click',()=>$('#exportMenu').classList.toggle('hidden'));
$('#importButton').addEventListener('click',()=>$('#importFile').click());
$('#importFile').addEventListener('change',event=>{if(event.target.files[0])importProject(event.target.files[0]);event.target.value='';});
$('#helpButton').addEventListener('click',()=>{location.href='./guide.html';});
$('#mobileMenu').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
$('#workspaceButton').addEventListener('click',()=>{switchView('tables');window.scrollTo({top:0,behavior:'smooth'});});
async function resetDemo() {
  const response=await fetch('./examples/spectrometer-start.json');
  if(!response.ok)throw new Error('案例文件加载失败');
  const example=await response.json();
  stateStore={exp09:example.state};persist();selectExperiment('exp09');
}
if(demoMode){
  document.body.classList.add('demo-mode');
  const banner=document.createElement('div');banner.className='demo-banner';
  banner.innerHTML='<div><strong>分光计案例工作台</strong><p>这里的读数是练习示例，案例进度单独保存，不会覆盖正式工作台的数据。</p></div><div class="demo-actions"><a href="./guide.html#case">对照案例步骤</a><button id="resetDemo" type="button">重置案例</button><a href="./index.html">返回正式工作台 ↗</a></div>';
  $('#main').prepend(banner);
  $('#resetDemo').addEventListener('click',async()=>{if(!confirm('重新载入案例初始读数与参数？只会清除案例进度，正式工作台不受影响。'))return;try{await resetDemo();toast('案例已重置为两个已填读数');}catch(error){toast(error.message);}});
}
try {const response=await fetch('./tables.json');if(!response.ok)throw new Error('表格资源加载失败');const data=await response.json();experiments=data.experiments;if(demoMode&&!stateStore.exp09)await resetDemo();else selectExperiment(experiments.some(e=>e.id==='exp09')?'exp09':experiments[0].id);}
catch(error){$('#tablesContainer').innerHTML=`<div class="loading">${escapeHTML(error.message)}。请刷新页面重试。</div>`;console.error(error);}
