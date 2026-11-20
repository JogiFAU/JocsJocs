import { state, resetQuizSession } from "../state.js";
import { hash32, mulberry32, shuffle, toast } from "../utils.js";
import { evaluate } from "./evaluate.js";
import { saveSession, loadSession, listSessions } from "../data/storage.js";
import {newSessionName,sessionDisplayName,questionSignature,sessionAvailability} from './sessionRecord.js';
import { getQuizQuestionVariant, applyLocalQuestionOverride } from "./questionVariant.js";

function newSessionId() {
  return `s_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function startQuizSession({ subset, config }) {
  if (!subset.length) throw Error('Keine Fragen für diese Abfrage ausgewählt.');
  const existing=listSessions(state.activeDataset.id).map(session=>session.name);
  resetQuizSession();
  state.view = "quiz";
  state.quizConfig = config;
  state.quizFinishedAt = null;
  state.currentSessionId = newSessionId();
  state.sessionName=newSessionName(config,state.activeDataset.label || state.activeDataset.id,subset.length,existing);

  state.questionOrder = subset.map(q => q.id);

  // Answer shuffle mapping (qid -> display order as original indices)
  state.answerOrder = new Map();
  if (config.shuffleAnswers) {
    for (const q of subset) {
      const localOverride = state.localQuestionOverrides?.get(q.id);
      const effectiveQuestion = applyLocalQuestionOverride(q, localOverride);
      const useOriginalView = state.forceOriginalQuestionView?.has(q.id);
      const questionVariant = useOriginalView
        ? { answers: effectiveQuestion.answers || [] }
        : getQuizQuestionVariant(effectiveQuestion, config);
      const base = hash32((state.currentSessionId || "") + "|" + q.id);
      const rng = mulberry32(base);
      const order = shuffle([...Array((questionVariant.answers || []).length).keys()], rng);
      state.answerOrder.set(q.id, order);
    }
  }

  if (!persistCurrentQuizSession()) {
    state.view='config';
    throw Error(state.storageError);
  }
  toast("Abfrage gestartet.");
}

export function finishQuizSession() {
  if (state.view !== "quiz") return;
  state.view = "review";
  if (!state.quizFinishedAt) state.quizFinishedAt = Date.now();
  if (!persistCurrentQuizSession()) {
    state.view='quiz';state.quizFinishedAt=null;
    return false;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
  toast("Abfrage beendet. Auswertung ist verfügbar.");
  return true;
}

export function abortQuizSession() {
  if (!persistCurrentQuizSession()) return false;
  resetQuizSession();
  state.view = "overview";
  toast("Abfrage gespeichert. Du kannst sie später fortsetzen.");
  return true;
}


export function exitToConfig() {
  state.view = "overview";
}

export function startSearchView({ subset, config }) {
  state.view = "search";
  state.searchConfig = config;
  state.searchOrder = subset.map(q => q.id);
  state.explainOpen = new Set();
}

export function submitAnswer(q) {
  const qid = q.id;
  const selected = state.answers.get(qid) || [];
  state.excludedAnswers?.delete(qid);
  state.submitted.add(qid);
  const localOverride = state.localQuestionOverrides?.get(q.id);
  const effectiveQuestion = applyLocalQuestionOverride(q, localOverride);
  const useOriginalView = state.forceOriginalQuestionView?.has(q.id);
  const questionVariant = useOriginalView
    ? { text: effectiveQuestion.text, answers: effectiveQuestion.answers || [] }
    : getQuizQuestionVariant(effectiveQuestion, state.quizConfig);
  const evaluateQuestion = {
    ...effectiveQuestion,
    text: questionVariant.text,
    answers: questionVariant.answers,
    correctIndices: effectiveQuestion.correctIndices
  };
  const preferOriginal = (state.quizConfig?.useAiModifiedAnswers === false) && q.aiChangedAnswers;
  state.results.set(qid, evaluate(evaluateQuestion, selected, { preferOriginal }));
  persistCurrentQuizSession();
}

export function unsubmitAnswer(qid) {
  state.submitted.delete(qid);
  state.results.delete(qid);
  persistCurrentQuizSession();
}

export function persistCurrentQuizSession() {
  if (!state.activeDataset?.id || !state.currentSessionId) return;
  try {
    const datasetId = state.activeDataset.id;
    const existing = loadSession(datasetId, state.currentSessionId);

    // Serialize Maps/Sets
    const answersObj = {};
    for (const [k,v] of state.answers.entries()) answersObj[k] = v;

    const resultsObj = {};
    for (const [k,v] of state.results.entries()) resultsObj[k] = v;

    const answerOrderObj = {};
    for (const [k,v] of state.answerOrder.entries()) answerOrderObj[k] = v;

    const session = {
      ...existing,
      schemaVersion: 2,
      id: state.currentSessionId,
      name: state.sessionName,
      createdAt: existing?.createdAt || Date.now(),
      datasetId,
      sourceDatasetId:state.activeDataset.sourceId || datasetId,
      datasetLabel: state.activeDataset.label || datasetId,
      notebookUrl: state.activeDataset.notebookUrl || null,

      kind: "quiz",
      quizConfig: state.quizConfig,
      questionOrder: state.questionOrder,
      questionSignatures: Object.fromEntries(state.questionOrder.map(id=>{
        const question=state.questionsAll.find(q=>q.id===id);
        return [id,question?questionSignature(question):existing?.questionSignatures?.[id]];
      })),
      answerOrder: answerOrderObj,
      excludedAnswers: Object.fromEntries(state.excludedAnswers),
      forceOriginalQuestionView: Array.from(state.forceOriginalQuestionView),

      answers: answersObj,
      submitted: Array.from(state.submitted.values()),
      results: resultsObj,

      finishedAt: state.quizFinishedAt || null,
    };

    saveSession(datasetId, session);
    state.storageError=null;
    return true;
  } catch(error) {
    state.storageError='Abfrage konnte nicht gespeichert werden. Bitte den lokalen Browser-Speicher prüfen: '+error.message;
    toast(state.storageError,6000);
    return false;
  }
}

export function hydrateQuizSessionFromStorage(session) {
  if (!session || (session.kind && session.kind !== "quiz")) throw new Error("Ungültiger Abfragetyp.");
  const available=sessionAvailability(session,state.questionsAll);
  if (available.missing || available.changed) throw Error('Fragen dieser Abfrage fehlen oder wurden geändert. Bitte den passenden Fachstand laden.');

  resetQuizSession();

  state.currentSessionId = session.id;
  state.sessionName=session.name || sessionDisplayName(session);
  state.quizConfig = session.quizConfig || null;
  state.questionOrder = Array.isArray(session.questionOrder) ? session.questionOrder.slice() : [];

  state.answerOrder = new Map();
  const ao = session.answerOrder || {};
  for (const [qid, order] of Object.entries(ao)) {
    if (Array.isArray(order)) state.answerOrder.set(qid, order);
  }

  state.answers = new Map();
  for (const [qid, arr] of Object.entries(session.answers || {})) {
    if (Array.isArray(arr)) state.answers.set(qid, arr);
  }

  state.submitted = new Set(Array.isArray(session.submitted) ? session.submitted : []);

  state.results = new Map();
  for (const [qid, b] of Object.entries(session.results || {})) state.results.set(qid, !!b);

  state.explainOpen = new Set();
  state.excludedAnswers = new Map(Object.entries(session.excludedAnswers || {}).filter(([,value])=>Array.isArray(value)));
  state.forceOriginalQuestionView = new Set(Array.isArray(session.forceOriginalQuestionView)?session.forceOriginalQuestionView:[]);

  state.quizFinishedAt = session.finishedAt || null;
  state.view = state.quizFinishedAt ? "review" : "quiz";
}
