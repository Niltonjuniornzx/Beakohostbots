'use client';
import { ChangeEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Archive, File as FileIcon, FilePlus, Folder, FolderPlus, Pencil, Play, RotateCw, Save, Square, Trash2, Upload, X } from 'lucide-react';
import PageShell from '../../components/PageShell';

type BotFile={id:string;path:string;byteSize:number;updatedAt:string;isDirectory:boolean};
type Job={id:string;action:string;status:string;output?:string;error?:string;createdAt:string};
type DependencyInfo={detected:string[];declared:string[];missing:string[];hasPackageJson:boolean};
type BotData={name:string;status:string;entrypoint:string;runtime:{language:string;version:string;variant:string};node:null|{id:string;name:string;status:string;agentVersion:string|null}};

function fileBase64(file:File){
  return new Promise<string>((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');
    reader.onerror=()=>reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function BotDetail(){
  const{id}=useParams<{id:string}>();
  const[bot,setBot]=useState<BotData|null>(null);
  const[files,setFiles]=useState<BotFile[]>([]);
  const[uploading,setUploading]=useState(false);
  const[message,setMessage]=useState('');
  const[jobs,setJobs]=useState<Job[]>([]);
  const[tab,setTab]=useState<'overview'|'files'|'dependencies'|'console'>('overview');
  const[dependencies,setDependencies]=useState<DependencyInfo>({detected:[],declared:[],missing:[],hasPackageJson:false});
  const[selectedPackages,setSelectedPackages]=useState<string[]>([]);
  const[logs,setLogs]=useState('');
  const[currentPath,setCurrentPath]=useState('');
  const[editor,setEditor]=useState<{path:string;content:string}|null>(null);
  const load=()=>Promise.all([
    fetch('/api/bots/'+id).then(r=>r.ok?r.json():null),
    fetch('/api/bots/'+id+'/files').then(r=>r.ok?r.json():[]),
    fetch('/api/bots/'+id+'/jobs').then(r=>r.ok?r.json():[]),
    fetch('/api/bots/'+id+'/dependencies').then(r=>r.ok?r.json():{detected:[],declared:[],missing:[],hasPackageJson:false}),
    fetch('/api/bots/'+id+'/logs').then(r=>r.ok?r.json():{content:''}),
  ]).then(([nextBot,nextFiles,nextJobs,nextDependencies,nextLogs])=>{setBot(nextBot);setFiles(nextFiles);setJobs(nextJobs);setDependencies(nextDependencies);setLogs(nextLogs.content||'');setSelectedPackages(current=>current.length?current:nextDependencies.missing)});
  useEffect(()=>{void load();const timer=setInterval(()=>void load(),3000);return()=>clearInterval(timer)},[id]);

  async function action(name:string){setMessage('');const response=await fetch('/api/bots/'+id+'/actions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:name})});if(!response.ok){const body=await response.json().catch(()=>({}));setMessage(body.message||'Não foi possível executar a ação')}await load()}
  async function installDetected(){setMessage('');const response=await fetch('/api/bots/'+id+'/dependencies/install',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({packages:selectedPackages})});if(!response.ok){const body=await response.json().catch(()=>({}));setMessage(body.message||'Falha ao instalar dependências')}else setMessage('Instalação adicionada à fila.');await load()}

  async function upload(event:ChangeEvent<HTMLInputElement>){
    const selected=Array.from(event.target.files||[]);
    if(!selected.length)return;
    setUploading(true);setMessage('');
    for(const file of selected){
      const path=[currentPath,(file.webkitRelativePath||file.name).replace(/^\/+/, '')].filter(Boolean).join('/');
      const response=await fetch('/api/bots/'+id+'/files',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({path,contentBase64:await fileBase64(file)})});
      if(!response.ok){const body=await response.json().catch(()=>({}));setMessage(body.message||'Falha ao enviar '+path);break}
    }
    event.target.value='';setUploading(false);await load();
  }

  async function remove(path:string){
    if(!confirm('Excluir '+path+'?'))return;
    await fetch('/api/bots/'+id+'/files/delete',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({path})});
    await load();
  }
  const fullPath=(name:string)=>[currentPath,name].filter(Boolean).join('/');
  async function createEntry(type:'FILE'|'DIRECTORY'){const name=prompt(type==='FILE'?'Nome do novo arquivo:':'Nome da nova pasta:');if(!name)return;const response=await fetch('/api/bots/'+id+'/files/create',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({path:fullPath(name),type})});if(!response.ok){const body=await response.json().catch(()=>({}));setMessage(body.message||'Não foi possível criar o item')}await load()}
  async function openFile(path:string){const response=await fetch('/api/bots/'+id+'/files/content?path='+encodeURIComponent(path));const body=await response.json().catch(()=>({}));if(!response.ok){setMessage(body.message||'Este arquivo não pode ser editado');return}setEditor({path,content:body.content});}
  async function saveEditor(){if(!editor)return;const contentBase64=await fileBase64(new File([editor.content],editor.path,{type:'text/plain'}));const response=await fetch('/api/bots/'+id+'/files',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({path:editor.path,contentBase64})});if(response.ok)setMessage('Arquivo salvo e sincronização adicionada à fila.');else{const body=await response.json().catch(()=>({}));setMessage(body.message||'Falha ao salvar arquivo')}await load()}
  async function rename(path:string){const name=prompt('Novo nome ou caminho:',path);if(!name||name===path)return;const response=await fetch('/api/bots/'+id+'/files/rename',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({from:path,to:name})});if(!response.ok){const body=await response.json().catch(()=>({}));setMessage(body.message||'Falha ao renomear')}await load()}
  async function extract(path:string){const destination=prompt('Pasta de destino (vazio = pasta atual):',currentPath)||undefined;const response=await fetch('/api/bots/'+id+'/files/extract',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({path,destination,deleteArchive:false})});const body=await response.json().catch(()=>({}));setMessage(response.ok?String(body.filesExtracted)+' arquivo(s) extraído(s).':body.message||'Falha ao extrair ZIP');await load()}

  if(!bot)return <PageShell><div className="loader"/></PageShell>;
  const runnerOnline=bot.node?.status==='ONLINE';
  const prefix=currentPath?currentPath+'/':'';const entryMap=new Map<string,BotFile>();for(const file of files){if(!file.path.startsWith(prefix)||file.path===currentPath)continue;const relative=file.path.slice(prefix.length);const first=relative.split('/')[0];const path=prefix+first;if(relative.includes('/'))entryMap.set(path,{id:'dir-'+path,path,byteSize:0,updatedAt:file.updatedAt,isDirectory:true});else entryMap.set(path,file)}const visibleFiles=[...entryMap.values()].sort((a,b)=>Number(b.isDirectory)-Number(a.isDirectory)||a.path.localeCompare(b.path));const crumbs=currentPath.split('/').filter(Boolean);
  return <PageShell>
    <header><div><small>BOT</small><h1>{bot.name}</h1><p>{bot.runtime.language==='NODEJS'?'Node.js':'Python'} {bot.runtime.version} · {bot.runtime.variant}</p></div><span className="offline">{bot.status}</span></header>
    <nav className="botTabs">{([['overview','Visão geral'],['files','Arquivos'],['dependencies','Dependências'],['console','Console e logs']] as const).map(item=><button className={tab===item[0]?'active':''} onClick={()=>setTab(item[0])} key={item[0]}>{item[1]}</button>)}</nav>
    {message&&<div className="managerMessage">{message}</div>}
    {tab==='overview'&&<><div className="botActions"><button disabled={!runnerOnline} onClick={()=>action('START')}><Play/>Iniciar</button><button disabled={!runnerOnline} onClick={()=>action('STOP')}><Square/>Parar</button><button disabled={!runnerOnline} onClick={()=>action('RESTART')}><RotateCw/>Reiniciar</button></div><div className="detailGrid"><article><small>ARQUIVO INICIAL</small><b>{bot.entrypoint}</b></article><article><small>SERVIDOR</small><b>{bot.node?.name||'Aguardando Runner'}</b></article><article><small>RUNNER</small><b>{runnerOnline?'Online · '+(bot.node?.agentVersion||''):'Offline'}</b></article></div>{!runnerOnline&&<div className="runnerWarning"><b>Este bot ainda não possui um Runner online.</b><p>Quando a VPS enviar o próximo heartbeat, ele será atribuído automaticamente.</p></div>}</>}
    {tab==='files'&&<section className="fileManager"><div className="fileToolbar"><div><button onClick={()=>createEntry('FILE')}><FilePlus/>Novo arquivo</button><button onClick={()=>createEntry('DIRECTORY')}><FolderPlus/>Nova pasta</button></div><label className="primaryButton"><Upload/>{uploading?'Enviando...':'Upload'}<input type="file" multiple onChange={upload} disabled={uploading}/></label></div><div className="breadcrumbs"><button onClick={()=>setCurrentPath('')}>raiz</button>{crumbs.map((crumb,index)=><span key={index}>/ <button onClick={()=>setCurrentPath(crumbs.slice(0,index+1).join('/'))}>{crumb}</button></span>)}</div>{visibleFiles.length===0?<div className="emptyFiles"><Folder/><p>Esta pasta está vazia.</p></div>:<div className="fileList">{visibleFiles.map(item=><div className="fileRow" key={item.path} onDoubleClick={()=>item.isDirectory?setCurrentPath(item.path):openFile(item.path)}>{item.isDirectory?<Folder/>:<FileIcon/>}<div onClick={()=>item.isDirectory?setCurrentPath(item.path):openFile(item.path)}><b>{item.path.split('/').pop()}</b><small>{item.isDirectory?'Pasta':(item.byteSize/1024).toFixed(1)+' KB'}</small></div>{!item.isDirectory&&item.path.toLowerCase().endsWith('.zip')&&<button onClick={()=>extract(item.path)} title="Extrair ZIP"><Archive/></button>} {!item.isDirectory&&<button onClick={()=>openFile(item.path)} title="Editar"><Pencil/></button>}<button onClick={()=>rename(item.path)} title="Renomear"><Pencil/></button><button onClick={()=>remove(item.path)} title="Excluir"><Trash2/></button></div>)}</div>}{editor&&<div className="codeEditor"><header><b>{editor.path}</b><div><button onClick={saveEditor}><Save/>Salvar</button><button onClick={()=>setEditor(null)}><X/></button></div></header><textarea spellCheck={false} value={editor.content} onChange={event=>setEditor({...editor,content:event.target.value})}/></div>}</section>}
    {tab==='dependencies'&&<section className="dependencyManager"><header><div><h3>Dependências detectadas</h3><p>Leitura automática dos imports e require() presentes nos arquivos JavaScript.</p></div><button disabled={!runnerOnline||selectedPackages.length===0} onClick={installDetected}>Adicionar e instalar selecionadas</button></header>{dependencies.detected.length===0?<div className="emptyFiles"><p>Nenhum pacote externo encontrado no código.</p></div>:<div className="dependencyList">{dependencies.detected.map(name=><label key={name}><input type="checkbox" checked={selectedPackages.includes(name)} disabled={dependencies.declared.includes(name)} onChange={event=>setSelectedPackages(current=>event.target.checked?[...current,name]:current.filter(item=>item!==name))}/><div><b>{name}</b><small>{dependencies.declared.includes(name)?'Já declarado no package.json':'Detectado no código · ainda não instalado'}</small></div></label>)}</div>}<footer><span>{dependencies.hasPackageJson?'package.json encontrado':'O package.json será criado automaticamente'}</span><button disabled={!runnerOnline} onClick={()=>action('INSTALL')}>Reinstalar package.json atual</button></footer></section>}
    {tab==='console'&&<><section className="liveConsole"><header><div><h3>Logs do container</h3><span>Atualizados automaticamente</span></div></header><pre>{logs||'O container ainda não produziu logs.'}</pre></section><section className="consolePanel"><div><h3>Histórico de tarefas</h3><span>Últimas 20 operações</span></div>{jobs.length===0?<p>Nenhuma tarefa executada.</p>:jobs.map(job=><article key={job.id}><header><b>{job.action}</b><span className={job.status==='SUCCEEDED'?'online':job.status==='FAILED'?'offline':''}>{job.status}</span></header>{job.output&&<pre>{job.output}</pre>}{job.error&&<pre className="jobError">{job.error}</pre>}</article>)}</section></>}
  </PageShell>;
}
