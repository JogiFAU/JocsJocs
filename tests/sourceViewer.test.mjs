import test from 'node:test';
import assert from 'node:assert/strict';
import { viewerPage, adjacentPage, safeViewerUrl } from '../src/data/sourceViewer.js';
import { collectCheckedReferences } from '../src/data/sourceReferences.js';
const origin='https://example.test';
const source={pdfPage:32,addresses:[{pageUrl:origin+'/page32.png',regionUrl:origin+'/region.png'}],
  documentPages:[{pdfPage:31,pageUrl:origin+'/page31.png'},{pdfPage:33,pageUrl:origin+'/page33.png'},
    {pdfPage:35,pageUrl:origin+'/page35.png'}]};
test('source opens its exact page and navigates only to adjacent packaged pages',()=>{
  assert.equal(viewerPage(source,32,origin).url,origin+'/page32.png');
  assert.equal(adjacentPage(source,32,-1,origin).page,31);
  assert.equal(adjacentPage(source,32,1,origin).page,33);
  assert.equal(adjacentPage(source,33,1,origin),null);
  assert.equal(adjacentPage(source,32,2,origin),null);
  assert.equal(viewerPage(source,33,origin).cited,false);
});
test('no PDF path, region crop, foreign URL or unsafe scheme is guessed as a full page',()=>{
  for (const url of ['javascript:alert(1)','file:///C:/private.pdf','https://other.test/page.png',null])
    assert.equal(safeViewerUrl(url,origin),null);
  assert.equal(viewerPage({pdfPage:32,addresses:[{regionUrl:origin+'/crop.png'}]},32,origin).url,null);
});
test('navigation catalog binds document IDs and real portable page assets across questions',()=>{
  const citation={evidenceId:'e32',layer:'source',quote:'Original'};
  const entry={evidenceId:'e32',documentId:'a',pdfPage:32,sourcePaths:['a.pdf'],sourceText:'Original',sourceMedia:{pageAssetId:'p32'}};
  const q={answers:[{analysis:{optionId:'a',evidenceStatus:'source_cited',citations:[citation]}}],analysis:{evidence:[entry],
    diagnostics:{sourceSelections:[{acceptedEvidenceIds:['e32'],assessments:[{evidenceId:'e32',optionIds:['a'],admitted:true,relation:'direct',citations:[citation]}]}]}}};
  const data={questions:[q,{analysis:{evidence:[{...entry,evidenceId:'e33',pdfPage:33,sourceMedia:{pageAssetId:'p33'}},
    {...entry,evidenceId:'foreign',documentId:'b',pdfPage:31,sourceMedia:{pageAssetId:'p31'}}]}}],annotation:{sourceMedia:{assets:[
    {assetId:'p32',path:'images/32.png'},{assetId:'p33',path:'images/33.png'},{assetId:'p31',path:'images/31.png'}]}}};
  const result=collectCheckedReferences(q,data,origin+'/data.json').question[0];
  assert.deepEqual(result.documentPages.map(p=>p.pdfPage),[32,33]);
  assert.equal(adjacentPage(result,32,1,origin).url,origin+'/images/33.png');
  assert.equal(adjacentPage(result,32,-1,origin),null);
  assert.equal(result.addresses[0].citations[0].quote,'Original');
});
