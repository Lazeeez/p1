import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const worker=readFileSync(fileURLToPath(new URL('../runner.worker.js',import.meta.url)),'utf8');
const harness=worker.match(/const HARNESS = String\.raw`([\s\S]*?)`;/)?.[1];
const candidate=['python3','python'].find(exe=>spawnSync(exe,['-c','print(1)'],{encoding:'utf8',timeout:1000}).status===0);
const run=payload=>{
  const code='import sys\n__payload_json=sys.stdin.read()\n'+harness+'\nprint(json.dumps(answer))';
  const child=spawnSync(candidate,['-c',code],{input:JSON.stringify(payload),encoding:'utf8',timeout:5000,maxBuffer:100000});
  assert.equal(child.status,0,child.stderr||child.error?.message);
  return JSON.parse(child.stdout.trim());
};

test('Python judge: arrays, linked lists, tree values, numeric int/float equivalence, and correct negative feedback',{skip:!candidate},()=>{
  assert.ok(harness);
  const twoSum=run({fn:'twoSum',code:'def twoSum(nums,target):\n    return [0,1]',comparator:'unordered',tests:[{args:[[2,7],9],expected:[1,0]}]});
  assert.equal(twoSum.results[0].ok,true);
  const median=run({fn:'median',code:'def median(nums):\n    return 2.0',comparator:'exact',tests:[{args:[[1,2,3]],expected:2}]});
  assert.equal(median.results[0].ok,true,'A numerically equal Python float and integer should compare equal');
  const wrong=run({fn:'median',code:'def median(nums):\n    return 2.1',comparator:'exact',tests:[{args:[[1,2,3]],expected:2}]});
  assert.equal(wrong.results[0].ok,false,'An incorrect float must not be accepted');
  const tree=run({fn:'sumTree',code:'def sumTree(root):\n    return root.val + root.left.val + root.right.val',tests:[{args:[{'$tree':[1,2,3]}],expected:6}]});
  assert.equal(tree.results[0].ok,true);
  const list=run({fn:'reverseList',code:'def reverseList(head):\n    result=None\n    while head:\n        head.next,result,head=result,head,head.next\n    return result',tests:[{args:[{'$list':[1,2,3]}],expected:{'$list':[3,2,1]}}]});
  assert.equal(list.results[0].ok,true);
  const syntax=run({fn:'f',code:'def f(:\n    pass',tests:[{args:[],expected:1}]});
  assert.equal(syntax.ok,false);
  assert.match(syntax.error,/SyntaxError/);
});
