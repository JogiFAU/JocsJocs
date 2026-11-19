import {wireStudyUi,syncStudyConfiguration,readyStudyResult,resetStudyUi} from "../study/ui.js";
import {sessionDisplayName,sessionProgress,sessionAvailability} from "../quiz/sessionRecord.js";
import { $, toast, confirmDialog } from "../utils.js";
import { state, resetQuizSession, resetSearch } from "../state.js";
import { loadJsonUrls } from "../data/loaders.js";
import { loadZipUrl } from "../data/zipImages.js";
import { getSelectedDataset } from "../data/manifest.js";
import { filterByExams, filterByTopics, filterByImageMode, applyRandomAndShuffle, searchQuestions } from "../quiz/filters.js";
import { startQuizSession, startSearchView, finishQuizSession, abortQuizSession, hydrateQuizSessionFromStorage } from "../quiz/session.js";
import { renderAll, updateFilterLists } from "./render.js";
import { subjectStorageId, migrateSubjectSessions, listSessions, loadSession, deleteSession, exportBackupAllDatasets, importBackupAllDatasets, getLatestAnsweredResultsByQuestion, getLocalQuestionOverrides, deleteLocalQuestionOverride, clearLocalQuestionOverrides } from "../data/storage.js";
import { applyTheme } from "../theme.js";
import { wireSourceViewer } from './sourceReferences.js';

function selectedExamsFromList(containerId) {
  const el = $(containerId);
  if (!el) return [];
  return Array.from(el.querySelectorAll("input[type=checkbox][data-exam]:checked"))
    .map(x => x.dataset.exam)
    .filter(Boolean);
}


function selectedTopicsFromList(containerId) {
  const el = $(containerId);
  if (!el) return { superTopics: [], subTopics: [] };

  const superTopics = Array.from(el.querySelectorAll("input[type=checkbox][data-topic-super]:checked"))
    .map(x => x.dataset.topicSuper)
    .filter(Boolean);

  const subTopics = Array.from(el.querySelectorAll("input[type=checkbox][data-topic-sub]:checked"))
    .map(x => x.dataset.topicSub)
    .filter(Boolean);

  return { superTopics, subTopics };
}

function studyMetadata() {
  const result=readyStudyResult();
  if (!result) return null;
  const {selectionKey,...metadata}=result;
  return metadata;
}

function buildQuizConfigFromUi() {
  const rawN = ($("randomN")?.value || "").trim();
  const n = rawN ? Number(rawN) : 0;

  const topics = selectedTopicsFromList("topicListQuiz");

  return {
    kind: state.configKind,
    runName: $("quizRunName").value.trim(),
    sampleSeed: state.configurationSeed,
    highImpact: state.configKind==='highImpact' ? studyMetadata() : null,
    exams: selectedExamsFromList("examListQuiz"),
    superTopics: topics.superTopics,
    subTopics: topics.subTopics,
    imageFilter: $("imageFilterQuiz").value,
    wrongOnly: !!$("wrongOnlyQuiz")?.checked,
    randomN: Number.isFinite(n) && n > 0 ? Math.floor(n) : 0,
    keyword: ($("keywordFilter")?.value || "").trim(),
    keywordInAnswers: !!$("keywordInAnswers")?.checked,
    shuffleQuestions: $("shuffleQuestions").checked,
    shuffleAnswers: $("shuffleAnswers").checked,
    quizMode: $("quizMode").value,
    showTopicsInBanner: !!$("showTopicsInBanner")?.checked,
    aiModeEnabled: !!$("aiModeEnabled")?.checked,
    useAiModifiedAnswers: !!$("aiModeEnabled")?.checked,
  };
}

function getWrongQuestionIdSet() {
  const datasetId = state.activeDataset?.id;
  if (!datasetId) return new Set();
  const latestAnswered = getLatestAnsweredResultsByQuestion(datasetId);
  const wrong = new Set();
  for (const [qid, isCorrect] of latestAnswered.entries()) {
    if (isCorrect === false) wrong.add(qid);
  }
  return wrong;
}

function refreshWrongOnlyControl() {
  const wrong = getWrongQuestionIdSet();
  const count = wrong.size;

  [["wrongOnlyQuiz", "wrongOnlyQuizLabel"], ["wrongOnlySearch", "wrongOnlySearchLabel"]].forEach(([cbId, labelId]) => {
    const cb = $(cbId);
    const label = $(labelId);
    if (!cb) return;

    cb.disabled = (count === 0);
    if (count === 0) cb.checked = false;

    if (label) {
      label.textContent = count > 0
        ? `Nur aktuell falsch beantwortete Fragen (${count})`
        : "Nur aktuell falsch beantwortete Fragen (keine vorhanden)";
    }
  });

  return count;
}

function buildSearchConfigFromUi() {
  const topics = selectedTopicsFromList("topicListSearch");

  return {
    exams: selectedExamsFromList("examListSearch"),
    superTopics: topics.superTopics,
    subTopics: topics.subTopics,
    imageFilter: $("imageFilterSearch").value,
    query: $("searchText").value,
    inAnswers: $("searchInAnswers").checked,
    wrongOnly: !!$("wrongOnlySearch")?.checked,
    showSolutions: $("searchShowSolutions").checked,
    onlyAiModified: !!$("onlyAiModifiedSearch")?.checked,
  };
}

function computeBaseQuizSubset(config) {
  let qs = state.questionsAll.slice();
  qs = filterByExams(qs, config.exams);
  qs = filterByTopics(qs, { superTopics: config.superTopics, subTopics: config.subTopics });
  qs = filterByImageMode(qs, config.imageFilter);

  if (config.wrongOnly) {
    const wrong = getWrongQuestionIdSet();
    qs = qs.filter(q => wrong.has(q.id));
  }

  if (config.keyword) {
    qs = searchQuestions(qs, { query: config.keyword, inAnswers: config.keywordInAnswers });
  }

  qs = applyRandomAndShuffle(qs, {
    randomN: config.randomN,
    seed: config.sampleSeed,
    shuffleQuestions: config.shuffleQuestions
  });
  return qs;
}

function computeQuizSubset(config,base=null) {
  if (config.kind!=='highImpact') return base || computeBaseQuizSubset(config);
  const result=readyStudyResult();
  if (!result) return [];
  const questions=new Map(state.questionsAll.map(q=>[q.id,q]));
  const refs=result.set.referenceIds.map(id=>questions.get(id));
  if (refs.some(q=>!q)) return [];
  return applyRandomAndShuffle(refs,{shuffleQuestions:config.shuffleQuestions,seed:config.sampleSeed});
}

function computeSearchSubset(config) {
  let qs = state.questionsAll.slice();
  qs = filterByExams(qs, config.exams);
  qs = filterByTopics(qs, { superTopics: config.superTopics, subTopics: config.subTopics });
  qs = filterByImageMode(qs, config.imageFilter);

  if (config.wrongOnly) {
    const wrong = getWrongQuestionIdSet();
    qs = qs.filter(q => wrong.has(q.id));
  }

  if (config.onlyAiModified) {
    qs = qs.filter(q => q.aiChangedAnswers);
  }

  qs = searchQuestions(qs, { query: config.query, inAnswers: config.inAnswers });
  return qs;
}

function getQuestionsByOrder(order) {
  const idToQuestion = new Map(state.questionsAll.map(q => [q.id, q]));
  return order.map(qid => idToQuestion.get(qid)).filter(Boolean);
}

function hideReviewRepeatActions() {
  const container = $("reviewRepeatActions");
  if (container) container.hidden = true;
}

function startRepeatedSession(session,wrongOnly=false) {
  const availability=sessionAvailability(session,state.questionsAll);
  if (availability.missing || availability.changed) throw Error('Für diese Abfrage muss der passende Fachstand geladen sein.');
  const progress=sessionProgress(session);
  const ids=wrongOnly?progress.wrongIds:session.questionOrder;
  const questions=new Map(state.questionsAll.map(q=>[q.id,q]));
  const subset=ids.map(id=>questions.get(id));
  if (!subset.length) { toast('Keine passenden Fragen für die Wiederholung.');return false; }
  const config={...(session.quizConfig || {}),runName:'',repeatOf:session.id,
    repeatMode:wrongOnly?'wrong':'all',parentName:sessionDisplayName(session)};
  startQuizSession({subset,config});
  return true;
}

function restartQuizFromReview({wrongOnly=false}={}) {
  if (state.view!=='review') return;
  const session=loadSession(state.activeDataset.id,state.currentSessionId);
  if (session) startRepeatedSession(session,wrongOnly);
}

async function showOverview() {
  if (state.view==='quiz' && !abortQuizSession()) { await renderAll();return; }
  resetStudyUi();resetSearch();resetQuizSession();
  state.view='overview';state.configTab='quiz';state.configKind='normal';
  updateFilterLists();resetAllConfigs();
  await renderAll();
  window.scrollTo({top:0,behavior:'auto'});
}

async function configureQuery(kind) {
  if (!state.activeDataset) return;
  resetStudyUi();resetSearch();resetQuizSession();
  state.view='config';state.configTab='quiz';state.configKind=kind;
  state.configurationSeed=(Date.now() ^ Math.floor(Math.random()*0xffffffff)) >>> 0;
  $('studyScope').value='allExams';
  $('studyTarget').value='60';
  $('studyNominal').value='30';
  updateFilterLists();resetAllConfigs();
  await renderAll();
  window.scrollTo({top:0,behavior:'auto'});
}

async function configureSearch() {
  if (!state.activeDataset) return;
  resetStudyUi();resetSearch();resetQuizSession();
  state.view='config';state.configTab='search';state.configKind='normal';
  updateFilterLists();resetAllConfigs();
  await renderAll();
}

function refreshLocalOverridesUi() {
  const datasetId = state.activeDataset?.id;
  const sel = $("localOverridesSelect");
  if (!sel) return;
  sel.innerHTML = "";
  if (!datasetId) return;

  const overrides = state.localQuestionOverrides || new Map();
  const questionIndex = new Map(state.questionsAll.map((q, idx) => [q.id, { q, idx }]));

  for (const [qid, override] of overrides.entries()) {
    const info = questionIndex.get(qid);
    if (!info) continue;
    const opt = document.createElement("option");
    opt.value = qid;
    const exam = info.q.examName || "Unbekannte Klausur";
    const no = info.idx + 1;
    const txt = String(override?.text || info.q.text || "").slice(0, 70);
    opt.textContent = `${exam} - #${no} - ${txt}`;
    sel.appendChild(opt);
  }
}

async function loadDatasetFromManifest(autoToast = false) {
  if (state.loadingSubject) return;
  const d = getSelectedDataset();
  if (!d) {
    alert("Kein Fach gefunden (manifest.json).");
    return;
  }
  state.loadingSubject=true;
  $("loadDatasetBtn").disabled=true;
  $("loadDatasetBtn").textContent="Fach wird geladen …";
  $("datasetSelect").disabled=true;
  try {
    const jsonUrls = Array.isArray(d.json) ? d.json : [d.json];
    await loadJsonUrls(jsonUrls);
    await loadZipUrl(d.zip || null);

    const storageId=subjectStorageId(d,state.loadedSubject);
    migrateSubjectSessions(storageId,d.id,state.questionsAll);
    const overridesObj = getLocalQuestionOverrides(storageId);
    state.localQuestionOverrides = new Map(Object.entries(overridesObj || {}));

    state.activeDataset = { ...d, id:storageId, sourceId:d.id, label:state.loadedSubject || d.label };
    const legacyEditingAvailable=state.questionsAll.some(q=>Boolean(q.reconstructedQuestion));
    for (const id of ["aiModeEnabled","onlyAiModifiedSearch"]) {
      const field=$(id);
      const wrapper=field?.closest("label");
      if (wrapper) wrapper.hidden=!legacyEditingAvailable;
      if (field && !legacyEditingAvailable) field.checked=false;
    }
    const datasetMetaHint = $("datasetMetaHint");
    if (datasetMetaHint) {
      datasetMetaHint.textContent = `Aktuell gewähltes Fach: ${state.activeDataset.label || storageId}`;
    }

    resetQuizSession();
    resetSearch();
    state.view = "overview";
    state.configKind = "normal";
    resetStudyUi();
    state.configTab = "quiz";

    updateFilterLists();
    resetAllConfigs();

    $("pageNumber").value = "1";
    $("pageNumber2").value = "1";
    $("pageSize2").value = $("pageSize").value;

    refreshLocalOverridesUi();
    updatePreviewTexts();

    await renderAll();
    if (autoToast) toast("Fach geladen.");
  } catch (e) {
    alert("Fehler beim Laden des Fachs: " + e);
  } finally {
    state.loadingSubject=false;
    $("loadDatasetBtn").textContent="Fach laden";
    $("datasetSelect").disabled=false;
    await renderAll();
  }
}

function updatePreviewTexts() {
  if (!state.activeDataset) return;

  refreshWrongOnlyControl();

  const quizCfg = buildQuizConfigFromUi();
  const baseSubset = computeBaseQuizSubset(quizCfg);
  syncStudyConfiguration(baseSubset);
  const quizSubset = computeQuizSubset(quizCfg,baseSubset);
  const searchCfg = buildSearchConfigFromUi();
  const searchSubset = computeSearchSubset(searchCfg);
  state.preview = { quizCount: quizSubset.length, searchCount: searchSubset.length };

  const activeCount = state.configTab === "search" ? searchSubset.length : quizSubset.length;
  const needPaging = activeCount > 1000;
  const dc = $("displayControlsConfig");
  if (dc) dc.hidden = state.view!=="search" || !needPaging;
}


function bindExamListChange(containerId) {
  const el = $(containerId);
  el.addEventListener("change", async () => {
    updatePreviewTexts();
    if (state.view !== "quiz" && state.view !== "review") await renderAll();
  });
}

function resetQuizConfig() {
  for (const cb of document.querySelectorAll("#examListQuiz input[type=checkbox], #topicListQuiz input[type=checkbox]")) cb.checked = false;
  $("imageFilterQuiz").value = "all";
  const rn = $("randomN");
  if (rn) rn.value = "";
  const wo = $("wrongOnlyQuiz");
  if (wo) wo.checked = false;
  const kf = $("keywordFilter");
  if (kf) kf.value = "";
  const kia = $("keywordInAnswers");
  if (kia) kia.checked = false;

  $("quizRunName").value = "";
  $("shuffleQuestions").checked = false;
  $("shuffleAnswers").checked = false;
  $("quizMode").value = "practice";
  const showTopics = $("showTopicsInBanner");
  if (showTopics) showTopics.checked = true;
  const aiModeEnabled = $("aiModeEnabled");
  if (aiModeEnabled) aiModeEnabled.checked = false;
  updatePreviewTexts();
}

function resetSearchConfig() {
  for (const cb of document.querySelectorAll("#examListSearch input[type=checkbox], #topicListSearch input[type=checkbox]")) cb.checked = false;
  $("imageFilterSearch").value = "all";
  $("searchText").value = "";
  $("searchInAnswers").checked = false;
  const wo = $("wrongOnlySearch");
  if (wo) wo.checked = false;
  $("searchShowSolutions").checked = false;
  const aiOnly = $("onlyAiModifiedSearch");
  if (aiOnly) aiOnly.checked = false;
  updatePreviewTexts();
}

function resetAllConfigs() {
  resetQuizConfig();
  resetSearchConfig();
}

function scrollToFirstRenderedQuestion() {
  const list = $("questionList");
  if (!list) return;

  const scrollOnce = () => {
    const firstQuestion = list.querySelector(".qcard");
    if (!firstQuestion) return false;

    const header = document.querySelector("header.top");
    const headerH = header ? header.getBoundingClientRect().height : 0;
    const rect = firstQuestion.getBoundingClientRect();
    const y = window.scrollY + rect.top - headerH - 10;
    window.scrollTo({ top: Math.max(0, y), behavior: "auto" });
    return true;
  };

  if (scrollOnce()) return;
  requestAnimationFrame(() => {
    if (scrollOnce()) return;
    setTimeout(scrollOnce, 80);
  });
}


export function wireUiEvents() {
  wireStudyUi(async()=>{updatePreviewTexts();await renderAll();});
  wireSourceViewer();
  document.addEventListener("click", (ev) => {
    const toggleRoot = ev.target.closest("[data-tip-toggle]");
    if (toggleRoot) {
      // A label forwards its click to its input. Suppress that second click
      // once this row serves as a solution tooltip instead of answer input.
      if (toggleRoot.matches('.opt') && !ev.target.closest('a, button'))
        ev.preventDefault();
      const isOpen = toggleRoot.classList.contains("is-open");
      document.querySelectorAll("[data-tip-toggle].is-open").forEach((el) => {
        if (el !== toggleRoot) el.classList.remove("is-open");
      });
      toggleRoot.classList.toggle("is-open", !isOpen);
      return;
    }

    document.querySelectorAll("[data-tip-toggle].is-open").forEach((el) => {
      el.classList.remove("is-open");
    });
  });

  document.addEventListener("keydown", (ev) => {
    if (['Enter', ' '].includes(ev.key) && ev.target.matches('.lockedHint, .opt[data-tip-toggle]')) {
      ev.preventDefault();
      ev.target.click();
      return;
    }
    if (ev.key !== "Escape") return;
    document.querySelectorAll("[data-tip-toggle].is-open").forEach((el) => {
      el.classList.remove("is-open");
    });
  });

  $("themeSelect")?.addEventListener("change", async (ev) => {
    const nextTheme = ev.target?.value;
    await applyTheme(nextTheme);
    await renderAll();
  });

  // Workflow navigation never discards a started query.
  $('tabQuiz').addEventListener('click',showOverview);
  $('tabSearch').addEventListener('click',configureSearch);
  $('backOverviewBtn').addEventListener('click',showOverview);
  document.addEventListener('click',async(event)=>{
    const button=event.target.closest('button');
    if (!button || button.disabled) return;
    try {
      if (button.id==='newQueryBtn') { await configureQuery('normal');return; }
      if (button.id==='newImpactQueryBtn') { await configureQuery('highImpact');return; }
      const action=button.dataset.queryAction;
      if (!action) return;
      const session=loadSession(state.activeDataset.id,button.dataset.queryId);
      if (!session) throw Error('Die gespeicherte Abfrage wurde nicht gefunden.');
      if (action==='delete') {
        const confirmed=await confirmDialog({title:'Abfrage löschen?',message:sessionDisplayName(session),confirmText:'Löschen'});
        if (!confirmed) return;
        deleteSession(state.activeDataset.id,session.id);
        updateFilterLists();updatePreviewTexts();await renderAll();return;
      }
      resetStudyUi();
      if (action==='open') hydrateQuizSessionFromStorage(session);
      else startRepeatedSession(session,action==='wrong');
      initNavObserver();await renderAll();window.scrollTo({top:0,behavior:'auto'});
    } catch(error) { alert(error.message); }
  });

  $("loadDatasetBtn").addEventListener("click", async () => {
    await loadDatasetFromManifest(true);
  });

  window.addEventListener("localOverridesChanged", () => {
    refreshLocalOverridesUi();
  });

  $("datasetSelect")?.addEventListener("change", async () => {
    if (state.view === "quiz" || state.view === "review") return;
    await renderAll();
  });

  $("resetConfigQuizBtn").addEventListener("click", () => resetQuizConfig());
  $("resetConfigSearchBtn").addEventListener("click", async () => {
    resetSearchConfig();
    if (state.view === "search") {
      resetSearch();
      state.view = "config";
      state.configTab = "search";
      updateFilterLists();
      refreshLocalOverridesUi();
      await renderAll();
    }
  });

  [
    "quizRunName","imageFilterQuiz","wrongOnlyQuiz","randomN","keywordFilter","keywordInAnswers","shuffleQuestions","shuffleAnswers","quizMode","showTopicsInBanner","aiModeEnabled",
    "imageFilterSearch","searchText","searchInAnswers","wrongOnlySearch","searchShowSolutions","onlyAiModifiedSearch"
  ].forEach(id => {
    const el = $(id);
    el.addEventListener(el.tagName === "INPUT" ? "input" : "change", async () => {
      updatePreviewTexts();
      if (state.view !== "quiz" && state.view !== "review") await renderAll();
    });
  });
  bindExamListChange("examListQuiz");
  bindExamListChange("examListSearch");
  bindExamListChange("topicListQuiz");
  bindExamListChange("topicListSearch");

  $("startQuizBtn").addEventListener("click", async () => {
    if (!state.activeDataset) {
      alert("Bitte zuerst ein Fach laden.");
      return;
    }
    const cfg = buildQuizConfigFromUi();
    const subset = computeQuizSubset(cfg);
    if (cfg.kind==='highImpact' && !cfg.highImpact) { alert("Bitte zuerst ein gültiges Lernset berechnen.");return; }
    if (!subset.length) {
      alert("Keine Fragen im Subset. Filter anpassen.");
      return;
    }
    try { startQuizSession({ subset, config: cfg }); }
    catch(error) { alert(error.message);return; }
    initNavObserver();
    $("pageNumber").value = "1";
    $("pageNumber2").value = "1";
    $("pageSize2").value = $("pageSize").value;
    await renderAll();
    scrollToFirstRenderedQuestion();
  });

  $("endQuizBtn").addEventListener("click", async () => {
    if (state.view === "quiz") {
      const unanswered = Math.max(0, state.questionOrder.length - state.submitted.size);
      if (unanswered > 0) {
        const verb = unanswered === 1 ? "ist" : "sind";
        const ok = await confirmDialog({
          title: "Zur Auswertung wechseln?",
          message: `${unanswered} Frage${unanswered === 1 ? "" : "n"} ${verb} noch nicht beantwortet. Trotzdem zur Auswertung wechseln?`,
          confirmText: "Zur Auswertung"
        });
        if (!ok) return;
      }
    }

    if (!finishQuizSession()) { await renderAll();return; }
    initNavObserver();
    refreshLocalOverridesUi();
    await renderAll();
    window.scrollTo({ top: 0, behavior: "auto" });
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
  });

  $('abortQuizBtn').addEventListener('click',showOverview);

  $("repeatQuizBtn")?.addEventListener("click", async () => {
    hideReviewRepeatActions();
    restartQuizFromReview({ wrongOnly: false });
    if (state.view !== "quiz") return;
    initNavObserver();
    $("pageNumber").value = "1";
    $("pageNumber2").value = "1";
    $("pageSize2").value = $("pageSize").value;
    await renderAll();
    window.scrollTo({ top: 0, behavior: "auto" });
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
  });

  $("repeatWrongQuizBtn")?.addEventListener("click", async () => {
    hideReviewRepeatActions();
    restartQuizFromReview({ wrongOnly: true });
    if (state.view !== "quiz") return;
    initNavObserver();
    $("pageNumber").value = "1";
    $("pageNumber2").value = "1";
    $("pageSize2").value = $("pageSize").value;
    await renderAll();
    window.scrollTo({ top: 0, behavior: "auto" });
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
  });

  
  $("startSearchBtn").addEventListener("click", async () => {
    state.configTab = "search";
    if (!state.activeDataset) {
      alert("Bitte zuerst ein Fach laden.");
      return;
    }
    const cfg = buildSearchConfigFromUi();
    const subset = computeSearchSubset(cfg);
    startSearchView({ subset, config: cfg });
    initNavObserver();
    $("pageNumber").value = "1";
    await renderAll();
    scrollToFirstRenderedQuestion();
  });

  // Paging main
  $("prevPage").addEventListener("click", async () => {
    $("pageNumber").value = String(Math.max(1, Number($("pageNumber").value || 1) - 1));
    await renderAll();
  });
  $("nextPage").addEventListener("click", async () => {
    $("pageNumber").value = String(Number($("pageNumber").value || 1) + 1);
    await renderAll();
  });
  ["pageSize","pageNumber"].forEach(id => $(id).addEventListener("change", async () => await renderAll()));

  // Paging session mirror
  $("prevPage2").addEventListener("click", async () => {
    $("pageNumber2").value = String(Math.max(1, Number($("pageNumber2").value || 1) - 1));
    $("pageNumber").value = $("pageNumber2").value;
    await renderAll();
  });
  $("nextPage2").addEventListener("click", async () => {
    $("pageNumber2").value = String(Number($("pageNumber2").value || 1) + 1);
    $("pageNumber").value = $("pageNumber2").value;
    await renderAll();
  });
  ["pageSize2","pageNumber2"].forEach(id => {
    $(id).addEventListener("change", async () => {
      $("pageSize").value = $("pageSize2").value;
      $("pageNumber").value = $("pageNumber2").value;
      await renderAll();
    });
  });

  const clusterDialog = $("clusterQuestionsDialog");
  $("clusterDialogClose")?.addEventListener("click", () => {
    clusterDialog?.close();
  });
  clusterDialog?.addEventListener("click", (ev) => {
    if (ev.target === clusterDialog) clusterDialog.close();
  });

  // Storage
  $("deleteLocalOverrideBtn")?.addEventListener("click", async () => {
    const datasetId = state.activeDataset?.id;
    if (!datasetId) return;
    const qid = $("localOverridesSelect")?.value;
    if (!qid) return;
    deleteLocalQuestionOverride(datasetId, qid);
    state.localQuestionOverrides.delete(qid);
    state.forceOriginalQuestionView.delete(qid);
    refreshLocalOverridesUi();
    await renderAll();
  });

  $("clearLocalOverridesBtn")?.addEventListener("click", async () => {
    const datasetId = state.activeDataset?.id;
    if (!datasetId) return;
    clearLocalQuestionOverrides(datasetId);
    state.localQuestionOverrides = new Map();
    state.forceOriginalQuestionView = new Set();
    refreshLocalOverridesUi();
    await renderAll();
  });


  $("downloadBackupBtn").addEventListener("click", () => {
    const backup = exportBackupAllDatasets();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "examgen_backup.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  $("importBackupFile").addEventListener("change", async (e) => {
    const file = (e.target.files || [])[0];
    if (!file) return;
    try {
      const txt = await file.text();
      const obj = JSON.parse(txt);
      importBackupAllDatasets(obj);
      if (state.activeDataset) migrateSubjectSessions(state.activeDataset.id,state.activeDataset.sourceId || state.activeDataset.id,state.questionsAll);
      updateFilterLists();
      updatePreviewTexts();
      await renderAll();
    } catch (err) {
      alert("Backup konnte nicht importiert werden: " + err);
    } finally {
      e.target.value = "";
    }
  });

  // Mobile helper button: show "back to navigation" when TOC is out of view
  const navBtn = $("jumpToNavBtn");
  const mq = window.matchMedia("(max-width: 980px)");

  const setNavBtnHidden = (hidden) => {
    if (!navBtn) return;
    navBtn.hidden = hidden;
  };

  const shouldUseNavBtn = () => (mq.matches && (state.view === "quiz" || state.view === "review"));

  if (navBtn) {
    navBtn.addEventListener("click", () => {
      const target = $("sidebarSession");
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  let observer = null;
  const initNavObserver = () => {
    if (observer) observer.disconnect();
    if (!shouldUseNavBtn()) {
      setNavBtnHidden(true);
      return;
    }
    const target = $("sidebarSession");
    if (!target) {
      setNavBtnHidden(true);
      return;
    }
    observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!shouldUseNavBtn()) {
        setNavBtnHidden(true);
        return;
      }
      setNavBtnHidden(entry && entry.isIntersecting);
    }, { threshold: 0.15 });

    observer.observe(target);
    setNavBtnHidden(true);
  };

  mq.addEventListener?.("change", () => initNavObserver());

  // re-init on scroll (cheap guard for dynamic layout changes)
  window.addEventListener("scroll", () => {
    if (!navBtn) return;
    if (!shouldUseNavBtn()) { setNavBtnHidden(true); return; }
  }, { passive: true });

  initNavObserver();

}
