import test from 'node:test';
import assert from 'node:assert/strict';
import { qMetaHtml } from '../src/ui/components.js';
import { sourcesVisible } from '../src/ui/sourceMedia.js';

const question = {
  id:'test', examName:'Testprüfung', answers:[{text:'A'},{text:'B'}],
  analysis:{status:'partial'}, aiSuperTopic:'Thema', aiSubtopic:'Unterthema',
  aiTopicReason:'TOPIC_SOLUTION_SECRET', aiMaintenanceReasons:['QUALITY_SOLUTION_SECRET'],
  aiChangedAnswers:true, aiDisagreesWithOriginalAnswer:true,
  imageFiles:['test.png'], imageClusterSize:2, imageClusterLabel:'IMAGE_CLUSTER_SECRET',
  isHighRelevanceCluster:true, clusterExamCount:2, clusterExamShare:0.5,
  questionAbstraction:'OBJECTIVE_SOLUTION_SECRET',
};

test('hidden solutions exclude metadata explanations, answer badges and solved-neighbour links', () => {
  for (const context of [
    {view:'quiz',quizMode:'exam',submitted:false,showSolutions:false},
    {view:'quiz',quizMode:'exam',submitted:true,showSolutions:false},
    {view:'quiz',quizMode:'practice',submitted:false,showSolutions:true},
    {view:'search',showSolutions:false},
  ]) {
    const html = qMetaHtml(question,1,{showAnalysisDetails:sourcesVisible(context)});
    assert.match(html,/Testprüfung/);
    assert.match(html,/Thema → Unterthema/);
    assert.match(html,/🖼️ 1/);
    assert.doesNotMatch(html,/SECRET|role="tooltip"|data-cluster-show|data-image-cluster-show|Qualitätsampel|Originallösung|Antwort geändert/);
  }
});

test('review, visible search solutions and submitted practice restore analysis metadata', () => {
  for (const context of [
    {view:'review',showSolutions:true},
    {view:'search',showSolutions:true},
    {view:'quiz',quizMode:'practice',submitted:true,showSolutions:true},
  ]) {
    const html=qMetaHtml(question,1,{showAnalysisDetails:sourcesVisible(context)});
    for (const secret of ['TOPIC_SOLUTION_SECRET','QUALITY_SOLUTION_SECRET','IMAGE_CLUSTER_SECRET','OBJECTIVE_SOLUTION_SECRET'])
      assert.ok(html.includes(secret),secret);
    assert.match(html,/Qualitätsampel|Originallösung/);
  }
});
