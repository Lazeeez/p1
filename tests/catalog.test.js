import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PATTERNS, PROBLEMS, BY_PATTERN, getProblem, getPattern, leetcodeUrl} from '../catalog.js';

test('curriculum contains uniquely identified, complete pattern lessons', () => {
  assert.equal(PATTERNS.length, 22);
  assert.equal(new Set(PATTERNS.map(p => p.id)).size, PATTERNS.length);
  for (const p of PATTERNS) {
    for (const field of ['id','name','short','signal','idea','invariant','pitfall','example']) assert.ok(typeof p[field] === 'string' && p[field].trim(), `${p.id}: ${field}`);
    assert.ok(Array.isArray(p.quiz) && p.quiz.length === 4 && Array.isArray(p.quiz[1]));
    assert.ok(p.quiz[2] >= 0 && p.quiz[2] < p.quiz[1].length);
    assert.equal(getPattern(p.id),p);
    assert.ok(BY_PATTERN[p.id].length >= 1, `${p.id}: no challenges`);
  }
});

test('problem bank has valid exercises and self-contained runnable test fixtures', () => {
  assert.equal(PROBLEMS.length, 76);
  assert.equal(new Set(PROBLEMS.map(p => p.id)).size, PROBLEMS.length);
  for (const p of PROBLEMS) {
    assert.ok(Number.isInteger(p.id) && p.id > 0);
    assert.ok(getPattern(p.pattern), `${p.title}: unknown pattern ${p.pattern}`);
    assert.ok(['Easy','Medium','Hard'].includes(p.difficulty), p.title);
    for (const field of ['title','description','fn','signature','starter']) assert.ok(typeof p[field] === 'string' && p[field].trim(), `${p.title}: ${field}`);
    assert.match(p.fn,/^[a-zA-Z_]\w*$/, `${p.title}: invalid Python function name`);
    assert.ok(p.starter.includes(`def ${p.fn}(`),`${p.title}: starter function mismatch`);
    assert.equal(p.hints.length,3, `${p.title}: expected three incremental hints`);
    assert.ok(p.hints.every(h=>typeof h==='string' && h.trim()));
    assert.ok(p.tests.length >= 2, `${p.title}: insufficient regression cases`);
    for (const t of p.tests) {
      assert.ok(Array.isArray(t.args),`${p.title}: test args must be list`);
      assert.ok(Object.hasOwn(t,'expected'),`${p.title}: missing expected output`);
    }
    assert.equal(getProblem(String(p.id)),p);
    assert.match(leetcodeUrl(p),/^https:\/\/leetcode\.com\/problems\/[a-z0-9-]+\/$/);
  }
});
