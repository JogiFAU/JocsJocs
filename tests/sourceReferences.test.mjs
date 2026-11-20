import test from 'node:test';
import assert from 'node:assert/strict';
import { collectCheckedReferences, sourcePdfName } from '../src/data/sourceReferences.js';
import { sourceReferencesHtml } from '../src/ui/sourceReferences.js';

function fixture(count=10) {
  const evidence = Array.from({length:count}, (_, i) => ({ evidenceId:`e${i}`, documentId:'doc', pageId:`p${i}`,
    pdfPage:i+1, sourcePaths:['Radiologie/Vorlesung/Roentgen__78810.pdf'], sourceText:`Original ${i}`,
    unitId:`u${i}`, unitRevision:'original-revision', enrichmentRevision:'enrichment-revision',
    viewId:`v${i}`, catalogManifest:'manifest', sourceMedia:{pageAssetId:'asset'} }));
  const citations = evidence.map(e => ({evidenceId:e.evidenceId, layer:'source', quote:e.sourceText}));
  const review = {optionId:'a', evidenceStatus:'source_cited', knowledgeBasis:'knowledgebase',
    finalAssessment:{citations:[citations[9] || citations[0]]}, citations,
    claims:citations.map(c => ({citations:[c]}))};
  const question = {answers:[{analysis:review}], analysis:{evidence, diagnostics:{sourceSelections:[{
    acceptedEvidenceIds:evidence.map(e => e.evidenceId), assessments:citations.map(c => ({
      evidenceId:c.evidenceId, optionIds:['a'], admitted:true, relation:'direct', citations:[c]}))
  }]}}};
  const dataset = {annotation:{knowledgeSnapshot:'snapshot', runId:'run', sourceMedia:{assets:[{assetId:'asset',path:'data.sources/page.png'}]}}};
  return {question, dataset, review};
}
const collect = f => collectCheckedReferences(f.question, f.dataset, 'https://example.test/folder/data.json');

test('limits option sources to three and question sources to seven, prioritizing final citations', () => {
  const f=fixture(); const result=collect(f);
  assert.equal(result.options[0].length, 3); assert.equal(result.question.length, 7);
  assert.equal(result.options[0][0].pdfPage, 10);
  assert.equal(result.question[0].pdfName, 'Roentgen.pdf');
});

test('source gate, actual original quotes and option binding are required', () => {
  const f=fixture(3);const assessments=f.question.analysis.diagnostics.sourceSelections[0].assessments;
  assessments[0].admitted=false; assessments[1].optionIds=['b'];
  f.question.analysis.evidence[2].sourceText='not the cited quote';
  assert.deepEqual(collect(f).question, []);
  delete f.question.analysis.diagnostics;
  assert.deepEqual(collect(f).question, []);
});

test('failed gates, incomplete assessment, model knowledge and critic rejection never supply compact references', () => {
  for (const mutate of [f=>f.question.analysis.diagnostics.sourceSelections[0].error='failed',
    f=>f.review.evidenceStatus='incomplete', f=>f.review.knowledgeBasis='model_knowledge_supplement',
    f=>f.review.citationIssues=['invalid'],
    f=>f.question.analysis.evidenceCritic={options:[{optionId:'a',sourceTruth:'undetermined'}]},
    f=>f.question.analysis.evidenceCritic={options:[{optionId:'a',verdict:'contradicted'}]}]) {
    const f=fixture();mutate(f);assert.deepEqual(collect(f).question, []);
  }
});

test('deduplicates full document/page identity, retaining all addresses for a future viewer', () => {
  const f=fixture(3);f.question.analysis.evidence[1].pdfPage=1;
  const result=collect(f); const row=result.question.find(r=>r.pdfPage===1);
  assert.equal(result.question.length, 2);assert.equal(row.addresses.length, 2);
  assert.equal(row.knowledgeSnapshot,'snapshot');assert.equal(row.addresses[0].catalogManifest,'manifest');
  assert.equal(row.addresses[0].unitRevision,'original-revision');
  assert.equal(row.addresses[0].pageUrl,'https://example.test/folder/data.sources/page.png');
  f.question.analysis.evidence[1].documentId='other-doc';
  assert.equal(collect(f).question.length, 3);
});

test('same-page sources retain independent option bindings', () => {
  const f=fixture(2); const second=structuredClone(f.review);second.optionId='b';
  f.question.answers.push({analysis:second});
  const rows=f.question.analysis.diagnostics.sourceSelections[0].assessments;
  rows[0].optionIds=['a'];rows[1].optionIds=['b'];
  assert.deepEqual(collect(f).options.map(list=>list.map(r=>r.pdfPage)), [[1],[2]]);
});

test('PDF page numbers stay distinct from printed slide numbers; malformed page refs are excluded', () => {
  const f=fixture(2);f.question.analysis.evidence[0].printedSlideNumber=99;
  f.question.analysis.evidence[1].pdfPage=0;
  assert.deepEqual(collect(f).question.map(r=>r.pdfPage),[1]);
});

test('image references require admitted actual image citations and a ready region', () => {
  const f=fixture(1);const e=f.question.analysis.evidence[0];
  const image={evidenceId:'e0',layer:'image',quote:''};
  f.review.citations=[image];f.review.claims=[];f.review.finalAssessment={};
  f.question.analysis.diagnostics.sourceSelections[0].assessments[0].citations=[image];
  e.evidenceType='visual';e.visualAsset={status:'medical_pending'};
  assert.equal(collect(f).question.length,0);
  e.visualAsset.status='ready';assert.equal(collect(f).question.length,1);
});

test('display cleans only a trailing numeric file code and escapes labels', () => {
  assert.equal(sourcePdfName('folder\\Radiologie_Vorlesung__78810.pdf'),'Radiologie Vorlesung.pdf');
  assert.equal(sourcePdfName('Lecture_2024.pdf'),'Lecture 2024.pdf');
  const html=sourceReferencesHtml([{pdfName:'<script>.pdf',pdfPage:58}],3);
  assert.ok(html.includes('&lt;script&gt;.pdf'));assert.ok(html.includes('PDF-Seite 58'));
  assert.ok(html.includes('data-source-index="0"'));assert.ok(html.includes('data-source-references='));
  assert.match(sourceReferencesHtml([],3),/Keine geprüften Quellen/);
});
