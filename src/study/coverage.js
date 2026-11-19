// Pure preparation and validation. Both goals use per-exam minimum coverage.
class Components {
  constructor(ids) { this.parents = new Map(ids.map(id => [id,id])); }
  find(id) {
    while (this.parents.get(id) !== id) {
      this.parents.set(id,this.parents.get(this.parents.get(id)));
      id=this.parents.get(id);
    }
    return id;
  }
  join(a,b) { this.parents.set(this.find(a),this.find(b)); }
}

export function makeStudyInput(questions) {
  if (!questions.length || questions.some(q => !q.analysis?.occurrenceId || !q.datasetAnnotation?.relationships)) return null;
  const registries=[...new Set(questions.map(q=>q.datasetAnnotation.relationships))];
  const pairs=new Map();
  for (const registry of registries) for (const r of registry.relations || []) {
    const row={left:r.left,right:r.right,relation:r.relation,modelRelation:r.modelRelation,
      confidence:r.confidence,reviewStatus:r.reviewStatus};
    pairs.set([r.left,r.right].sort().join('\0'),row);
  }
  return {questions:questions.map(q=>({id:q.id,occurrenceId:q.analysis.occurrenceId,examName:q.examName,
    examId:q.originalFields?.question?.examId || q.examName,examYear:q.examYear,
    examDate:q.originalFields?.question?.examDate || null})),relations:[...pairs.values()]};
}

export function examDate(q) {
  for (const field of ['examDate','examName']) {
    const match=String(q[field] || '').match(/(?:^|\D)(\d{4})-(\d{2})-(\d{2}|xx)(?!\d)/i);
    if (!match) continue;
    const year=Number(match[1]), month=Number(match[2]), day=match[3].toLowerCase()==='xx' ? 15 : Number(match[3]);
    const stamp=Date.UTC(year,month-1,day), value=new Date(stamp);
    if (value.getUTCFullYear()===year && value.getUTCMonth()===month-1 && value.getUTCDate()===day)
      return {stamp,precision:match[3].toLowerCase()==='xx'?'month':'day'};
  }
  const year=String(q.examYear || '').match(/^(?:19|20)\d{2}$/)?.[0] || String(q.examName || '').match(/\b((?:19|20)\d{2})\b/)?.[1];
  return year ? {stamp:Date.UTC(Number(year),6,1),precision:'year'} : null;
}

function equivalent(r) {
  if (r.relation==='exact_duplicate') return true;
  return ['reviewed','transitive'].includes(r.reviewStatus) && ['high','medium'].includes(r.confidence) &&
    (['equivalent_task','near_repeat'].includes(r.relation) || r.modelRelation==='near_repeat');
}

export function prepareStudy(input,selectedQuestionIds=null) {
  const all=new Map(input.questions.map(q=>[q.occurrenceId,q]));
  if (all.size!==input.questions.length || new Set(input.questions.map(q=>q.id)).size!==input.questions.length)
    throw Error('Die Frage-IDs sind nicht eindeutig.');
  const questions=new Map([...all].filter(([,q])=>!(/seminar|vorlesung|übung/i).test(q.examName || '')));
  if ([...questions.values()].some(q=>!q.examId)) throw Error('Für einzelne Fragen fehlt die Klausurzuordnung.');
  const components=new Components([...questions.keys()]), duplicates=new Components([...questions.keys()]);
  for (const r of input.relations) {
    if (!questions.has(r.left) || !questions.has(r.right)) continue;
    if (equivalent(r)) components.join(r.left,r.right);
    if (r.relation==='exact_duplicate' && questions.get(r.left).examId===questions.get(r.right).examId)
      duplicates.join(r.left,r.right);
  }
  const selected=selectedQuestionIds===null?null:new Set(selectedQuestionIds);
  if (selected && [...selected].some(id=>!input.questions.some(q=>q.id===id))) throw Error('Filter und Fachstand passen nicht zusammen.');
  const sourceTotals=new Map();
  for (const q of questions.values()) {
    const exam=String(q.examId);
    if (!sourceTotals.has(exam)) sourceTotals.set(exam,new Set());
    sourceTotals.get(exam).add(duplicates.find(q.occurrenceId));
  }
  const retained=[], seen=new Set();
  for (const key of [...questions.keys()].sort()) {
    if (selected && !selected.has(questions.get(key).id)) continue;
    const duplicate=duplicates.find(key);
    if (seen.has(duplicate)) continue;
    seen.add(duplicate);retained.push(questions.get(key));
  }
  const exams=new Map(), groups=new Map();
  for (const q of retained) {
    const key=String(q.examId), date=examDate(q);
    if (!exams.has(key)) exams.set(key,{id:key,name:q.examName || key,total:0,sourceTotal:sourceTotals.get(key).size,date});
    const exam=exams.get(key);exam.total++;
    if (date && (!exam.date || date.stamp<exam.date.stamp)) exam.date=date;
    const group=components.find(q.occurrenceId);
    if (!groups.has(group)) groups.set(group,[]);
    groups.get(group).push(q);
  }
  const families=[...groups.values()].map(members=>({id:members.map(q=>q.occurrenceId).sort()[0],members,
    counts:Object.fromEntries([...new Set(members.map(q=>String(q.examId)))].map(key=>[key,members.filter(q=>String(q.examId)===key).length]))}));
  families.sort((a,b)=>a.id.localeCompare(b.id));
  const selectedTotal=selected?input.questions.filter(q=>selected.has(q.id)).length:input.questions.length;
  const eligibleTotal=[...questions.values()].filter(q=>!selected || selected.has(q.id)).length;
  return {families,exams:[...exams.values()],originalCount:selectedTotal,retainedCount:retained.length,
    excludedCount:selectedTotal-eligibleTotal,duplicateCount:eligibleTotal-retained.length};
}

export function makeProblem(prepared,params,mode) {
  const {targetPercent,lastExamCount,nominalQuestions}=params;
  if (![targetPercent,lastExamCount,nominalQuestions].every(Number.isSafeInteger) || targetPercent<1 || targetPercent>100 ||
      lastExamCount<1 || nominalQuestions<1) throw Error('Bitte gültige ganzzahlige Parameter eingeben.');
  const dated=prepared.exams.filter(e=>e.date).sort((a,b)=>b.date.stamp-a.date.stamp || a.id.localeCompare(b.id));
  const exams=mode==='recent' ? dated.slice(0,lastExamCount) : prepared.exams;
  if (!exams.length) throw Error(mode==='recent'?'Für das aktuelle Lernset fehlen datierte Klausuren.':'Keine Klausuren vorhanden.');
  const families=prepared.families.filter(f=>exams.some(e=>f.counts[e.id]));
  const totalWeight=exams.reduce((sum,e)=>sum+Math.min(e.sourceTotal/nominalQuestions,1),0);
  const contributions=families.map(f=>exams.reduce((sum,e)=>sum+Math.min(e.sourceTotal/nominalQuestions,1)*(f.counts[e.id] || 0)/e.total,0)/totalWeight);
  return {mode,exams,families,params,contributions,
    required:exams.map(e=>Math.ceil(e.total*targetPercent/100)),
    unknownDates:prepared.exams.filter(e=>!e.date).length,
    fewerRecent:mode==='recent' && exams.length<lastExamCount};
}

export function problemLP(problem) {
  const terms=problem.families.map((_,i)=>`+ ${(1-.01*problem.contributions[i]).toPrecision(16)} x${i}`).join(' ');
  const constraints=problem.exams.map((exam,i)=>` e${i}: `+problem.families.flatMap((f,j)=>f.counts[exam.id]?[`+ ${f.counts[exam.id]} x${j}`]:[]).join(' ')+` >= ${problem.required[i]}`);
  // Contributions over every family sum to 1: a 0.01 tie-break can never pay for one extra reference.
  return ['Minimize',' obj: '+terms,'Subject To',...constraints,'Binary',...problem.families.map((_,i)=>' x'+i),'End'].join('\n');
}

export function greedySelection(problem) {
  const covered=problem.required.map(()=>0), selected=[];
  while (covered.some((count,i)=>count<problem.required[i])) {
    let best=-1, gain=0;
    for (let j=0;j<problem.families.length;j++) {
      if (selected.includes(j)) continue;
      const benefit=problem.exams.reduce((sum,e,i)=>sum+Math.min(problem.families[j].counts[e.id] || 0,Math.max(0,problem.required[i]-covered[i]))/problem.required[i],0);
      if (benefit>gain) { best=j;gain=benefit; }
    }
    if (best<0) throw Error('Die Mindestabdeckung ist mit den vorhandenen Familien nicht erreichbar.');
    selected.push(best);problem.exams.forEach((e,i)=>covered[i]+=problem.families[best].counts[e.id] || 0);
  }
  return selected;
}

export function describeSolution(problem,raw) {
  let selected=problem.families.flatMap((_,i)=>Number(raw.Columns?.['x'+i]?.Primal)>.5?[i]:[]);
  const valid=indices=>problem.exams.every((e,i)=>indices.reduce((sum,j)=>sum+(problem.families[j].counts[e.id] || 0),0)>=problem.required[i]);
  let optimal=raw.Status==='Optimal';
  if (!valid(selected)) {
    if (optimal) throw Error('Der Solver meldete eine optimale, aber unzureichende Auswahl.');
    selected=greedySelection(problem);optimal=false;
  }
  const referenceIds=selected.map(index=>{
    const candidates=problem.families[index].members.filter(q=>problem.exams.some(e=>e.id===String(q.examId)));
    return [...candidates].sort((a,b)=>(examDate(b)?.stamp || 0)-(examDate(a)?.stamp || 0) || a.id.localeCompare(b.id))[0].id;
  });
  return {referenceIds,familyIds:selected.map(i=>problem.families[i].id),optimal,solverStatus:raw.Status,
    coverage:problem.exams.map((e,i)=>{
      const covered=selected.reduce((sum,j)=>sum+(problem.families[j].counts[e.id] || 0),0);
      return {id:e.id,name:e.name,date:e.date?new Date(e.date.stamp).toISOString().slice(0,10):null,
        total:e.total,required:problem.required[i],covered,share:covered/e.total,
        sourceTotal:e.sourceTotal,completeness:Math.min(e.sourceTotal/problem.params.nominalQuestions,1),datePrecision:e.date?.precision || 'unknown'};
    }),unknownDates:problem.unknownDates,fewerRecent:problem.fewerRecent};
}

export function filterStudyQuestions(questions,result,selection) {
  if (!result || selection==='all') return questions;
  const ids=new Set(result.sets[selection]?.referenceIds || []);
  return questions.filter(q=>ids.has(q.id));
}
