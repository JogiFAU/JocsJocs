import test from "node:test";
import assert from "node:assert/strict";
import { loadJsonUrls } from "../src/data/loaders.js";
import { state } from "../src/state.js";

test("preserves block Markdown line breaks while normalizing AI hints", async () => {
  const payload = {
    questions: [{
      id: "markdown-hint",
      questionText: "Testfrage",
      answers: [{ text: "Antwort", isCorrect: true }],
      correctIndices: [0],
      aiAudit: {
        answerPlausibility: {
          passA: {
            reasonDetailed: "**Einordnung**\r\n\r\n-   Antwort A\r\n- Antwort B"
          }
        },
        explainer: {
          correctnessExplanation: "**Richtig**\n\n- Grund 1\n- Grund 2",
          wrongOptionExplanations: [{ answerIndex: 1, whyWrong: "**Falsch**\n\n- Begründung" }]
        }
      }
    }]
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => url === "fixture.json"
    ? { ok: true, json: async () => payload }
    : { ok: false, status: 404 };

  try {
    await loadJsonUrls(["fixture.json"]);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(state.questionsAll[0].aiReasonDetailed, "**Einordnung**\n\n- Antwort A\n- Antwort B");
  assert.equal(state.questionsAll[0].aiCorrectnessExplanation, "**Richtig**\n\n- Grund 1\n- Grund 2");
  assert.equal(state.questionsAll[0].aiWrongOptionExplanations[0].whyWrong, "**Falsch**\n\n- Begründung");
});

test("loads only nonempty DocsDocs comments for the matching question in export order", async () => {
  const payload = { questions: [{ id: "q", questionText: "Frage", answers: [{ text: "A" }] }] };
  const sidecar = { questions: { q: { entries: [
    { type: "comment", author: "A", displayText: "Erster\nBeitrag" },
    { type: "question_status", displayText: "Statuswechsel" },
    { type: "question_edit", displayText: "Änderung" },
    { type: "comment", displayText: " " },
    { type: "comment", author: "B", displayText: "Zweiter Beitrag" },
  ] } } };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    if (url === "fixture/data.json") return { ok: true, json: async () => payload };
    assert.equal(url, "fixture/docsdocs-comments.json");
    return { ok: true, json: async () => sidecar };
  };
  try {
    await loadJsonUrls(["fixture/data.json"]);
    assert.deepEqual(state.questionsAll[0].docsDocsComments, [
      { author: "A", text: "Erster\nBeitrag" },
      { author: "B", text: "Zweiter Beitrag" },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
