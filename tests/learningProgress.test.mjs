import test from 'node:test';
import assert from 'node:assert/strict';
import {learningProgress,progressBarHtml} from '../src/ui/learningProgress.js';
import {overviewHtml} from '../src/ui/overview.js';
const questions=['a','b','c'].map(id=>({id,examName:'Klausur',text:id,answers:[],correctIndices:[]}));

test('learning overview uses latest submitted answer and hides open exam correctness',()=>{
  const sessions=[{updatedAt:1,questionOrder:['a','b'],submitted:['a','b'],results:{a:true,b:true},finishedAt:1},
    {updatedAt:2,quizConfig:{quizMode:'practice'},questionOrder:['b'],submitted:['b'],results:{b:false}},
    {updatedAt:3,quizConfig:{quizMode:'exam'},questionOrder:['a'],submitted:['a'],results:{a:false}}];
  const {total}=learningProgress(questions,sessions);
  assert.deepEqual(total,{total:3,answered:2,correct:0,wrong:1,neutral:1});
  sessions[2].finishedAt=4;
  assert.equal(learningProgress(questions,sessions).total.wrong,2);
});

test('exam query bars are blue and practice bars show results',()=>{
  const values={total:3,answered:2,correct:1,wrong:1};
  const exam=progressBarHtml(values,true);
  assert.ok(exam.includes('learningBar__neutral'));
  assert.ok(!exam.includes('learningBar__correct')&&!exam.includes('falsch'));
  const practice=progressBarHtml(values,false);
  assert.ok(practice.includes('learningBar__correct')&&practice.includes('learningBar__wrong'));
});

test('query archive delegates fixed creation actions to the header and uses uniform buttons',()=>{
  const html=overviewHtml([{id:'saved',questionOrder:['a'],submitted:[],quizConfig:{quizMode:'exam'}}],questions);
  assert.ok(!html.includes('id="newQueryBtn"'));
  assert.ok(!html.includes('class="btn primary"'));
  assert.ok(html.indexOf('welcomeCard')<html.indexOf('queryArchive'));
});
