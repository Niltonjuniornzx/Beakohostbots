import assert from 'node:assert/strict';
import test from 'node:test';
import { isFreshRunnerHeartbeat, runtimeOptions } from './bots.service';

test('rejects an ONLINE runner whose heartbeat is 90 seconds old',()=>{
  const now=Date.parse('2026-08-22T12:00:00.000Z');
  assert.equal(isFreshRunnerHeartbeat(new Date(now-89_999),now),true);
  assert.equal(isFreshRunnerHeartbeat(new Date(now-90_000),now),false);
  assert.equal(isFreshRunnerHeartbeat(null,now),false);
});

test('builds runtime choices only from the supplied runner images',()=>{
  assert.deepEqual(runtimeOptions(['node:22-alpine','python:3.12-slim','node:22-alpine']),[
    {image:'node:22-alpine',language:'NODEJS',label:'Node.js',version:'22',variant:'ALPINE',onlineNodes:1},
    {image:'python:3.12-slim',language:'PYTHON',label:'Python',version:'3.12',variant:'SLIM',onlineNodes:1},
  ]);
});
