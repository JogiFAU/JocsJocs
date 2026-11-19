let current=null;

export function cancelStudyCalculation() {
  current?.cancel();
}

export function calculateStudySet(input,params,selectedQuestionIds=null,onProgress=()=>{}) {
  cancelStudyCalculation();
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./solver.worker.js',import.meta.url),{type:'module'});
    let timer;
    const finish=(error,result)=>{
      clearTimeout(timer);worker.terminate();
      if (current?.worker===worker) current=null;
      if (error) reject(error); else resolve(result);
    };
    current={worker,cancel:()=>finish(new Error('Berechnung abgebrochen.'))};
    timer=setTimeout(()=>finish(new Error('Zeitlimit erreicht. Bitte erneut versuchen.')),45000);
    worker.onmessage=({data})=>{
      if (data.type==='progress') onProgress(data.mode);
      else if (data.type==='result') finish(null,data.result);
      else if (data.type==='error') finish(new Error(data.message));
    };
    worker.onerror=event=>finish(new Error(event.message || 'Browser-Solver konnte nicht geladen werden.'));
    worker.postMessage({input,params,selectedQuestionIds});
  });
}
