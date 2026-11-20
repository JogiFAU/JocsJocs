import test from "node:test";
import assert from "node:assert/strict";
import { sourceAssetUrl, collectSourceMedia } from "../src/data/sourceMedia.js";
import { sourcesVisible } from "../src/ui/sourceMedia.js";
import { loadJsonUrls } from "../src/data/loaders.js";
import { state } from "../src/state.js";

const asset = { path: "result-abcd.sources/0123.png" };
const dataset = "https://example.test/Exams_app/datasets/test/result.annotated.json";
const entry = { evidenceId:"page:s1", documentId:"doc",sourcePaths:["slides.pdf"],pdfPage:7,
  sourceMedia:{ status:"ready",usage:"cited",page:asset,region:null,
    citations:[{optionId:"a",layer:"source",quote:"Originaltext"}],optionIds:["a"],warnings:[] } };

test("resolves source images relative to dataset including GitHub Pages subdirectory", () => {
  assert.equal(sourceAssetUrl(asset,dataset),"https://example.test/Exams_app/datasets/test/result-abcd.sources/0123.png");
});

test("rejects local, executable, external and traversing image references", () => {
  for (const path of ["../private.png","/private.png","file:///C:/secret.png","C:\\secret.png", "javascript:alert(1)",
    "https://evil.test/a.png","//evil.test/a.png","a/%2e%2e/b.png","a/./b.png","a//b.png"]) {
    assert.equal(sourceAssetUrl({path},dataset),null,path);
  }
});

test("deduplicates page chunks, keeps quoted text, options and relevant image links", () => {
  const question = {answers:[{id:"a",text:"A"}],aiAnalysis:{evidence:[entry,{...entry,evidenceId:"page:s2"}],
    questionImageLinks:[{...entry,relation:"same_image"},{...entry,relation:"unrelated",sourceMedia:{...entry.sourceMedia,page:{path:"bad/x.png"}}}]}};
  const result=collectSourceMedia(question,dataset);
  assert.equal(result.length,1);
  assert.deepEqual(result[0].evidenceIds,["page:s1","page:s2"]);
  assert.deepEqual(result[0].optionNumbers,[1]);
  assert.equal(result[0].citations.length,1);
  assert.equal(result[0].pageUrl,sourceAssetUrl(asset,dataset));
});

test("legacy source text remains usable without source images", () => {
  assert.deepEqual(collectSourceMedia({aiSources:["slides.pdf · S. 7"]},dataset),[]);
});

test("sources never leak into hidden exam solutions", () => {
  assert.equal(sourcesVisible({view:"quiz",quizMode:"exam",submitted:false,showSolutions:false}),false);
  assert.equal(sourcesVisible({view:"quiz",quizMode:"exam",submitted:true,showSolutions:false}),false);
  assert.equal(sourcesVisible({view:"quiz",quizMode:"practice",submitted:false,showSolutions:true}),false);
  assert.equal(sourcesVisible({view:"search",quizMode:"practice",submitted:true,showSolutions:false}),false);
  assert.equal(sourcesVisible({view:"quiz",quizMode:"practice",submitted:true,showSolutions:false}),true);
  assert.equal(sourcesVisible({view:"review",showSolutions:true}),true);
  assert.equal(sourcesVisible({view:"search",showSolutions:true}),true);
});

test("actual dataset loader retains source image URLs without affecting original answer key", async () => {
  const fetch=globalThis.fetch;
  globalThis.fetch=async()=>({ok:true,url:dataset,json:async()=>({questions:[{id:"q",questionText:"Test",
    answers:[{id:"a",text:"A",isCorrect:true}],correctIndices:[0],aiAnalysis:{evidence:[entry]}}]})});
  try {await loadJsonUrls([dataset]);} finally {globalThis.fetch=fetch;}
  assert.equal(state.questionsAll[0].aiSourceMedia[0].pageUrl,sourceAssetUrl(asset,dataset));
  assert.deepEqual(state.questionsAll[0].correctIndices,[0]);
});
