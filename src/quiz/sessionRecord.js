import {hash32} from '../utils.js';
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
  if (typeof session.name==='string' && session.name.trim()) return session.name;
  if (typeof session.quizConfig?.runName==='string' && session.quizConfig.runName.trim()) return session.quizConfig.runName;
  const date=new Date(session.createdAt || session.updatedAt || 0).toLocaleString('de-DE');
  return `Abfrage · ${date} · ${(session.questionOrder || []).length} Fragen · ${String(session.id || '').slice(-4)}`;
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
