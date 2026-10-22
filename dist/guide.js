// Guide-only progress: never reads or writes worksheet project storage.
const key='labform-guide-checklist-v1';
const checkboxes=[...document.querySelectorAll('[data-step]')];
let completed=[];
try{const parsed=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(parsed))completed=parsed.filter(x=>typeof x==='string');}catch{}
function renderProgress(){
  const count=checkboxes.filter(input=>input.checked).length;
  document.querySelector('#progressText').textContent=`已完成 ${count} / ${checkboxes.length} 步`;
  document.querySelector('#guideProgress').value=count;
  checkboxes.forEach(input=>input.closest('.walkthrough').classList.toggle('complete',input.checked));
}
for(const input of checkboxes){input.checked=completed.includes(input.dataset.step);input.addEventListener('change',()=>{try{localStorage.setItem(key,JSON.stringify(checkboxes.filter(c=>c.checked).map(c=>c.dataset.step)));}catch{}renderProgress();});}
document.querySelector('#resetChecklist').addEventListener('click',()=>{checkboxes.forEach(input=>input.checked=false);try{localStorage.removeItem(key);}catch{}renderProgress();});
renderProgress();
const links=[...document.querySelectorAll('.contents nav a')],sections=links.map(a=>document.querySelector(a.getAttribute('href'))).filter(Boolean);
const setActive=id=>links.forEach(a=>{const active=a.getAttribute('href')===`#${id}`;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>{const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);if(visible.length)setActive(visible[0].target.id);},{rootMargin:'-100px 0px -65% 0px',threshold:0});
  sections.forEach(section=>observer.observe(section));
}
links.forEach(link=>link.addEventListener('click',()=>setActive(link.hash.slice(1))));
setActive(location.hash.slice(1)||'quickstart');
