import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeProject, isEnvironmentFile, splitCommand } from './project-analysis';
const file=(path:string,content='')=>({path,content:Buffer.from(content)});

test('detects pnpm Node projects and package start scripts',()=>{
  const result=analyzeProject([file('package.json',JSON.stringify({scripts:{start:'node src/bot.js'}})),file('pnpm-lock.yaml'),file('src/bot.js')]);
  assert.equal(result.detectedRuntime,'NODEJS');assert.equal(result.packageManager,'pnpm');assert.equal(result.suggestedEntrypoint,'src/bot.js');assert.equal(result.suggestedStartCommand,'npm start');
});
test('detects Python manifests and conventional entrypoints',()=>{const result=analyzeProject([file('pyproject.toml'),file('main.py')]);assert.equal(result.detectedRuntime,'PYTHON');assert.equal(result.suggestedStartCommand,'python main.py')});
test('recognizes environment variants without matching arbitrary files',()=>{assert.equal(isEnvironmentFile('.env.production'),true);assert.equal(isEnvironmentFile('config/.env.local'),true);assert.equal(isEnvironmentFile('readme.env'),false)});
test('splits quoted commands without invoking a shell',()=>{assert.deepEqual(splitCommand('node "src/my bot.js" --mode production'),['node','src/my bot.js','--mode','production']);assert.throws(()=>splitCommand("node 'main.js"))});
