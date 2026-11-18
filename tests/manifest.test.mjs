import test from 'node:test';
import assert from 'node:assert/strict';
import {validateManifest} from '../src/data/manifest.js';
test('accepts archive entries and existing legacy URL forms',()=>{
 const manifest={datasets:[{id:'archive',json:['datasets/analyzer-123/data.annotated.json']},{id:'legacy',json:'datasets/old.json'}]};
 assert.equal(validateManifest(manifest),manifest);
 assert.deepEqual(validateManifest({datasets:[]}),{datasets:[]});
});
test('rejects duplicate IDs and broken manifest entries',()=>{
 assert.throws(()=>validateManifest({datasets:[{id:'x',json:'a'},{id:'x',json:'b'}]}),/doppelt/);
 assert.throws(()=>validateManifest({datasets:[{id:'x',json:[]}]}),/JSON-Pfad/);
 assert.throws(()=>validateManifest({}),/datasets/);
});
