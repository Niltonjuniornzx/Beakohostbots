import { posix } from 'path';

export type ProjectFile = { path:string; content:Uint8Array };
export type ProjectAnalysis = {
  detectedRuntime:'NODEJS'|'PYTHON'|null;
  confidence:'HIGH'|'MEDIUM'|'LOW';
  manifests:string[];
  packageManager:string|null;
  suggestedEntrypoint:string|null;
  suggestedStartCommand:string|null;
  reason:string|null;
};

const nodeManifests=['package.json','package-lock.json','npm-shrinkwrap.json','yarn.lock','pnpm-lock.yaml'];
const pythonManifests=['requirements.txt','pyproject.toml','Pipfile','Pipfile.lock','poetry.lock','setup.py','setup.cfg'];
const envBasenames=new Set(['.env','.env.local','.env.development','.env.production','.env.test']);

export function isEnvironmentFile(path:string){
  const name=posix.basename(path);
  return envBasenames.has(name)||/^\.env\.[a-z0-9_-]+$/i.test(name);
}

export function analyzeProject(files:ProjectFile[]):ProjectAnalysis {
  const byPath=new Map(files.map(file=>[file.path.replace(/\\/g,'/').replace(/^\.\//,''),file]));
  const paths=[...byPath.keys()].filter(path=>!path.split('/').some(part=>['node_modules','.git','.venv','venv','__pycache__'].includes(part)));
  const baseNames=new Set(paths.map(path=>posix.basename(path)));
  const nodeFound=nodeManifests.filter(name=>baseNames.has(name));
  const pythonFound=pythonManifests.filter(name=>baseNames.has(name));
  const nodeSources=paths.filter(path=>/\.(?:js|cjs|mjs|ts|tsx|jsx)$/.test(path));
  const pythonSources=paths.filter(path=>/\.py$/.test(path));
  const nodeScore=nodeFound.length*4+Math.min(nodeSources.length,3);
  const pythonScore=pythonFound.length*4+Math.min(pythonSources.length,3);
  const detectedRuntime=nodeScore===pythonScore?null:nodeScore>pythonScore?'NODEJS':'PYTHON';
  const confidence=Math.max(nodeScore,pythonScore)>=5?'HIGH':Math.max(nodeScore,pythonScore)>=2?'MEDIUM':'LOW';
  const manifests=detectedRuntime==='NODEJS'?nodeFound:detectedRuntime==='PYTHON'?pythonFound:[...nodeFound,...pythonFound];
  let packageManager:string|null=null,suggestedEntrypoint:string|null=null,suggestedStartCommand:string|null=null,reason:string|null=null;
  if(detectedRuntime==='NODEJS'){
    packageManager=baseNames.has('pnpm-lock.yaml')?'pnpm':baseNames.has('yarn.lock')?'yarn':baseNames.has('package-lock.json')||baseNames.has('npm-shrinkwrap.json')?'npm':baseNames.has('package.json')?'npm':null;
    const packageFile=paths.find(path=>posix.basename(path)==='package.json');
    if(packageFile)try{
      const pkg=JSON.parse(Buffer.from(byPath.get(packageFile)!.content).toString('utf8'));
      if(typeof pkg?.scripts?.start==='string'&&pkg.scripts.start.trim()){
        suggestedStartCommand='npm start';reason='script "start" do package.json';
        const match=pkg.scripts.start.match(/(?:node|tsx?|bun)\s+([^\s"']+)/);if(match&&byPath.has(posix.join(posix.dirname(packageFile),match[1])))suggestedEntrypoint=posix.join(posix.dirname(packageFile),match[1]);
      }
      if(!suggestedEntrypoint&&typeof pkg?.main==='string'){const candidate=posix.join(posix.dirname(packageFile),pkg.main);if(byPath.has(candidate))suggestedEntrypoint=candidate}
    }catch{}
    if(!suggestedEntrypoint) suggestedEntrypoint=findCandidate(paths,['index.js','main.js','app.js','bot.js','src/index.js','src/main.js','dist/index.js']);
    if(!suggestedStartCommand&&suggestedEntrypoint){suggestedStartCommand=`node ${suggestedEntrypoint}`;reason='arquivo Node.js convencional encontrado'}
  }else if(detectedRuntime==='PYTHON'){
    packageManager=baseNames.has('Pipfile')||baseNames.has('Pipfile.lock')?'pipenv':baseNames.has('poetry.lock')?'poetry':baseNames.has('pyproject.toml')?'pip/pyproject':baseNames.has('requirements.txt')?'pip':null;
    suggestedEntrypoint=findCandidate(paths,['main.py','bot.py','app.py','run.py','src/main.py','src/bot.py']);
    if(!suggestedEntrypoint&&pythonSources.length===1)suggestedEntrypoint=pythonSources[0];
    if(suggestedEntrypoint){suggestedStartCommand=`python ${suggestedEntrypoint}`;reason='arquivo Python inicial provável encontrado'}
  }
  return{detectedRuntime,confidence,manifests,packageManager,suggestedEntrypoint,suggestedStartCommand,reason};
}

function findCandidate(paths:string[],candidates:string[]){
  for(const candidate of candidates){const exact=paths.find(path=>path===candidate||path.endsWith('/'+candidate));if(exact)return exact}
  return null;
}

export function splitCommand(value:string){
  const result:string[]=[];let current='',quote='';
  for(let i=0;i<value.length;i++){const char=value[i];if(quote){if(char===quote)quote='';else if(char==='\\'&&quote==='"'&&i+1<value.length)current+=value[++i];else current+=char}else if(char==='"'||char==="'")quote=char;else if(/\s/.test(char)){if(current){result.push(current);current=''}}else current+=char}
  if(quote)throw new Error('Aspas não fechadas no comando de inicialização');if(current)result.push(current);return result;
}
