import {examDisplayName} from '../utils.js';
const escape=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function learningProgress(questions,sessions) {
  const latest=new Map();
  const sorted=[...sessions].sort((a,b)=>(b.updatedAt || b.createdAt || 0)-(a.updatedAt || a.createdAt || 0));
  for (const session of sorted) {
    const hidden=session.quizConfig?.quizMode==='exam' && !session.finishedAt;
    const allowed=new Set(session.questionOrder || []);
    for (const id of session.submitted || []) {
      if (!allowed.has(id) || latest.has(id)) continue;
      const result=session.results?.[id];
      latest.set(id,hidden?'neutral':[true,1,'1'].includes(result)?'correct':[false,0,'0'].includes(result)?'wrong':'neutral');
    }
  }
  const total={total:0,answered:0,correct:0,wrong:0,neutral:0},exams=new Map();
  for (const q of questions) {
    const name=q.examName || 'Ohne Klausurzuordnung';
    if (!exams.has(name)) exams.set(name,{name,total:0,answered:0,correct:0,wrong:0,neutral:0});
    for (const entry of [total,exams.get(name)]) {
      entry.total++;
      if (latest.has(q.id)) {entry.answered++;entry[latest.get(q.id)]++;}
    }
  }
  return {total,exams:[...exams.values()].sort((a,b)=>a.name.localeCompare(b.name,'de'))};
}

export function progressBarHtml({total,answered,correct=0,wrong=0,neutral=0},exam=false) {
  const share=n=>Math.max(0,Math.min(100,100*n/(total || 1)));
  const label=exam?`${answered} von ${total} beantwortet`:`${answered} von ${total} beantwortet, ${correct} richtig, ${wrong} falsch${neutral?', '+neutral+' ohne sichtbare Bewertung':''}`;
  return `<div class="learningBar" role="img" aria-label="${label}">${exam?`<span class="learningBar__neutral" style="width:${share(answered)}%"></span>`:`<span class="learningBar__correct" style="width:${share(correct)}%"></span><span class="learningBar__wrong" style="width:${share(wrong)}%"></span><span class="learningBar__neutral" style="width:${share(neutral)}%"></span>`}</div>`;
}

export function learningProgressHtml(questions,sessions) {
  const {total,exams}=learningProgress(questions,sessions);
  return `<details class="learningProgressDetails" open><summary>Dein Lernstand <span>${total.answered} / ${total.total}</span></summary><div class="subjectProgress"><strong>${total.answered} <span>/ ${total.total} Fragen</span></strong>${progressBarHtml(total)}<p class="small">${total.correct} richtig · ${total.wrong} falsch${total.neutral?' · '+total.neutral+' ohne sichtbare Bewertung':''}</p></div>
    <p class="small">Je Frage zählt die zuletzt abgegebene Antwort. Offene Prüfungsabfragen bleiben bis zur Auswertung blau.</p>
    <details class="examProgressDetails" open><summary>Klausuren <span>${exams.length}</span></summary><div class="examProgressList">${exams.map(exam=>`<article><div class="examProgressName">${escape(examDisplayName(exam.name))}</div>${progressBarHtml(exam)}<p class="small">${exam.answered} / ${exam.total} bearbeitet · ${exam.correct} richtig · ${exam.wrong} falsch</p></article>`).join('')}</div></details></details>`;
}
