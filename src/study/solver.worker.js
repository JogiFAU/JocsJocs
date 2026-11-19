import loadHighs from '../../assets/vendor/highs/highs.mjs';
import {prepareStudy,makeProblem,problemLP,describeSolution} from './coverage.js';

self.onmessage=async ({data})=>{
  try {
    const began=performance.now();
    const prepared=prepareStudy(data.input,data.selectedQuestionIds ?? null);
    if (!prepared.exams.length) throw Error('Nach Ausschluss der Fragensammlungen sind keine Klausuren vorhanden.');
    makeProblem(prepared,data.params,'allExams');
    const highs=await loadHighs({locateFile:file=>new URL('../../assets/vendor/highs/'+file,import.meta.url).href});
    const mode=data.params.scope==='recent'?'recent':'allExams';
    self.postMessage({type:'progress',mode});
    const problem=makeProblem(prepared,data.params,mode);
    const raw=highs.solve(problemLP(problem),{output_flag:false,time_limit:15,mip_rel_gap:0,mip_abs_gap:1e-8});
    const set=describeSolution(problem,raw);
    self.postMessage({type:'result',result:{version:'learning-query-4.1',parameters:data.params,set,
      selectedQuestionIds:data.selectedQuestionIds ?? null,
      input:{questions:prepared.originalCount,scored:problem.exams.reduce((sum,e)=>sum+e.total,0),duplicates:prepared.duplicateCount,
        excludedCollections:prepared.excludedCount,exams:problem.exams.length},createdAt:Date.now(),elapsedMs:performance.now()-began}});
  } catch(error) {
    self.postMessage({type:'error',message:error.message || String(error)});
  }
};
