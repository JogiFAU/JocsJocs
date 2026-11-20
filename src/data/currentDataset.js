// Canonical schema 2.0 -> presentation model. No serialized display aliases are needed.
import { decodeHtmlEntities } from "../utils.js";
import { collectSourceMedia } from "./sourceMedia.js";
import { collectCheckedReferences } from "./sourceReferences.js";
import { markedAnswerIndices, normalizeAnswerIndices } from "./answerKey.js";

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
  const repetitionGroups = registry.comparisonVersion ? taskGroups : objectiveGroups;
  const primary = [...repetitionGroups].sort((x,y) => y.knownExamCount-x.knownExamCount || y.occurrences-x.occurrences || x.groupId.localeCompare(y.groupId))[0];
  const optionExplanations = q.answers.map((answer, answerIndex) => ({ answerIndex, text:optionExplanation(answer,answerIndex) })).filter(a => a.text);
  const ids = q.answers.map(answer => answer.analysis.optionId);
  const key = a.originalAnswerKey;
  const keyIds = key?.status === "provided" && Array.isArray(key.optionIds) &&
    new Set(ids).size === ids.length && key.optionIds.every(id => ids.includes(id))
    ? new Set(key.optionIds) : null;
  const derived = keyIds ? ids.flatMap((id, index) => keyIds.has(id) ? [index] : []) : null;
  const correct = markedAnswerIndices(q.answers) ??
    normalizeAnswerIndices(q.correctIndices, ids.length, dataset.meta?.answerIndexBase) ?? derived ?? [];
  const disputedKey = derived && derived.join() !== correct.join();
  const selected = a.solution?.selectedOptionIds;
  const aiDisagrees = disputedKey
    ? correct.length > 0 && Array.isArray(selected) && selected.length > 0 &&
      (new Set(selected).size !== correct.length || correct.some(index => !selected.includes(ids[index])))
    : a.originalComparison === "differs";
  const issues = [...(a.quality?.inputIssues || []), ...(a.quality?.evidenceIssues || []), ...(a.quality?.conflicts || []),
    ...(a.diagnostics?.inputIssues || []), ...(a.visualRetrievalWarnings || [])];
  if (a.status !== "supported") issues.push(a.status);
  if (aiDisagrees) issues.push("KI-Vorschlag weicht vom Eingabeschlüssel ab; fachlich prüfen.");
  if (disputedKey) issues.push("Exportierter Lösungsschlüssel weicht von den Originaldaten ab.");
  if (!correct.length) issues.push("Kein verlässlich zuordenbarer Eingabeschlüssel.");
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
    answers:q.answers.map((answer,index) => ({id:answer.analysis.optionId,text:text(answer.text),isCorrect:correct.includes(index)})),
    correctIndices:correct, originalCorrectIndices:correct, imageFiles:Array.isArray(q.imageFiles) ? q.imageFiles.slice() : [],
    reconstructedQuestion:null, aiChangedAnswers:false, aiDisagreesWithOriginalAnswer:aiDisagrees,
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
    isHighRelevanceCluster:repetitionGroups.some(g => g.knownExamCount >= 2),
    isRepeatedTask:taskGroups.some(g => g.knownExamCount >= 2)
  };
}

export function linkCurrentQuestions(questions) {
  const byOccurrence = new Map(questions.filter(q => q.analysis).map(q => [q.analysis.occurrenceId,q.id]));
  const current = questions.filter(q => q.analysis);
  const adjacency = new Map(current.map(q => [q.analysis.occurrenceId, new Set()]));
  const connect = (left, right) => {
    if (!adjacency.has(left) || !adjacency.has(right)) return;
    adjacency.get(left).add(right);
    adjacency.get(right).add(left);
  };
  for (const q of current) {
    for (const group of q.relationshipDetails.taskGroups) {
      for (const member of group.members) connect(q.analysis.occurrenceId, member);
    }
    for (const relation of q.relationshipDetails.relations) {
      const exact = relation.relation === 'exact_duplicate';
      const repeat = ['equivalent_task','near_repeat'].includes(relation.relation) ||
        relation.modelRelation === 'near_repeat';
      if (exact || (repeat && ['medium','high'].includes(relation.confidence)))
        connect(relation.left, relation.right);
    }
  }
  const visited = new Set();
  const byId = new Map(current.map(q => [q.id,q]));
  const allExams = new Set(current.map(q => q.examName).filter(Boolean)).size;
  for (const start of adjacency.keys()) {
    if (visited.has(start)) continue;
    const members = [];
    const pending = [start];
    while (pending.length) {
      const id = pending.pop();
      if (visited.has(id)) continue;
      visited.add(id);
      members.push(id);
      pending.push(...adjacency.get(id));
    }
    if (members.length < 2) continue;
    members.sort();
    const rows = members.map(id => byId.get(byOccurrence.get(id)));
    const examCount = new Set(rows.map(q => q.examName).filter(Boolean)).size;
    for (const q of rows) {
      q.clusterId = 'connected-' + members[0];
      q.clusterSize = members.length;
      q.clusterExamCount = examCount;
      q.clusterExamShare = allExams ? examCount / allExams : 0;
      q.isHighRelevanceCluster = examCount >= 2;
      q.isRepeatedTask = examCount >= 2;
      q.clusterRelatedIds = rows.filter(other => other !== q).map(other => other.id);
    }
  }
  for (const q of current) {
    const group = [...q.relationshipDetails.taskGroups,...q.relationshipDetails.objectiveGroups].find(g => g.groupId === q.clusterId);
    q.relatedQuestionIds = [...new Set(q.relationshipDetails.relations
      .filter(r => ['related_topic','same_learning_objective','variant_family'].includes(r.modelRelation || r.relation) && ['medium','high'].includes(r.confidence))
      .map(r => byOccurrence.get(r.left === q.analysis.occurrenceId ? r.right : r.left))
      .filter(id => id && id !== q.id))];
    if (!q.clusterId?.startsWith('connected-')) q.clusterRelatedIds = (group?.members || []).filter(id => id !== q.analysis.occurrenceId && byOccurrence.has(id)).map(id => byOccurrence.get(id));
  }
}
