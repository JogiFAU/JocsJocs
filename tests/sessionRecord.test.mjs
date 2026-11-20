import test from 'node:test';
import assert from 'node:assert/strict';
import {state,resetQuizSession} from '../src/state.js';
import {startQuizSession,abortQuizSession,finishQuizSession,persistCurrentQuizSession,hydrateQuizSessionFromStorage} from '../src/quiz/session.js';
import {listSessions,loadSession,saveSession,deleteSession,subjectStorageId,migrateSubjectSessions,exportBackupAllDatasets,importBackupAllDatasets} from '../src/data/storage.js';
import {sessionDisplayName,newSessionName,sessionProgress,sessionAvailability} from '../src/quiz/sessionRecord.js';
import {overviewHtml} from '../src/ui/overview.js';

function setup() {
  const store=new Map();
  globalThis.localStorage={getItem:k=>store.get(k) ?? null,setItem:(k,v)=>store.set(k,v),
    removeItem:k=>store.delete(k),key:i=>[...store.keys()][i],get length(){return store.size;}};
  globalThis.document={getElementById:()=>null};
  globalThis.window={scrollTo:()=>{}};
  resetQuizSession();state.storageError=null;
  state.questionsAll=['a','b','c'].map(id=>({id,text:'Frage '+id,correctIndices:[0],
    answers:[{id:id+'0',text:'Richtig',isCorrect:true},{id:id+'1',text:'Falsch',isCorrect:false}]}));
  state.activeDataset={id:'radiology',label:'Radiologie'};
  state.localQuestionOverrides=new Map();
  return store;
}

test('query persists name, answers, high-impact parameters and fixed answer order across pause and resume',()=>{
  setup();
  const highImpact={parameters:{targetPercent:60,nominalQuestions:30,scope:'filtered'},set:{referenceIds:['a','b']}};
  startQuizSession({subset:state.questionsAll,config:{runName:'Mein Test',quizMode:'exam',shuffleAnswers:true,highImpact}});
  const id=state.currentSessionId,order=JSON.stringify([...state.answerOrder]);
  state.answers.set('a',[1]);state.submitted.add('a');state.results.set('a',false);
  state.excludedAnswers.set('b',[1]);state.forceOriginalQuestionView.add('b');
  assert.ok(persistCurrentQuizSession());assert.ok(abortQuizSession());
  assert.equal(state.view,'overview');assert.equal(listSessions('radiology').length,1);
  const record=loadSession('radiology',id);
  assert.equal(record.name,'Mein Test');assert.equal(record.schemaVersion,2);
  assert.deepEqual(record.quizConfig.highImpact,highImpact);
  hydrateQuizSessionFromStorage(record);
  assert.equal(state.currentSessionId,id);assert.equal(state.view,'quiz');assert.equal(state.sessionName,'Mein Test');
  assert.deepEqual(state.answers.get('a'),[1]);assert.equal(JSON.stringify([...state.answerOrder]),order);
  assert.deepEqual(state.excludedAnswers.get('b'),[1]);assert.ok(state.forceOriginalQuestionView.has('b'));
  assert.deepEqual(sessionProgress(record).wrongIds,['a']);
  assert.ok(finishQuizSession());assert.ok(loadSession('radiology',id).finishedAt);
});

test('automatic names are unique and older records retain compatibility',()=>{
  setup();const now=new Date('2026-11-19T12:00:00Z');
  const first=newSessionName({},'Fach',3,[],now);
  assert.notEqual(newSessionName({},'Fach',3,[first],now),first);
  assert.equal(newSessionName({runName:' Gewählt '},'Fach',3,[],now),'Gewählt');
  const old={id:'old-id',createdAt:1,questionOrder:['a'],answers:{a:[0]},submitted:['a'],results:{a:true},quizConfig:{quizMode:'exam'}};
  hydrateQuizSessionFromStorage(old);
  assert.equal(state.view,'quiz');assert.ok(sessionDisplayName(old).startsWith('Abfrage'));
  assert.equal(sessionProgress(old).correct,1);
});

test('overview shortens generated names and presents filter and progress details',()=>{
  setup();
  const updatedAt=new Date(2026,10,19,21,26,30).getTime();
  const record={id:'query',updatedAt,questionOrder:['a','b'],submitted:['a'],results:{a:true},
    name:'Abfrage · Radiologie · 2 Fragen · 19.11.2026, 21:25:57 (2)',
    quizConfig:{exams:['2026-11-19 Klausur <A>'],quizMode:'practice'}};
  assert.equal(sessionDisplayName(record),'Abfrage Klausur <A> - 2 Fragen');
  const practice=overviewHtml([record],state.questionsAll);
  assert.match(practice,/Abfrage Klausur &lt;A&gt; - 2 Fragen/);
  assert.match(practice,/Offen · Klausur &lt;A&gt; · [^<]*21:26</);
  assert.match(practice,/1\/2 Fragen · 100 % richtig/);

  record.quizConfig={quizMode:'exam',highImpact:{parameters:{targetPercent:60,nominalQuestions:30,scope:'recent'}}};
  const exam=overviewHtml([record],state.questionsAll);
  assert.match(exam,/⚡<\/span> · High Impact - 2 Fragen/);
  assert.match(exam,/Offen · 60 %, 30 Fragen, Letzte 5 Klausuren/);
  assert.match(exam,/1\/2 Fragen · Prüfungsmodus/);
  assert.doesNotMatch(exam.match(/<article[\s\S]*?<\/article>/)[0],/richtig|falsch/);
  record.quizConfig.runName=record.name;
  assert.equal(sessionDisplayName(record),record.name);
});

test('query remains in memory if storage fails; pausing or completing does not discard it',()=>{
  setup();startQuizSession({subset:state.questionsAll,config:{quizMode:'practice'}});
  const id=state.currentSessionId;
  localStorage.setItem=()=>{throw Error('QuotaExceeded');};
  state.answers.set('a',[1]);
  assert.equal(abortQuizSession(),false);assert.equal(state.view,'quiz');assert.equal(state.currentSessionId,id);
  assert.equal(finishQuizSession(),false);assert.equal(state.view,'quiz');assert.match(state.storageError,/QuotaExceeded/);
  assert.deepEqual(state.answers.get('a'),[1]);
});

test('source changes are detected before resuming and backup preserves query metadata',()=>{
  setup();startQuizSession({subset:state.questionsAll,config:{runName:'Backup Probe'}});
  const record=loadSession('radiology',state.currentSessionId),backup=exportBackupAllDatasets();
  assert.equal(sessionAvailability(record,state.questionsAll).changed,0);
  state.questionsAll[0].answers[0].text='Geändert';
  assert.equal(sessionAvailability(record,state.questionsAll).changed,1);
  assert.throws(()=>hydrateQuizSessionFromStorage(record),/geändert/);
  setup();importBackupAllDatasets(backup);
  assert.equal(listSessions('radiology')[0].name,'Backup Probe');
  assert.equal(listSessions('other-subject').length,0);
});

test('subject identity survives new export IDs and migration preserves old records',()=>{
  setup();
  const stable=subjectStorageId({id:'export-new'},' Radiologie ');
  assert.equal(stable,subjectStorageId({id:'export-old'},'RADIOLOGIE'));
  assert.equal(subjectStorageId({id:'export-new',storageKey:'explicit'},'Radiologie'),'explicit');
  saveSession('export-old',{id:'old-query',questionOrder:['a','b'],name:'Alt',createdAt:1});
  saveSession('unrelated',{id:'other-query',questionOrder:['x'],createdAt:2});
  migrateSubjectSessions(stable,'export-new',state.questionsAll);
  assert.equal(listSessions(stable)[0].name,'Alt');
  assert.equal(listSessions(stable).length,1);
  assert.equal(listSessions('export-old').length,1);
  migrateSubjectSessions(stable,'export-new',state.questionsAll);
  assert.equal(listSessions(stable).length,1);
  deleteSession(stable,'old-query');
  migrateSubjectSessions(stable,'export-new',state.questionsAll);
  assert.equal(listSessions(stable).length,0,'deleted migrated query must not reappear');
  assert.equal(listSessions('export-old').length,1);
});
