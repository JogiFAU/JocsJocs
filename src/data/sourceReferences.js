// Compact references derive from admitted, actually cited original evidence only.
import { sourceAssetUrl } from './sourceMedia.js';

const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
const pageCatalogs = new WeakMap();
export function sourcePdfName(path) {
  return String(path || '').split(/[\\/]/).pop().replace(/(?:__|[_ -])\d{5,}(?=\.pdf$)/i, '')
    .replace(/_+/g, ' ');
}

export function collectCheckedReferences(question, dataset, jsonUrl) {
  const annotation = question.analysis || {};
  const evidence = new Map((annotation.evidence || []).map(e => [e.evidenceId, e]));
  const assets = new Map((dataset.annotation?.sourceMedia?.assets || []).map(a => [a.assetId, a]));
  const selections = annotation.diagnostics?.sourceSelections || [];
  // Only packaged page images are navigable. Never invent paths to raw PDFs.
  let pageImages = pageCatalogs.get(dataset)?.get(jsonUrl);
  if (!pageImages) {
  pageImages = new Map();
  for (const q of dataset.questions || []) for (const entry of q.analysis?.evidence || []) {
    const path = entry.sourcePaths?.find(p => /\.pdf$/i.test(p));
    const document = entry.documentId || path;
    const url = sourceAssetUrl(assets.get(entry.sourceMedia?.pageAssetId), jsonUrl);
    if (document && Number.isInteger(entry.pdfPage) && entry.pdfPage > 0 && url) {
      if (!pageImages.has(document)) pageImages.set(document, new Map());
      pageImages.get(document).set(entry.pdfPage, {pdfPage:entry.pdfPage, pageUrl:url});
    }
  }
  if (!pageCatalogs.has(dataset)) pageCatalogs.set(dataset,new Map());
  pageCatalogs.get(dataset).set(jsonUrl,pageImages);
  }
  const perOption = question.answers.map(answer => {
    const review = answer.analysis || {};
    const critic = annotation.evidenceCritic?.options?.find(o => o.optionId === review.optionId);
    if (review.evidenceStatus !== 'source_cited' || review.citationIssues?.length ||
        review.knowledgeBasis === 'model_knowledge_supplement' ||
        (critic?.verdict && critic.verdict !== 'supported') || critic?.sourceTruth === 'undetermined') return [];
    const admitted = new Map();
    for (const selection of selections) {
      if (selection.error) continue;
      for (const assessment of selection.assessments || []) {
        if (assessment.admitted !== true || assessment.relation !== 'direct' ||
            !assessment.optionIds?.includes(review.optionId) ||
            !selection.acceptedEvidenceIds?.includes(assessment.evidenceId)) continue;
        admitted.set(assessment.evidenceId, [...(admitted.get(assessment.evidenceId) || []), ...(assessment.citations || [])]);
      }
    }
    const rows = new Map();
    const cite = (citation, weight) => {
      const entry = evidence.get(citation.evidenceId);
      if (!entry || !Number.isInteger(entry.pdfPage) || entry.pdfPage < 1) return;
      const admittedQuotes = admitted.get(citation.evidenceId) || [];
      const quote = normalize(citation.quote);
      if (!admittedQuotes.some(c => c.layer === citation.layer &&
          (citation.layer === 'image' || (quote && normalize(c.quote) && (normalize(c.quote).includes(quote) || quote.includes(normalize(c.quote))))))) return;
      const layer = {source:'sourceText', native:'nativeText', ocr:'ocrText'}[citation.layer];
      if (citation.layer === 'image') {
        if (entry.visualAsset?.status !== 'ready' || entry.evidenceType !== 'visual') return;
      } else if (!layer || !quote || !normalize(entry[layer]).includes(quote)) return;
      const path = entry.sourcePaths?.find(p => /\.pdf$/i.test(p));
      if (!path) return;
      // Never deduplicate by cleaned filename: two PDFs can have the same label.
      const key = JSON.stringify([entry.documentId || path, entry.pdfPage]);
      const row = rows.get(key) || { key, pdfName:sourcePdfName(path), pdfPage:entry.pdfPage,
        documentId:entry.documentId || null, sourcePaths:[...(entry.sourcePaths || [])],
        knowledgeSnapshot:dataset.annotation?.knowledgeSnapshot || null, runId:dataset.annotation?.runId || null,
        datasetUrl:jsonUrl, addresses:[], score:0 };
      row.documentPages = [...(pageImages.get(entry.documentId || path)?.values() || [])].sort((a,b)=>a.pdfPage-b.pdfPage);
      const address = { evidenceId:entry.evidenceId, pageId:entry.pageId || null,
        unitId:entry.unitId || null, unitRevision:entry.unitRevision || null,
        enrichmentRevision:entry.enrichmentRevision || null, catalogManifest:entry.catalogManifest || null,
        viewId:entry.viewId || null, sourceMedia:entry.sourceMedia || null,
        pageUrl:sourceAssetUrl(assets.get(entry.sourceMedia?.pageAssetId), jsonUrl),
        regionUrl:sourceAssetUrl(assets.get(entry.sourceMedia?.regionAssetId), jsonUrl) };
      const storedAddress = row.addresses.find(a => a.evidenceId === address.evidenceId);
      if (!storedAddress) row.addresses.push({...address, citations:[{layer:citation.layer, quote:citation.quote || ''}]});
      else if (!storedAddress.citations.some(c => c.layer===citation.layer && c.quote===(citation.quote || '')))
        storedAddress.citations.push({layer:citation.layer, quote:citation.quote || ''});
      row.score += weight;
      rows.set(key, row);
    };
    // Rank by use in the checked assessment, not by raw search-hit order.
    const seen = new Set();
    const add = (c, weight) => {
      const key = JSON.stringify([c.evidenceId, c.layer, normalize(c.quote)]);
      if (!seen.has(key)) { seen.add(key); cite(c, weight); }
    };
    for (const c of review.finalAssessment?.citations || []) add(c, 3);
    for (const claim of review.claims || []) for (const c of claim.citations || []) add(c, 2);
    for (const c of review.citations || []) add(c, 1);
    return [...rows.values()];
  });
  const rank = rows => [...rows].sort((a,b) => b.score-a.score || a.key.localeCompare(b.key));
  const combined = new Map();
  for (const row of perOption.flat()) {
    const previous = combined.get(row.key);
    if (!previous) combined.set(row.key, structuredClone(row));
    else {
      previous.score += row.score;
      for (const address of row.addresses)
        if (!previous.addresses.some(a => a.evidenceId === address.evidenceId)) previous.addresses.push(address);
    }
  }
  return { options:perOption.map(rows => rank(rows).slice(0,3)), question:rank(combined.values()).slice(0,7) };
}
