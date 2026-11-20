import {makeStudyInput} from "../study/coverage.js";
import {cancelStudyCalculation} from "../study/client.js";
import { setExamDisplayNames } from "../utils.js";
import { state } from "../state.js";
import { normalizeLegacyQuestion, annotateLegacyClusters } from "./legacyDataset.js";
import { normalizeCurrentQuestion, linkCurrentQuestions } from "./currentDataset.js";

async function loadDisplayTopics(datasetUrl) {
  const treeUrl = datasetUrl.split(/[?#]/, 1)[0].replace(/[^/]+$/, "topic-tree_display.json");
  try {
    const response = await fetch(treeUrl, { cache: "no-store" });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { superTopics } = await response.json();
    const label = value => typeof value === "string" && value.trim().length > 0;
    if (!Array.isArray(superTopics) || !superTopics.length || !superTopics.every(group =>
      label(group?.name) && Array.isArray(group.subtopics) && group.subtopics.every(label)))
      throw new Error("Ungültiger Topic Tree.");
    return new Map(superTopics.flatMap((group, i) => group.subtopics.map((name, j) =>
      [`${i + 1}:${j + 1}`, { aiSuperTopic: group.name.trim(), aiSubtopic: name.trim() }])));
  } catch (error) {
    console.warn(`Anzeige-Themen konnten nicht geladen werden: ${treeUrl}`, error);
    return null;
  }
}

export async function loadJsonUrls(urls) {
  cancelStudyCalculation();
  const byId = new Map();
  const subjects=new Set();
  for (const url of urls) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`JSON HTTP ${res.status}: ${url}`);
    const payload = await res.json();
    if (payload.meta?.subject) subjects.add(String(payload.meta.subject).trim());
    const version = payload.annotation?.schemaVersion;
    if (version != null && !["1.0", "2.0"].includes(version))
      throw new Error(`Nicht unterstützte Dataset-Schemaversion: ${version}`);
    if (!Array.isArray(payload.questions)) throw new Error("Dataset enthält keine Fragenliste.");
    const displayTopics = version === "2.0" ? await loadDisplayTopics(res.url || url) : null;
    for (const q of payload.questions) {
      if (version == null && q.analysis) throw new Error("Analysefeldeintrag ohne Dataset-Schemaversion.");
      const nq = version === "2.0"
        ? normalizeCurrentQuestion(q, payload, res.url || url)
        : normalizeLegacyQuestion(q, res.url || url);
      if (!nq) continue;
      const displayTopic = displayTopics?.get(q.analysis?.topicMapping?.primaryTopic);
      if (displayTopic) Object.assign(nq, displayTopic);
      byId.set(nq.id, nq);
    }
  }
  const questions = [...byId.values()];
  annotateLegacyClusters(questions.filter(q => !q.analysis));
  linkCurrentQuestions(questions);
  setExamDisplayNames(questions.map(q => q.examName));
  state.questionsAll = questions;
  state.loadedSubject=subjects.size===1?[...subjects][0]:null;
  state.studyInput = makeStudyInput(questions);
  state.studyResult = null;
}
