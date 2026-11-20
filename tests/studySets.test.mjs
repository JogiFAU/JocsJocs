import test from 'node:test';
import assert from 'node:assert/strict';
import loadHighs from '../assets/vendor/highs/highs.mjs';
import {prepareStudy,makeProblem,problemLP,describeSolution,filterStudyQuestions,examDate} from '../src/study/coverage.js';

const runtime=loadHighs();
const params={targetPercent:60,lastExamCount:1,nominalQuestions:30};
function input() {
  return {questions:['2020-01-01 Alt','2025-01-01 Neu'].flatMap((name,e)=>Array.from({length:5},(_,i)=>({id:`q${e}${i}`,occurrenceId:`o${e}${i}`,examId:`e${e}`,examName:name}))),relations:[]};
}
async function solve(data,options=params,mode='recent') {
  const p=makeProblem(prepareStudy(data),options,mode),highs=await runtime;
  return describeSolution(p,highs.solve(problemLP(p),{output_flag:false,time_limit:5,mip_rel_gap:0,mip_abs_gap:1e-8}));
}

test('minimum effort is 60 percent in EACH recent exam, inclusive at the boundary',async()=>{
  const recent=await solve(input()),all=await solve(input(),params,'allExams');
  assert.equal(recent.referenceIds.length,3);
  assert.equal(all.referenceIds.length,6);
  assert.ok(recent.optimal && all.optimal);
  assert.ok(recent.referenceIds.every(id=>id.startsWith('q1')));
  assert.ok(all.coverage.every(e=>e.share>=.6));
});

test('transitive near repeats form one unit and related questions stay separate',async()=>{
  const data=input();
  data.relations=[{left:'o00',right:'o01',relation:'equivalent_task',reviewStatus:'reviewed',confidence:'high'},
    {left:'o01',right:'o10',relation:'equivalent_task',reviewStatus:'reviewed',confidence:'high'},
    {left:'o10',right:'o11',relation:'related_topic',reviewStatus:'reviewed',confidence:'medium'}];
  const prepared=prepareStudy(data),group=prepared.families.find(f=>f.members.length===3);
  assert.ok(group);assert.ok(!group.members.some(q=>q.occurrenceId==='o11'));
  const result=await solve(data,params,'allExams');
  assert.ok(result.coverage.every(e=>e.covered>=e.required));
});

test('filtering preserves global family evidence but scores only selected questions',()=>{
  const data=input();
  data.relations=[{left:'o00',right:'o01',relation:'equivalent_task',reviewStatus:'reviewed',confidence:'high'},
    {left:'o01',right:'o10',relation:'equivalent_task',reviewStatus:'reviewed',confidence:'high'}];
  const prepared=prepareStudy(data,['q00','q10']);
  assert.equal(prepared.families.length,1);
  assert.equal(prepared.retainedCount,2);
  assert.ok(prepared.exams.every(e=>e.total===1 && e.sourceTotal===5));
  const problem=makeProblem(prepared,params,'allExams');
  assert.deepEqual(problem.required,[1,1]);
});

test('same-exam exact duplicates count once and source is preserved',()=>{
  const data=input(),before=JSON.stringify(data);
  data.relations=[{left:'o00',right:'o01',relation:'exact_duplicate'}];
  const snapshot=JSON.stringify(data),prepared=prepareStudy(data);
  assert.equal(prepared.duplicateCount,1);
  assert.equal(prepared.exams.find(e=>e.id==='e0').total,4);
  assert.equal(JSON.stringify(data),snapshot);
});

test('missing dates exclude only recent selection; expected count never weakens per-exam quota',()=>{
  const data=input();data.questions.filter(q=>q.examId==='e1').forEach(q=>q.examName='Undatiert');
  const prepared=prepareStudy(data),recent=makeProblem(prepared,{...params,lastExamCount:5},'recent');
  assert.equal(recent.exams.length,1);assert.equal(recent.unknownDates,1);assert.ok(recent.fewerRecent);
  const a=makeProblem(prepared,params,'allExams'),b=makeProblem(prepared,{...params,nominalQuestions:5},'allExams');
  assert.deepEqual(a.required,b.required);
  assert.equal(examDate({examName:'2018-12-xx WiSe18/19'}).precision,'month');
});

test('timeout fallback is feasible and explicitly not optimal; invalid optimal result fails',()=>{
  const p=makeProblem(prepareStudy(input()),params,'allExams');
  const result=describeSolution(p,{Status:'Time limit reached'});
  assert.equal(result.optimal,false);assert.ok(result.coverage.every(e=>e.covered>=e.required));
  assert.throws(()=>describeSolution(p,{Status:'Optimal',Columns:{}}),/unzureichende/);
  const filtered=filterStudyQuestions(input().questions,{sets:{recent:result}},'recent');
  assert.equal(filtered.length,result.referenceIds.length);
});

test('solver cardinality agrees with exhaustive search on a small multicover problem',async()=>{
  const data=input();data.relations=[
    {left:'o00',right:'o10',relation:'equivalent_task',reviewStatus:'reviewed',confidence:'high'},
    {left:'o01',right:'o11',relation:'equivalent_task',reviewStatus:'reviewed',confidence:'high'}];
  const p=makeProblem(prepareStudy(data),params,'allExams');
  let best=Infinity;
  for (let mask=0;mask<2**p.families.length;mask++) {
    const ids=p.families.flatMap((_,i)=>mask & 2**i ? [i]:[]);
    if(p.exams.every((e,i)=>ids.reduce((sum,j)=>sum+(p.families[j].counts[e.id] || 0),0)>=p.required[i]))best=Math.min(best,ids.length);
  }
  const result=await solve(data,params,'allExams');
  assert.equal(result.referenceIds.length,best);assert.ok(result.optimal);
});
