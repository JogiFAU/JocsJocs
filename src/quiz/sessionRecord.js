import {examDisplayName,hash32} from '../utils.js';
// Backwards-compatible descriptions of local query records.
export function questionSignature(question) {
  return String(hash32(JSON.stringify([question.text,question.answers.map(a=>[a.id,a.text]),question.correctIndices])));
}

export function sessionAvailability(session,questions) {
  const current=new Map(questions.map(q=>[q.id,q]));
  const ids=Array.isArray(session.questionOrder)?session.questionOrder:[];
  return {missing:ids.filter(id=>!current.has(id)).length,
    changed:ids.filter(id=>current.has(id) && session.questionSignatures?.[id] && session.questionSignatures[id]!==questionSignature(current.get(id))).length};
}
export function sessionDisplayName(session) {
  const config=session.quizConfig || {};
  if (typeof config.runName==='string' && config.runName.trim()) return config.runName.trim();
  const stored=typeof session.name==='string' ? session.name.trim() : '';
  const auto=/^(Abfrage|High Impact|Wiederholung|Nur falsche) · .+ · \d+ Fragen · \d{1,2}\.\d{1,2}\.\d{4}, \d{1,2}:\d{2}:\d{2}(?: \(\d+\))?$/;
  if (stored && !auto.test(stored)) return stored;

  const count=session.questionOrder?.length ?? 0;
  const exams=config.exams || [];
  let title=exams.length===1 ? `Abfrage ${examDisplayName(exams[0])}` : 'Abfrage eigene Auswahl';
  if (config.repeatMode==='all') title='Wiederholung';
  if (config.repeatMode==='wrong') title='Nur falsche';
  if (config.highImpact) title='High Impact';
  return `${title} - ${count} ${count===1?'Frage':'Fragen'}`;
}

export function sessionProgress(session) {
  const ids=[...new Set(Array.isArray(session.questionOrder)?session.questionOrder:[])];
  const submitted=new Set(Array.isArray(session.submitted)?session.submitted:[]);
  const answered=ids.filter(id=>submitted.has(id));
  const correct=answered.filter(id=>[true,1,'1'].includes(session.results?.[id])).length;
  const wrongIds=answered.filter(id=>[false,0,'0'].includes(session.results?.[id]));
  return {total:ids.length,answered:answered.length,correct,wrongIds,finished:Boolean(session.finishedAt)};
}

export function newSessionName(config,subject,count,existing=[],now=new Date()) {
  if (config.runName?.trim()) return config.runName.trim();
  const kind=config.repeatMode==='wrong'?'Nur falsche':config.repeatMode==='all'?'Wiederholung':config.highImpact?'High Impact':'Abfrage';
  const base=`${kind} · ${subject} · ${count} Fragen · ${now.toLocaleString('de-DE')}`;
  let name=base, suffix=2;
  while(existing.includes(name)) {
    name=base+' ('+suffix+')';
    suffix++;
  }
  return name;
}
