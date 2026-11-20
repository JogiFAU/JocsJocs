import {makeStudyInput} from "../study/coverage.js";
import {cancelStudyCalculation} from "../study/client.js";
import { setExamDisplayNames } from "../utils.js";
import { state } from "../state.js";
import { normalizeLegacyQuestion, annotateLegacyClusters } from "./legacyDataset.js";
import { normalizeCurrentQuestion, linkCurrentQuestions } from "./currentDataset.js";

async function loadOptionalDatasetFile(datasetUrl, filename, parse) {
  const url = datasetUrl.split(/[?#]/, 1)[0].replace(/[^/]+$/, filename);
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parse(await response.json());
  } catch (error) {
    console.warn(`Optionale Datensatzdatei konnte nicht geladen werden: ${url}`, error);
    return null;
  }
}

function parseDisplayTopics({ superTopics }) {
  const label = value => typeof value === "string" && value.trim().length > 0;
  if (!Array.isArray(superTopics) || !superTopics.length || !superTopics.every(group =>
    label(group?.name) && Array.isArray(group.subtopics) && group.subtopics.every(label)))
    throw new Error("Ungültiger Topic Tree.");
  return new Map(superTopics.flatMap((group, i) => group.subtopics.map((name, j) =>
    [`${i + 1}:${j + 1}`, { aiSuperTopic: group.name.trim(), aiSubtopic: name.trim() }])));
}

function parseCommentThreads({ questions }) {
  if (!questions || typeof questions !== "object" || Array.isArray(questions))
    throw new Error("Kommentarverläufe nach Frage-ID fehlen.");
  const threads = new Map();
  for (const [id, thread] of Object.entries(questions)) {
    if (!Array.isArray(thread?.entries)) continue;
    const comments = thread.entries
      .filter(entry => entry?.type === "comment" &&
        typeof entry.displayText === "string" && entry.displayText.trim())
      .map(entry => ({
        author: typeof entry.author === "string" ? entry.author.trim() : "",
        text: entry.displayText.trim(),
      }));
    if (comments.length) threads.set(id, comments);
  }
  return threads;
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
    const datasetUrl = res.url || url;
    const [displayTopics, commentThreads] = await Promise.all([
      version === "2.0" ? loadOptionalDatasetFile(datasetUrl, "topic-tree_display.json", parseDisplayTopics) : null,
      loadOptionalDatasetFile(datasetUrl, "docsdocs-comments.json", parseCommentThreads),
    ]);
    for (const q of payload.questions) {
      if (version == null && q.analysis) throw new Error("Analysefeldeintrag ohne Dataset-Schemaversion.");
      const nq = version === "2.0"
        ? normalizeCurrentQuestion(q, payload, res.url || url)
        : normalizeLegacyQuestion(q, res.url || url, payload.meta?.answerIndexBase);
      if (!nq) continue;
      const displayTopic = displayTopics?.get(q.analysis?.topicMapping?.primaryTopic);
      if (displayTopic) Object.assign(nq, displayTopic);
      const comments = commentThreads?.get(String(q.id));
      if (comments) nq.docsDocsComments = comments;
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
