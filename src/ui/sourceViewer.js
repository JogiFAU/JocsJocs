import { viewerPage, adjacentPage, safeViewerUrl } from '../data/sourceViewer.js';

const $=id=>document.getElementById(id);
let payload, index=0, currentPage;
const token=location.hash.slice(1);
try {
  if (!/^source-viewer-[a-f0-9-]+$/.test(token)) throw new Error();
  const raw=sessionStorage.getItem(token) || localStorage.getItem(token);
  payload=JSON.parse(raw);
  if (!payload || Date.now()-payload.created>3600000 || !Array.isArray(payload.sources) || !payload.sources.length ||
      payload.sources.length>7 || !payload.sources.every(s=>typeof s.pdfName==='string' && Number.isInteger(s.pdfPage) && s.pdfPage>0)) throw new Error();
  sessionStorage.setItem(token,raw);
  index=Number.isInteger(payload.selected) && payload.sources[payload.selected] ? payload.selected : 0;
} catch {
  payload=null;
  $('empty').textContent='Die Quellenübergabe fehlt oder ist abgelaufen. Bitte die Quelle erneut in der Fragenanzeige öffnen.';
}

function render() {
  const source=payload.sources[index];
  const page=viewerPage(source,currentPage,location.origin);
  $('title').textContent=source.pdfName;
  document.title=`${source.pdfName} · PDF-Seite ${currentPage}`;
  $('page-label').textContent=`PDF-Seite ${currentPage}`;
  $('status').textContent=page.cited ? 'Zitierte Quellenseite. Seitenwechsel ist nur für mitgelieferte Nachbarseiten möglich.' :
    `Kontextseite – zitierte Fundstelle ist PDF-Seite ${source.pdfPage}.`;
  $('previous').disabled=!adjacentPage(source,currentPage,-1,location.origin);
  $('next').disabled=!adjacentPage(source,currentPage,1,location.origin);
  $('return').hidden=page.cited;
  const image=$('page-image');image.hidden=true;image.removeAttribute('src');
  $('empty').textContent=page.url ? '' : 'Die vollständige Seite wurde nicht mitgeliefert. Vorhandene Ausschnitte und Originalzitate stehen unten.';
  if (page.url) {
    image.alt=`${source.pdfName} · PDF-Seite ${currentPage}`;
    image.onload=()=>{image.hidden=false;};
    image.onerror=()=>{image.hidden=true;$('empty').textContent='Seitenbild nicht erreichbar. Bitte das Quellenbilder-Verzeichnis zusammen mit der Analysedatei bereitstellen.';};
    image.src=page.url;
  }
  $('page-stage').scrollTop=0;
  $('regions').replaceChildren();
  const seen=new Set();
  if (page.cited) for (const address of source.addresses || []) {
    const section=document.createElement('section');section.className='region';
    const url=safeViewerUrl(address.regionUrl,location.origin);
    if (url && !seen.has(url)) {
      seen.add(url);const label=document.createElement('h3');label.textContent='Zitierter Bild-/Textausschnitt';section.append(label);
      const region=document.createElement('img');region.src=url;region.alt='Mitgelieferter Originalausschnitt der zitierten Seite';
      region.onerror=()=>{region.replaceWith(document.createTextNode('Ausschnitt nicht erreichbar.'));};section.append(region);
    }
    for (const cite of address.citations || []) if (cite.quote && ['source','native','ocr'].includes(cite.layer) && !seen.has(cite.quote)) {
      seen.add(cite.quote);const quote=document.createElement('blockquote');quote.textContent=cite.quote;section.append(quote);
    }
    if(section.childNodes.length) $('regions').append(section);
  }
  $('details').hidden=!$('regions').childNodes.length;
  $('address').textContent=JSON.stringify({documentId:source.documentId,pdfPage:source.pdfPage,
    sourcePaths:source.sourcePaths,knowledgeSnapshot:source.knowledgeSnapshot,addresses:source.addresses},null,2);
  for (const [i,button] of [...$('sources').children].entries()) {
    if(i===index) button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  }
}
if(payload) {
  $('source-count').textContent=`${payload.sources.length} geprüfte Quellen-Seiten`;
  payload.sources.forEach((source,i)=>{
    const button=document.createElement('button');button.type='button';button.textContent=`${source.pdfName} · PDF-Seite ${source.pdfPage}`;
    button.addEventListener('click',()=>{index=i;currentPage=source.pdfPage;render();});$('sources').append(button);
  });
  for (const [id,delta] of [['previous',-1],['next',1]]) $(id).addEventListener('click',()=>{
    const next=adjacentPage(payload.sources[index],currentPage,delta,location.origin);
    if(next){currentPage=next.page;render();}
  });
  $('return').addEventListener('click',()=>{currentPage=payload.sources[index].pdfPage;render();});
  $('zoom').addEventListener('change',()=>{
    const image=$('page-image');image.style.width=$('zoom').value==='fit'?'100%':`${$('zoom').value}%`;
  });
  currentPage=payload.sources[index].pdfPage;render();
}
