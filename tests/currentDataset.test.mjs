import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCurrentQuestion,linkCurrentQuestions,optionKnowledgeLabel } from "../src/data/currentDataset.js";
import { loadJsonUrls } from "../src/data/loaders.js";
import { state } from "../src/state.js";
import { qMetaHtml } from "../src/ui/components.js";
import { evaluate } from "../src/quiz/evaluate.js";

const groupId="f".repeat(64);
test("model knowledge has a concise explicit label independent of explanation prose",()=>{
  assert.equal(optionKnowledgeLabel({knowledgeBasis:"model_knowledge_supplement"}),"Modellwissen · nicht quellenbestätigt");
  assert.equal(optionKnowledgeLabel({evidenceStatus:"source_cited"}),"Mit Quellenbezug");
  assert.equal(optionKnowledgeLabel({evidenceStatus:"incomplete"}),"Quellenlage unvollständig");
  assert.equal(optionKnowledgeLabel({status:"not_processed"}),"");
  assert.equal(optionKnowledgeLabel(undefined),"");
});
function fixture() {
  const cite={evidenceId:"e",layer:"source",quote:"Einzelbehauptung belegt"};
  const q={id:"q1",questionText:"Welche Aussage?",correctIndices:[999],answers:[
    {id:"a",text:"A",analysis:{optionId:"a",status:"analyzed",judgment:"true",explanation:"Klinische Einordnung",knowledgeBasis:"knowledgebase",
      claims:[{text:"Einzelbehauptung",citations:[cite]}],citations:[cite],qualityIssues:[],missingEvidence:[],finalAssessment:{decision:"select",citations:[cite]}}},
    {id:"b",text:"B",analysis:{optionId:"b",status:"analyzed",judgment:"false",explanation:"Begründung B",knowledgeBasis:"model_knowledge_supplement",claims:[],qualityIssues:[],missingEvidence:["Beleg fehlt"],finalAssessment:{decision:"reject"}}}],
    analysis:{occurrenceId:"o1",status:"partial",originalAnswerKey:{status:"provided",optionIds:["b"]},
      quality:{inputIssues:[],evidenceIssues:["incomplete"],conflicts:[]},topicMapping:{primaryTopic:"t",reason:"Zentraler Lerninhalt"},
      learningObjective:{objective:"Konkretes Lernziel"},solution:{selectedOptionIds:["a"],explanation:"Gesamterklärung"},originalComparison:"differs",
      relationships:{objectiveGroupIds:[groupId],taskGroupIds:[]},diagnostics:{},
      evidence:[{evidenceId:"e",sourcePaths:["Folien.pdf"],pdfPage:5,sourceMedia:{status:"ready",pageAssetId:"image",regionAssetId:null,warnings:[]}}],questionImageLinks:[]}};
  return {meta:{},annotation:{schemaVersion:"2.0",models:{primary:{name:"local-qwen"}},knowledgeSnapshot:"snapshot",
    topicCatalog:[{topicKey:"t",superTopicName:"Medizin",subtopicName:"Konkretes Thema"}],
    sourceMedia:{assets:[{assetId:"image",path:"data-abc.sources/a.png"}]},relationships:{status:"completed",
      objectiveGroups:[{groupId,label:"Lernzielgruppe",members:["o1","o2"],knownExamCount:2,occurrences:2}],taskGroups:[],
      relations:[{left:"o1",right:"o2",relation:"same_learning_objective",differences:["Andere Formulierung"]}],
      occurrences:[{occurrenceId:"o1",examId:"exam1"},{occurrenceId:"o2",examId:"exam2"}]}},questions:[q]};
}

test("knowledge-only exports retain mode and original key without source references",()=>{
  const data=fixture();data.annotation.analysisMode="model_knowledge_only";
  const question=data.questions[0];question.analysis.evidence=[];
  for(const answer of question.answers){
    Object.assign(answer.analysis,{knowledgeBasis:"model_knowledge_only",evidenceStatus:"model_knowledge_unverified",citations:[],claims:[]});
    answer.analysis.finalAssessment.citations=[];
  }
  const q=normalizeCurrentQuestion(question,data,"data.json");
  assert.equal(q.datasetAnnotation.analysisMode,"model_knowledge_only");
  assert.deepEqual(q.correctIndices,[1]);
  assert.deepEqual(q.aiSources,[]);
  assert.equal(optionKnowledgeLabel(q.optionAnalyses[0]),"Modellwissen · nicht quellenbestätigt");
});

test("uses explicit option IDs for original scoring and keeps AI proposals separate",()=>{
  const data=fixture();const q=normalizeCurrentQuestion(data.questions[0],data,"https://host.test/app/datasets/data.json");
  assert.deepEqual(q.correctIndices,[1]);assert.equal(evaluate(q,[1]),true);
  assert.equal(q.aiDisagreesWithOriginalAnswer,true);
  assert.equal(q.aiSuperTopic,"Medizin");assert.equal(q.aiTopicReason,"Zentraler Lerninhalt");
  assert.ok(!("aiConfidence" in q));assert.ok(!("aiAudit" in q));
  assert.equal(q.optionAnalyses[0].claims[0].text,"Einzelbehauptung");
  assert.equal(q.aiOptionExplanations[1].text,"Begründung B");
  assert.equal(q.optionAnalyses[1].knowledgeBasis,"model_knowledge_supplement");
  assert.equal(q.aiSourceMedia[0].pageUrl,"https://host.test/app/datasets/data-abc.sources/a.png");
  assert.deepEqual(q.aiSourceMedia[0].optionNumbers,[1]);
});

test("compact explanations contain only clinical prose while full structured details remain intact",()=>{
  const data=fixture();
  const review=data.questions[0].answers[0].analysis;
  review.qualityIssues=['DETAIL_QUALITY']; review.missingEvidence=['DETAIL_MISSING'];
  const q=normalizeCurrentQuestion(data.questions[0],data,"data.json");
  assert.equal(q.aiOptionExplanations[0].text,'Klinische Einordnung');
  assert.equal(q.aiReasonDetailed,'Gesamterklärung');
  assert.deepEqual(q.optionAnalyses[0].qualityIssues,['DETAIL_QUALITY']);
  assert.deepEqual(q.optionAnalyses[0].missingEvidence,['DETAIL_MISSING']);
  assert.equal(q.optionAnalyses[0].claims[0].text,'Einzelbehauptung');
  assert.equal(q.analysis.originalAnswerKey.optionIds[0],'b');
});

test("full cluster IDs stay strings and archive context remains available",()=>{
  const data=fixture();const q1=normalizeCurrentQuestion(data.questions[0],data,"data.json");
  const raw=structuredClone(data.questions[0]);raw.id="q2";raw.analysis.occurrenceId="o2";
  const q2=normalizeCurrentQuestion(raw,data,"data.json");linkCurrentQuestions([q1,q2]);
  assert.equal(q1.clusterId,groupId);assert.deepEqual(q1.clusterRelatedIds,["q2"]);
  assert.equal(q1.clusterExamCount,2);assert.equal(q1.isHighRelevanceCluster,true);
  assert.equal(q1.relationshipDetails.relations[0].differences[0],"Andere Formulierung");
  assert.match(qMetaHtml(q1,1),/analysierten Facharchiv/);
  assert.ok(!qMetaHtml(q1,1).includes("Niedrige KI-Confidence"));
  assert.ok(!qMetaHtml(q1,1).includes("Nur 2 Antwortoptionen"));
});

test("no confirmed repetition without two known exams",()=>{
  const data=fixture();data.annotation.relationships.objectiveGroups[0].knownExamCount=1;
  const q=normalizeCurrentQuestion(data.questions[0],data,"data.json");
  assert.equal(q.isHighRelevanceCluster,false);
});

test("a differing AI proposal stays marked for review even if source checks passed",()=>{
  const data=fixture();data.questions[0].analysis.status="supported";data.questions[0].analysis.quality={};
  const q=normalizeCurrentQuestion(data.questions[0],data,"data.json");
  assert.match(qMetaHtml(q,1),/Wartung empfohlen/);
  assert.match(q.aiMaintenanceReasons.join(" "),/Eingabeschlüssel/);
});

test("rejects unresolved topic and image references in the current contract",()=>{
  const data=fixture();data.questions[0].analysis.topicMapping.primaryTopic="unknown";
  assert.throws(()=>normalizeCurrentQuestion(data.questions[0],data,"data.json"),/Themenverweis/);
  data.questions[0].analysis.topicMapping.primaryTopic="t";data.annotation.sourceMedia.assets=[];
  assert.throws(()=>normalizeCurrentQuestion(data.questions[0],data,"data.json"),/Quellenbildverweis/);
});

test("strict version boundary does not silently fall back to stale legacy fields",async()=>{
  const fetch=globalThis.fetch;const before=state.questionsAll;
  try {
    for (const payload of [{questions:[],annotation:{schemaVersion:"99.0"}},
      {...fixture(),questions:[{...fixture().questions[0],aiAudit:{explainer:{summary:"stale"}}}]}]) {
      globalThis.fetch=async()=>({ok:true,json:async()=>payload});
      await assert.rejects(loadJsonUrls(["data.json"]));assert.equal(state.questionsAll,before);
    }
  } finally {globalThis.fetch=fetch;}
});

test("reader exposes original fields and contextualized input history without using them as current truth",()=>{
  const data=fixture();data.questions[0].provenance={previousAnnotations:[{contextId:"old",question:{aiAudit:{clinicalNote:"Historischer Hinweis"}}}]};
  data.annotation.inputContexts=[{contextId:"old",annotation:{knowledgeSnapshot:"old-snapshot"}}];
  const q=normalizeCurrentQuestion(data.questions[0],data,"data.json");
  assert.equal(q.originalFields.question.correctIndices[0],999);
  assert.equal(q.provenance.inputContexts[0].annotation.knowledgeSnapshot,"old-snapshot");
  assert.equal(q.aiReasonDetailed.includes("Historischer Hinweis"),false);
});
