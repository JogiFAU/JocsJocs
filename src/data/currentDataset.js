// Canonical schema 2.0 -> presentation model. No serialized display aliases are needed.
import { decodeHtmlEntities } from "../utils.js";
import { collectSourceMedia } from "./sourceMedia.js";
import { collectCheckedReferences } from "./sourceReferences.js";

const text = value => String(decodeHtmlEntities(value ?? "")).replace(/\r\n?/g, "\n").trim();
export function optionExplanation(answer) {
  const review = answer.analysis;
  if (review.status === "not_processed") return "";
  return text(review.explanation);
}

export function optionKnowledgeLabel(review) {
  if (!review || review.status === "not_processed") return "";
  if (review.knowledgeBasis === "model_knowledge_supplement" || review.evidenceStatus === "model_knowledge_unverified")
    return "Modellwissen · nicht quellenbestätigt";
  if (review.evidenceStatus === "source_cited") return "Mit Quellenbezug";
  if (review.evidenceStatus === "incomplete") return "Quellenlage unvollständig";
  return "Quellenbezug ungeklärt";
}

export function normalizeCurrentQuestion(q, dataset, jsonUrl) {
  if (!q.id || !q.analysis || !Array.isArray(q.answers) || q.answers.some(a => !a.analysis?.optionId))
    throw new Error("Unvollständige Frage im Dataset-Schema 2.0.");
  if (q.aiAudit || q.aiAnalysis) throw new Error("Schema 2.0 enthält veraltete Annotationsfelder.");
  const a = q.analysis;
  const registry = dataset.annotation.relationships;
  if (!registry || !Array.isArray(dataset.annotation.topicCatalog)) throw new Error("Themen- oder Beziehungskatalog fehlt.");
  const topic = dataset.annotation.topicCatalog.find(t => t.topicKey === a.topicMapping?.primaryTopic);
  if (a.topicMapping?.primaryTopic && a.topicMapping.primaryTopic !== "unmapped" && !topic)
    throw new Error("Themenverweis ohne zugehörigen Katalogeintrag.");
  const imageIds=new Set((dataset.annotation.sourceMedia?.assets || []).map(asset=>asset.assetId));
  for (const item of [...(a.evidence || []),...(a.questionImageLinks || [])]) {
    for (const role of ["pageAssetId","regionAssetId"]) {
      const id=item.sourceMedia?.[role];
      if (id && !imageIds.has(id)) throw new Error("Quellenbildverweis ohne Eintrag im Bildkatalog.");
    }
  }
  const groups = (ids, name) => (ids || []).map(id => {
    const group = registry[name]?.find(g => g.groupId === id);
    if (!group) throw new Error("Clusterverweis ohne zugehörigen Katalogeintrag: " + id);
    return group;
  });
  const objectiveGroups = groups(a.relationships?.objectiveGroupIds, "objectiveGroups");
  const taskGroups = groups(a.relationships?.taskGroupIds, "taskGroups");
  const primary = [...objectiveGroups].sort((x,y) => y.knownExamCount-x.knownExamCount || y.occurrences-x.occurrences || x.groupId.localeCompare(y.groupId))[0];
  const optionExplanations = q.answers.map((answer, answerIndex) => ({ answerIndex, text:optionExplanation(answer,answerIndex) })).filter(a => a.text);
  const original = a.originalAnswerKey?.status === "provided" ? new Set(a.originalAnswerKey.optionIds) : new Set();
  const correct = q.answers.flatMap((answer, index) => original.has(answer.analysis.optionId) ? [index] : []);
  const issues = [...(a.quality?.inputIssues || []), ...(a.quality?.evidenceIssues || []), ...(a.quality?.conflicts || []),
    ...(a.diagnostics?.inputIssues || []), ...(a.visualRetrievalWarnings || [])];
  if (a.status !== "supported") issues.push(a.status);
  if (a.originalComparison === "differs") issues.push("KI-Vorschlag weicht vom Eingabeschlüssel ab; fachlich prüfen.");
  if (a.originalAnswerKey?.status !== "provided") issues.push("Kein verlässlich zuordenbarer Eingabeschlüssel.");
  if (a.diagnostics?.error) issues.push(a.diagnostics.error);
  const summary = text(a.solution?.explanation);
  const checkedReferences = collectCheckedReferences(q, dataset, jsonUrl);
  const archiveExams = new Set((registry.occurrences || []).filter(o => o.examId != null).map(o => String(o.examId))).size;
  return {
    id:String(q.id), analysis:a, datasetAnnotation:dataset.annotation,
    provenance:q.provenance ? {...q.provenance,inputContexts:(dataset.annotation.inputContexts || []).filter(context =>
      q.provenance.previousAnnotations?.some(entry=>entry.contextId===context.contextId))} : null,
    originalFields:{dataset:{meta:dataset.meta,extensions:dataset.extensions || {}},
      question:Object.fromEntries(Object.entries(q).filter(([k])=>!["analysis","answers","provenance"].includes(k))),
      answers:q.answers.map(answer=>Object.fromEntries(Object.entries(answer).filter(([k])=>k!=="analysis")))},
    optionAnalyses:q.answers.map(answer => answer.analysis),
    relationshipDetails:{objectiveGroups,taskGroups,relations:(registry.relations || []).filter(r => [r.left,r.right].includes(a.occurrenceId)),
      occurrences:(registry.occurrences || []).filter(o => [...objectiveGroups,...taskGroups].some(g=>g.members.includes(o.occurrenceId)))},
    examName:q.examName || null, examYear:q.examYear == null ? null : Number(q.examYear),
    text:text(q.questionText), explanation:text(q.explanationText) || null,
    answers:q.answers.map(answer => ({id:answer.analysis.optionId,text:text(answer.text),isCorrect:original.has(answer.analysis.optionId)})),
    correctIndices:correct, originalCorrectIndices:correct, imageFiles:Array.isArray(q.imageFiles) ? q.imageFiles.slice() : [],
    reconstructedQuestion:null, aiChangedAnswers:false, aiDisagreesWithOriginalAnswer:a.originalComparison === "differs",
    aiReasonDetailed:summary, aiOptionExplanations:optionExplanations,
    aiCorrectnessExplanation:null, aiCorrectnessExplanationIndices:[],aiWrongOptionExplanations:[],
    aiSuperTopic:topic?.superTopicName || null, aiSubtopic:topic?.subtopicName || null, aiTopicReason:text(a.topicMapping?.reason) || null,
    aiMaintenanceReasons:[...new Set(issues)],
    aiMaintenanceSeverity:["technical_error","insufficient_input","conflict"].includes(a.status) ? 3 : issues.length ? 2 : 1,
    aiOptionSources:checkedReferences.options, aiQuestionSources:checkedReferences.question,
    aiSources:checkedReferences.question.map(row => `${row.pdfName} · PDF-Seite ${row.pdfPage}`),
    aiSourceMedia:collectSourceMedia(q,jsonUrl,dataset),
    questionAbstraction:a.learningObjective?.objective || a.topicMapping?.objective || a.interpretation?.objective || null,
    clusterId:primary?.groupId || null, clusterLabel:primary?.label || null,
    clusterSize:primary?.occurrences || 0,clusterExamCount:primary?.knownExamCount || 0,
    clusterExamShare:archiveExams ? (primary?.knownExamCount || 0)/archiveExams : 0,clusterRelatedIds:[],
    isHighRelevanceCluster:objectiveGroups.some(g => g.knownExamCount >= 2),
    isRepeatedTask:taskGroups.some(g => g.knownExamCount >= 2)
  };
}

export function linkCurrentQuestions(questions) {
  const byOccurrence = new Map(questions.filter(q => q.analysis).map(q => [q.analysis.occurrenceId,q.id]));
  for (const q of questions.filter(q => q.analysis)) {
    const group = q.relationshipDetails.objectiveGroups.find(g => g.groupId === q.clusterId);
    q.clusterRelatedIds = (group?.members || []).filter(id => id !== q.analysis.occurrenceId && byOccurrence.has(id)).map(id => byOccurrence.get(id));
  }
}
