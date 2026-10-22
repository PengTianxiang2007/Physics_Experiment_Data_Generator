// Minimal standards-compliant OOXML document, packaged as an uncompressed ZIP.
// Uses the same table schema as the worksheet, retaining horizontal/vertical merges.
const enc=new TextEncoder();
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function crc32(data){let c=0xffffffff;for(const b of data){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function zip(files){
  const parts=[],central=[];let offset=0;
  for(const [name,content]of Object.entries(files)){
    const bytes=typeof content==='string'?enc.encode(content):content,n=enc.encode(name),crc=crc32(bytes);
    const h=new Uint8Array(30+n.length),v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,n.length,true);h.set(n,30);
    parts.push(h,bytes);
    const ch=new Uint8Array(46+n.length),cv=new DataView(ch.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint32(16,crc,true);cv.setUint32(20,bytes.length,true);cv.setUint32(24,bytes.length,true);cv.setUint16(28,n.length,true);cv.setUint32(42,offset,true);ch.set(n,46);central.push(ch);offset+=h.length+bytes.length;
  }
  const size=central.reduce((s,b)=>s+b.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,central.length,true);ev.setUint16(10,central.length,true);ev.setUint32(12,size,true);ev.setUint32(16,offset,true);
  return new Blob([...parts,...central,end],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}
function p(text,{bold=false,size=18,color='172B27',center=false,keep=false}={}){
 return `<w:p><w:pPr><w:spacing w:after="30" w:before="30"/>${center?'<w:jc w:val="center"/>':''}${keep?'<w:keepNext/>':''}</w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Noto Serif CJK SC"/>${bold?'<w:b/>':''}<w:color w:val="${color}"/><w:sz w:val="${size}"/></w:rPr>${String(text).split('\n').map((line,i)=>(i?'<w:br/>':'')+`<w:t xml:space="preserve">${esc(line)}</w:t>`).join('')}</w:r></w:p>`;
}
export async function createDocx(experiment,state={},options={}){
 const files={},rels=[],types=[];let imageId=0;
 async function imageMarkup(cell){
  const src=cell.image||cell.imageSrc||cell.images?.[0];
  if(!src)return '';
  const url=typeof src==='string'?src:src.src;
  if(!url)return '';
  try{
   const response=await fetch(url);if(!response.ok)return '';
   const bytes=new Uint8Array(await response.arrayBuffer()),ext=url.toLowerCase().endsWith('.jpg')?'jpg':'png',idx=++imageId;
   files[`word/media/image${idx}.${ext}`]=bytes;types.push(ext);
   rels.push(`<Relationship Id="rId${idx}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${idx}.${ext}"/>`);
   return `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="720000" cy="720000"/><wp:docPr id="${idx}" name="Lissajous ${idx}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${idx}" name="pattern"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId${idx}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="720000" cy="720000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  }catch{return '';}
 }
 let body=p(`${experiment.name} · 实验模拟数据`,{bold:true,size:30})+p('SIMULATED DATA · 用于学习、预习与数据处理练习',{size:18,color:'477467'})+p(`表格来源：${experiment.source}    随机种子：${options.seed??''}`,{size:16});
 body+=p('单元格底色：浅蓝为手动数据；浅绿为模拟生成；浅灰为公式计算。保留原表的标题、单位与合并结构。',{size:15,color:'5E6D68'});
 for(const table of experiment.tables){
  body+=p(table.title,{bold:true,size:20,keep:true});
  const width=15500,first=table.colCount>8?2200:2300,other=Math.floor((width-first)/(table.colCount-1)),widths=Array.from({length:table.colCount},(_,i)=>i?other:first);
  const occupancy=Array.from({length:table.rowCount},()=>Array(table.colCount));
  for(const row of table.rows)for(const cell of row)for(let r=cell.r;r<cell.r+cell.rowspan;r++)for(let c=cell.c;c<cell.c+cell.colspan;c++)occupancy[r][c]=cell;
  let rows='';
  for(let r=0;r<table.rowCount;r++){
   let cells='';
   for(let col=0;col<table.colCount;){
    const cell=occupancy[r][col];if(!cell){cells+=`<w:tc><w:tcPr><w:tcW w:w="${widths[col]}" w:type="dxa"/></w:tcPr>${p('')}</w:tc>`;col++;continue;}
    if(cell.c!==col){col++;continue;}
    const continuation=r>cell.r,span=cell.colspan||1,cw=widths.slice(col,col+span).reduce((a,b)=>a+b,0);
    const value=state.values?.[cell.id]??'',kind=state.provenance?.[cell.id];
    let text=cell.input?(cell.inlineLabel?`${cell.text} ${value}`:value):cell.text;
    if(cell.hasDrawing&&!cell.image&&!cell.images?.length)text=cell.text||'Lissajous pattern';
    const fill=!cell.input?'F0F3F1':kind==='manual'||state.locked?.[cell.id]?'EDF3FB':kind==='generated'?'EDF7F0':kind==='computed'?'F3F4F3':'FFFFFF';
    cells+=`<w:tc><w:tcPr><w:tcW w:w="${cw}" w:type="dxa"/>${span>1?`<w:gridSpan w:val="${span}"/>`:''}${cell.rowspan>1?`<w:vMerge${continuation?'':' w:val="restart"'}/>`:''}<w:shd w:fill="${fill}"/><w:vAlign w:val="center"/></w:tcPr>${continuation?p(''):((await imageMarkup(cell))+p(text,{bold:!cell.input,size:table.colCount>10?16:18,center:col>0}))}</w:tc>`;
    col+=span;
   }
   rows+=`<w:tr><w:trPr><w:cantSplit/></w:trPr>${cells}</w:tr>`;
  }
  body+=`<w:tbl><w:tblPr><w:tblW w:w="${width}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map(s=>`<w:${s} w:val="single" w:sz="4" w:color="9DAAA4"/>`).join('')}</w:tblBorders><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:left w:w="60" w:type="dxa"/><w:right w:w="60" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map(w=>`<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows}</w:tbl>${p('')}`;
  for(const note of table.notes||[])body+=p(note,{size:15,color:'5E6D68'});
 }
 body+=p('生成条件',{bold:true,size:18,keep:true});
 const pars=state.result?.usedParameters||state.params||{};
 body+=p(Object.entries(pars).map(([k,v])=>`${k}: ${v}`).join(' · '),{size:16});
 body+=p(`随机扰动：${options.noise??''}%；包含因子 k=${options.k??2}；指定 B 类误差限=${options.bLimit??0}。不确定度须结合被测量、仪器和误差传播解释。`,{size:16});
 files['word/document.xml']=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="600" w:right="600" w:bottom="600" w:left="600" w:header="200" w:footer="200"/></w:sectPr></w:body></w:document>`;
 files['_rels/.rels']='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdDoc" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
 files['word/_rels/document.xml.rels']=`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`;
 files['[Content_Types].xml']=`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${[...new Set(types)].map(ext=>`<Default Extension="${ext}" ContentType="image/${ext==='jpg'?'jpeg':'png'}"/>`).join('')}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
 return zip(files);
}
