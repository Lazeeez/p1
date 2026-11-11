import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PATTERNS,PROBLEMS,getProblem,BY_PATTERN} from '../catalog.js';
import {STUDY_GUIDES} from '../study-guides.js';
import {attachPersonalContent,createRemix,remixSupported,validatePattern,validateProblem} from '../personal-content.js';

test('all curated patterns have complete pre-practice guides',()=>{
  assert.equal(Object.keys(STUDY_GUIDES).length,PATTERNS.length);
  for(const p of PATTERNS){
    const g=STUDY_GUIDES[p.id];assert.ok(g,`missing guide for ${p.id}`);
    for(const key of ['objective','intuition','complexity','compare','template'])assert.ok(typeof g[key]==='string'&&g[key].length>20,p.id+' '+key);
    assert.ok(g.walkthrough&&g.walkthrough.steps?.length>=3,p.id+' walkthrough');
    assert.ok(g.mistakes?.length>=2,p.id+' mistakes');assert.equal(g.recall?.length,2,p.id+' recall');
  }
});
test('independent case generators create valid and reproducible variants',()=>{
  const ids=PROBLEMS.filter(p=>remixSupported(p.id)).map(p=>p.id);
  assert.equal(ids.length,12);
  for(const id of ids){
    const p=getProblem(id);
    for(let seed=1;seed<=15;seed++){
      const variant=createRemix(p,seed,9_000_000+seed);
      assert.equal(variant.tests.length,7);
      assert.equal(variant.source,'curated-remix');
      assert.equal(variant.variantOf,id);
      assert.ok(validateProblem(variant),`${p.title} seed ${seed}`);
      assert.deepEqual(variant.tests,createRemix(p,seed,9_000_000+seed).tests);
    }
  }
});
test('user-created content is validated, attached, and removable without changing curated bank',()=>{
  const originalP=PATTERNS.length,originalQ=PROBLEMS.length;
  const pattern={id:'personal-test-pattern',name:'Test pattern',short:'Test introduction',signal:'Find a useful signal',idea:'An intuition',invariant:'A useful loop invariant',pitfall:'An avoidable error',example:'Simple example',tier:'Advanced',quiz:['Which approach is correct?',['A','B','C'],1,'B is correct'],study:{objective:'Learn the idea',intuition:'Learn by examples',walkthrough:{title:'Example',input:'Input example',steps:['First step','Second step','Third step'],conclusion:'This follows'},template:'def template(): pass',complexity:'O(n) time',compare:'Compare strategies',mistakes:['First mistake','Second mistake'],recall:['Why?','When?']}};
  assert.ok(validatePattern(pattern));
  const exercise={id:9000000,title:'An example',pattern:pattern.id,difficulty:'Easy',fn:'solveExample',signature:'nums: list[int]',description:'Return the length of nums.',starter:'def solveExample(nums: list[int]):\n    pass',hints:['Count values','Consider len','The size is available'],tests:[{args:[[1,2]],expected:2},{args:[[]],expected:0},{args:[[4]],expected:1}],source:'ai-draft'};
  assert.ok(validateProblem(exercise,new Set([...PATTERNS.map(p=>p.id),pattern.id])));
  const attached=attachPersonalContent({personalPatterns:[pattern],personalProblems:[exercise]});
  assert.equal(attached.personalPatterns.length,1);assert.equal(attached.personalProblems.length,1);
  assert.equal(BY_PATTERN[pattern.id].length,1);
  assert.equal(PATTERNS.length,originalP+1);assert.equal(PROBLEMS.length,originalQ+1);
  attachPersonalContent({personalPatterns:[],personalProblems:[]});
  assert.equal(PATTERNS.length,originalP);assert.equal(PROBLEMS.length,originalQ);assert.equal(BY_PATTERN[pattern.id],undefined);
});
