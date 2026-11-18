import { state } from "../state.js";
import { normalizeLegacyQuestion, annotateLegacyClusters } from "./legacyDataset.js";
import { normalizeCurrentQuestion, linkCurrentQuestions } from "./currentDataset.js";

export async function loadJsonUrls(urls) {
  const byId = new Map();
  for (const url of urls) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`JSON HTTP ${res.status}: ${url}`);
    const payload = await res.json();
    const version = payload.annotation?.schemaVersion;
    if (version != null && !["1.0", "2.0"].includes(version))
      throw new Error(`Nicht unterstützte Dataset-Schemaversion: ${version}`);
    if (!Array.isArray(payload.questions)) throw new Error("Dataset enthält keine Fragenliste.");
    for (const q of payload.questions) {
      if (version == null && q.analysis) throw new Error("Analysefeldeintrag ohne Dataset-Schemaversion.");
      const nq = version === "2.0"
        ? normalizeCurrentQuestion(q, payload, res.url || url)
        : normalizeLegacyQuestion(q, res.url || url);
      if (nq) byId.set(nq.id, nq);
    }
  }
  const questions = [...byId.values()];
  annotateLegacyClusters(questions.filter(q => !q.analysis));
  linkCurrentQuestions(questions);
  state.questionsAll = questions;
}
