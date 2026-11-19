import {state} from '../state.js';
import {$,examDisplayName} from '../utils.js';
import {prepareStudy,makeProblem} from './coverage.js';
import {calculateStudySet,cancelStudyCalculation} from './client.js';

let generation=0;
let running=false;
let timer=null;
let status='';
let currentKey=null;
let currentInput=null;
let selectedIds=null;
let parameters=null;
let stats=null;
let update=async()=>{};
const escape=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function resetStudyUi() {
  generation++;
  clearTimeout(timer);timer=null;
  cancelStudyCalculation();
  running=false;status='';currentKey=null;currentInput=null;stats=null;
  state.studyResult=null;
}

export function syncStudyConfiguration(filteredQuestions) {
  if (state.view!=='config' || state.configKind!=='highImpact' || state.configTab!=='quiz') return;
  const next={targetPercent:Number($('studyTarget').value),nominalQuestions:Number($('studyNominal').value),
    lastExamCount:5,scope:$('studyScope').value};
  const ids=next.scope==='filtered'?filteredQuestions.map(q=>q.id).sort():null;
  const key=JSON.stringify([next,ids]);
  if (key===currentKey && currentInput===state.studyInput) return;
  generation++;clearTimeout(timer);timer=null;cancelStudyCalculation();running=false;
  currentKey=key;currentInput=state.studyInput;parameters=next;selectedIds=ids;state.studyResult=null;
  stats=null;
  try {
    if (!currentInput) throw Error('Dieses Fach benötigt Paarbeziehungen aus einem Analyzer-Export im Schema 2.0.');
    const prepared=prepareStudy(currentInput,ids);
    const problem=makeProblem(prepared,next,next.scope==='recent'?'recent':'allExams');
    stats={questions:problem.exams.reduce((sum,e)=>sum+e.total,0),exams:problem.exams.length,
      sourceQuestions:prepared.originalCount,excluded:prepared.excludedCount,duplicates:prepared.duplicateCount};
    status='Lernset wird automatisch aktualisiert …';
    timer=setTimeout(()=>calculate(),350);
  } catch(error) {
    status=error.message;
  }
}

export function readyStudyResult() {
  return state.studyResult?.selectionKey===currentKey && currentInput===state.studyInput ? state.studyResult : null;
}

export function studyConfigurationStats() {
  return {...stats,running,pending:running || timer!==null,status};
}

export function renderStudyUi() {
  const panel=$('studyPanel');
  if (!panel) return;
  panel.hidden=!(state.view==='config' && state.configTab==='quiz' && state.configKind==='highImpact');
  $('studyCancel').hidden=!running;
  $('studyStatus').textContent=status;
}

async function calculate() {
  clearTimeout(timer);timer=null;
  if (!stats || !currentInput || state.view!=='config' || state.configKind!=='highImpact') return;
  const token=++generation,input=currentInput,key=currentKey;
  running=true;status='Lernset wird lokal berechnet …';
  await update();
  try {
    const result=await calculateStudySet(input,parameters,selectedIds,()=>{});
    if (token!==generation || key!==currentKey || input!==state.studyInput) return;
    result.selectionKey=key;
    result.datasetId=state.activeDataset.id;
    state.studyResult=result;
    status=result.set.optimal?`${result.set.referenceIds.length} Referenzfragen · minimale Auswahl berechnet.`:
      `${result.set.referenceIds.length} Referenzfragen · Zielquote erfüllt, Minimalität nicht bewiesen.`;
  } catch(error) {
    if (token===generation) status=error.message;
  } finally {
    if (token===generation) {
      running=false;await update();
    }
  }
}

export function wireStudyUi(onChange) {
  update=onChange;
  for (const id of ['studyTarget','studyNominal','studyScope']) {
    $(id).addEventListener(id==='studyScope'?'change':'input',async()=>{await update();});
  }
  $('studyCancel').addEventListener('click',()=>{
    generation++;clearTimeout(timer);timer=null;cancelStudyCalculation();running=false;
    status='Berechnung abgebrochen.';update();
  });
}

export function studySummaryHtml() {
  if (state.configKind!=='highImpact') return '';
  const result=readyStudyResult();
  const count=result?.set.referenceIds.length;
  if (!result) return `<section class="hero studySummary"><h2>Deine High-Impact-Abfrage</h2><p>Klausurfragen im gewählten Ausgangspunkt: <strong>${stats?.questions ?? 0}</strong> aus ${stats?.exams ?? 0} Klausuren.</p><p>High-Impact-Referenzfragen: <strong>${running || timer!==null?'wird aktualisiert …':'noch nicht berechnet'}</strong></p><p>${escape(status)}</p></section>`;
  const set=result.set,p=result.parameters;
  const scope=p.scope==='recent'?'5 neueste Klausuren':p.scope==='filtered'?'Aus Abfragefilter':'Alle Klausuren';
  return `<section class="hero studySummary"><h2>Deine High-Impact-Abfrage</h2>
    <p><strong>${count} Referenzfragen</strong> · ${p.targetPercent} % Zielquote · ${scope}.</p>
    <p>${set.optimal?'Die Anzahl der Referenzfragen ist nachweislich minimal.':'Eine gültige Auswahl wurde gefunden; Minimalität ist noch nicht bewiesen.'} Beim Start wird daraus eine normale, gespeicherte Abfrage.</p>
    <p>Die Quote gilt für dokumentierte Fragen${p.scope==='filtered'?' innerhalb deiner Filterauswahl':''}. Die Rechnung setzt voraus, dass eine Referenz alle Varianten ihrer Familie abdeckt; fehlerhafte Altfragenzuordnungen können das Ergebnis überschätzen.</p>
    ${set.fewerRecent?'<p>Es liegen weniger als fünf datierte Klausuren vor.</p>':''}
    ${set.unknownDates?`<p>${set.unknownDates} Klausuren haben kein erkennbares Datum und sind nicht als neueste Klausuren auswählbar.</p>`:''}
    <details><summary>Abdeckung je Klausur</summary><div class="studyTable"><table><thead><tr><th>Klausur</th><th>Abgedeckt</th><th>${p.scope==='filtered'?'Fragen im Filter':'Vorhandene Fragen'}</th><th>Anteil</th><th>Vollständigkeit der Quelle</th></tr></thead><tbody>
    ${set.coverage.map(e=>`<tr><td>${escape(examDisplayName(e.name))}</td><td>${e.covered}</td><td>${e.total}</td><td>${(100*e.share).toFixed(1)} %</td><td>${(100*e.completeness).toFixed(0)} %</td></tr>`).join('')}
    </tbody></table></div></details></section>`;
}
