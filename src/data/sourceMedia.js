// Portable source paths are resolved against their own dataset JSON, never the app root.
export function sourceAssetUrl(asset, jsonUrl, base = globalThis.location?.href || "http://localhost/") {
  const path = asset?.path;
  if (typeof path !== "string" || !/^[a-zA-Z0-9_.\/-]+$/.test(path) || path.startsWith("/") ||
      path.split("/").some(part => !part || part === "." || part === "..")) return null;
  try {
    const dataset = new URL(jsonUrl, base);
    if (!["http:", "https:"].includes(dataset.protocol)) return null;
    const url = new URL(path, dataset);
    return url.origin === dataset.origin ? url.href : null;
  } catch { return null; }
}

export function collectSourceMedia(question, jsonUrl, dataset = {}) {
  const current = Boolean(question.analysis);
  const annotation = question.analysis || question.aiAnalysis || {};
  const assets = new Map((dataset.annotation?.sourceMedia?.assets || []).map(a => [a.assetId,a]));
  const citations = new Map();
  if (current) {
    const reviews = [...(question.answers || []).map(a => a.analysis), ...(annotation.evidenceCritic?.options || [])];
    for (const review of reviews) {
      for (const cite of [...(review.citations || []),...(review.finalAssessment?.citations || []),...(review.claims || []).flatMap(c => c.citations || [])]) {
        if (!citations.has(cite.evidenceId)) citations.set(cite.evidenceId,[]);
        citations.get(cite.evidenceId).push({...cite,optionId:review.optionId});
      }
    }
  }
  const candidates = [...(annotation.evidence || []), ...(annotation.questionImageLinks || []).filter(
    link => ["same_image", "same_visual_content", "related_concept"].includes(link.relation))];
  const groups = new Map();
  for (const entry of candidates) {
    const stored = entry.sourceMedia;
    const entryCitations = citations.get(entry.evidenceId) || [];
    const media = current && stored ? {...stored,page:assets.get(stored.pageAssetId),region:assets.get(stored.regionAssetId),
      citations:entryCitations,optionIds:[...new Set(entryCitations.map(c=>c.optionId).filter(Boolean))],
      usage:entryCitations.length ? "cited" : entry.relation ? "image_match" : "retrieved"} : stored;
    if (!media) continue;
    const pageUrl = sourceAssetUrl(media.page, jsonUrl);
    const regionUrl = sourceAssetUrl(media.region, jsonUrl);
    const key = `${pageUrl || ""}|${regionUrl || ""}|${entry.documentId || ""}|${entry.pdfPage || ""}`;
    const row = groups.get(key) || { evidenceIds: [], sourcePaths: [], pdfPage: entry.pdfPage,
      title: entry.title || "", pageUrl, regionUrl, status: media.status, citations: [], optionNumbers: [],
      usage: media.usage, visualStatus: entry.visualAsset?.status || entry.assetStatus || null, warnings: [] };
    row.evidenceIds = [...new Set([...row.evidenceIds, entry.evidenceId])];
    row.sourcePaths = [...new Set([...row.sourcePaths, ...(entry.sourcePaths || [])])];
    row.warnings = [...new Set([...row.warnings, ...(media.warnings || [])])];
    for (const citation of media.citations || []) {
      if (!row.citations.some(c => c.optionId === citation.optionId && c.layer === citation.layer && c.quote === citation.quote))
        row.citations.push(citation);
    }
    for (const optionId of media.optionIds || []) {
      const index = (question.answers || []).findIndex((answer, i) => String(answer.analysis?.optionId || answer.id || `option-${i+1}`) === optionId);
      if (index >= 0 && !row.optionNumbers.includes(index + 1)) row.optionNumbers.push(index + 1);
    }
    if (media.usage === "cited") row.usage = "cited";
    groups.set(key, row);
  }
  return [...groups.values()].sort((a,b) => Number(b.usage === "cited") - Number(a.usage === "cited"));
}
