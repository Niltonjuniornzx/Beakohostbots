'use client';
import {ChangeEvent,useEffect,useMemo,useRef,useState} from'react';
import{useParams}from'next/navigation';
import{Archive,Box,ChevronRight,CircleGauge,Code2,Download,File as FileIcon,FilePlus,Folder,FolderPlus,HardDrive,Package,Pencil,Play,RotateCw,Save,Search,Settings,Square,Terminal,Trash2,TriangleAlert,Upload,X}from'lucide-react';
import PageShell from'../../components/PageShell';
type BotFile={id:string;path:string;byteSize:number;updatedAt:string;isDirectory:boolean};type Job={id:string;action:string;status:string;output?:string;error?:string;createdAt:string};type Dep={detected:string[];declared:string[];missing:string[];hasPackageJson:boolean};type Limits={cpuMillicores:number;memoryMb:number;diskMb:number};type BotData={name:string;status:string;entrypoint:string;cpuUsagePercent:number;memoryUsageMb:number;diskUsageMb:number;lastMetricsAt:string|null;effectiveLimits:Limits;planLimits:Limits;runtime:{language:string;version:string;variant:string};node:null|{id:string;name:string;status:string;agentVersion:string|null}};type View='console'|'files'|'dependencies'|'startup'|'settings';
const b64=(file:File)=>new Promise<string>((ok,fail)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(',')[1]||'');r.onerror=()=>fail(r.error);r.readAsDataURL(file)});
const bytes=(n:number)=>n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(1)+' MB';const date=(v:string)=>new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(v));
export default function BotDetail(){const{id}=useParams<{id:string}>();const[bot,setBot]=useState<BotData|null>(null),[files,setFiles]=useState<BotFile[]>([]),[jobs,setJobs]=useState<Job[]>([]),[logs,setLogs]=useState(''),[view,setView]=useState<View>('console'),[path,setPath]=useState(''),[search,setSearch]=useState(''),[editor,setEditor]=useState<{path:string;content:string}|null>(null),[dep,setDep]=useState<Dep>({detected:[],declared:[],missing:[],hasPackageJson:false}),[selected,setSelected]=useState<string[]>([]),[uploading,setUploading]=useState(false),[message,setMessage]=useState('');const input=useRef<HTMLInputElement>(null);
const[adminNodes,setAdminNodes]=useState<any[]>([]),[busy,setBusy]=useState(''),[limits,setLimits]=useState<Limits>({cpuMillicores:250,memoryMb:256,diskMb:1024});
const load=()=>Promise.all([fetch('/api/bots/'+id).then(r=>r.ok?r.json():null),fetch('/api/bots/'+id+'/files').then(r=>r.ok?r.json():[]),fetch('/api/bots/'+id+'/jobs').then(r=>r.ok?r.json():[]),fetch('/api/bots/'+id+'/dependencies').then(r=>r.ok?r.json():{detected:[],declared:[],missing:[],hasPackageJson:false}),fetch('/api/bots/'+id+'/logs').then(r=>r.ok?r.json():{content:''})]).then(([b,f,j,d,l])=>{setBot(b);setFiles(f);setJobs(j);setDep(d);setLogs(l.content||'');setSelected(s=>s.length?s:d.missing)});
useEffect(()=>{void load();const timer=setInterval(()=>void load(),3000);return()=>clearInterval(timer)},[id]);
useEffect(()=>{fetch('/api/admin/nodes').then(r=>r.ok?r.json():[]).then(setAdminNodes).catch(()=>setAdminNodes([]))},[]);
useEffect(()=>{if(bot?.effectiveLimits)setLimits(bot.effectiveLimits)},[bot?.effectiveLimits.cpuMillicores,bot?.effectiveLimits.memoryMb,bot?.effectiveLimits.diskMb]);
useEffect(()=>{if(!message)return;const timer=setTimeout(()=>setMessage(''),5000);return()=>clearTimeout(timer)},[message]);
async function api(route:string,options?:RequestInit){const r=await fetch('/api/bots/'+id+route,options),body=await r.json().catch(()=>({}));if(!r.ok)throw Error(Array.isArray(body.message)?body.message.join(', '):body.message||'Operação não concluída');return body}const json=(body:unknown)=>({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
async function run(action:string){setMessage('');setBusy(action);try{await api('/actions',json({action}));setMessage(action==='STOP'?'Comando de parada enviado.':'Comando enviado ao Runner. Acompanhe o andamento nas tarefas.')}catch(e){setMessage((e as Error).message)}finally{setBusy('')}await load()}async function install(){setBusy('INSTALL');try{await api('/dependencies/install',json({packages:selected}));setMessage('Instalação adicionada à fila.')}catch(e){setMessage((e as Error).message)}finally{setBusy('')}await load()}
async function deploy(){setBusy('DEPLOY');try{await api('/deploy',{method:'POST'});setMessage('Deploy automático: sincronizando, instalando dependências e iniciando o bot.')}catch(e){setMessage((e as Error).message)}finally{setBusy('')}}
async function saveLimits(){setBusy('LIMITS');try{const result=await api('/limits',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(limits)});setLimits(result.effectiveLimits);setMessage('Limites salvos. Reinicie o bot para aplicar CPU e memória ao container.')}catch(e){setMessage((e as Error).message)}finally{setBusy('')}}
async function deleteBot(){if(!confirm('Excluir este bot, o container e todos os arquivos permanentemente?'))return;if(!confirm('Esta ação não pode ser desfeita. Deseja continuar?'))return;try{const result=await api('',{method:'DELETE'});if(result.queued){setMessage('Exclusão enviada ao Runner. O bot desaparecerá após a limpeza.');setTimeout(()=>window.location.href='/bots',1800)}else window.location.href='/bots'}catch(e){setMessage((e as Error).message)}}
async function migrate(nodeId:string){if(!nodeId||nodeId===bot?.node?.id)return;if(bot?.status!=='STOPPED'){setMessage('Pare o bot antes de migrar para outro servidor.');return}const response=await fetch('/api/admin/bots/'+id+'/node',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({nodeId})});const body=await response.json().catch(()=>({}));if(!response.ok){setMessage(body.message||'Não foi possível migrar o bot');return}setMessage('Bot migrado. O próximo deploy será executado no novo Runner.');await load()}
async function upload(e:ChangeEvent<HTMLInputElement>){const list=Array.from(e.target.files||[]);if(!list.length)return;setUploading(true);try{for(const f of list)await api('/files',json({path:[path,f.name].filter(Boolean).join('/'),contentBase64:await b64(f)}));await deploy()}catch(x){setMessage((x as Error).message)}e.target.value='';setUploading(false);await load()}
async function create(type:'FILE'|'DIRECTORY'){const name=prompt(type==='FILE'?'Nome do arquivo:':'Nome da pasta:');if(!name)return;try{await api('/files/create',json({path:[path,name].filter(Boolean).join('/'),type}));if(type==='FILE')await open([path,name].filter(Boolean).join('/'))}catch(e){setMessage((e as Error).message)}await load()}async function open(file:string){try{const x=await api('/files/content?path='+encodeURIComponent(file));setEditor({path:file,content:x.content})}catch(e){setMessage((e as Error).message)}}async function save(){if(!editor)return;try{await api('/files',json({path:editor.path,contentBase64:await b64(new File([editor.content],editor.path))}));setMessage('Arquivo salvo e sincronização adicionada à fila.')}catch(e){setMessage((e as Error).message)}await load()}async function rename(file:string){const to=prompt('Novo nome ou caminho:',file);if(!to||to===file)return;try{await api('/files/rename',json({from:file,to}));setMessage('Item renomeado.')}catch(e){setMessage((e as Error).message)}await load()}async function remove(file:string){if(!confirm('Excluir “'+file+'” permanentemente?'))return;try{await api('/files/delete',json({path:file}));setMessage('Item excluído.')}catch(e){setMessage((e as Error).message)}await load()}async function extract(file:string){const destination=prompt('Pasta de destino (vazio = pasta atual):',path)||undefined;try{const x=await api('/files/extract',json({path:file,destination,deleteArchive:false}));setMessage(x.filesExtracted+' arquivo(s) extraído(s).')}catch(e){setMessage((e as Error).message)}await load()}async function download(file:string){try{const x=await api('/files/download?path='+encodeURIComponent(file)),data=Uint8Array.from(atob(x.contentBase64),(c)=>c.charCodeAt(0)),url=URL.createObjectURL(new Blob([data]));const a=document.createElement('a');a.href=url;a.download=file.split('/').pop()||'arquivo';a.click();URL.revokeObjectURL(url)}catch(e){setMessage((e as Error).message)}}
const visible=useMemo(()=>{const prefix=path?path+'/':'',map=new Map<string,BotFile>();for(const f of files){if(!f.path.startsWith(prefix)||f.path===path)continue;const rel=f.path.slice(prefix.length),first=rel.split('/')[0],p=prefix+first;map.set(p,rel.includes('/')?{id:'dir-'+p,path:p,byteSize:0,updatedAt:f.updatedAt,isDirectory:true}:f)}return[...map.values()].filter(f=>f.path.split('/').pop()?.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>Number(b.isDirectory)-Number(a.isDirectory)||a.path.localeCompare(b.path))},[files,path,search]);if(!bot)return <PageShell>
<div className="loader"/>
</PageShell>;const online=bot.node?.status==='ONLINE',crumbs=path.split('/').filter(Boolean),used=files.reduce((n,f)=>n+f.byteSize,0),runtime=bot.runtime.language==='NODEJS'?'Node.js':'Python',entrypointExists=files.some(file=>!file.isDirectory&&file.path===bot.entrypoint),latestFailure=jobs.find(job=>job.status==='FAILED');const nav:[View,string,React.ReactNode][]=[['console','Console',<Terminal key="c"/>],['files','Arquivos',<Folder key="f"/>],['dependencies','Dependências',<Package key="d"/>],['startup','Inicialização',<Code2 key="s"/>],['settings','Configurações',<Settings key="x"/>]];
return <PageShell>
<div className="serverWorkspace">
<div className="serverTop">
<div>
<span className="serverEyebrow">SERVIDOR / {bot.node?.name||'SEM RUNNER'}</span>
<h1>{bot.name}</h1>
<p>{runtime} {bot.runtime.version} · {bot.runtime.variant}</p>
</div>
<div className="serverState">
<i className={bot.status==='RUNNING'?'on':''}/>
<div>
<small>STATUS</small>
<b>{bot.status}</b>
</div>
</div>
</div>
{(!entrypointExists||bot.status==='CRASHED')&&<div className="deployAlert">
<TriangleAlert/>
<div><b>{!entrypointExists?`Arquivo inicial “${bot.entrypoint}” não encontrado`:'O bot encerrou com uma falha'}</b><span>{!entrypointExists?'Envie o arquivo correto antes de iniciar. O Runner agora bloqueará o deploy inválido.':latestFailure?.error||'Abra os logs e a atividade do Runner para identificar a causa.'}</span></div>
{!entrypointExists&&<button onClick={()=>setView('files')}>Abrir arquivos</button>}
</div>}
<div className="serverMetrics">
<article>
<CircleGauge/>
<div>
<small>CPU</small>
<b>{bot.cpuUsagePercent.toFixed(1)}% / {(bot.effectiveLimits.cpuMillicores/10).toFixed(0)}%</b>
<span>
<i style={{width:Math.min(100,bot.cpuUsagePercent/(bot.effectiveLimits.cpuMillicores/10)*100)+'%'}}/>
</span>
</div>
</article>
<article>
<Box/>
<div>
<small>MEMÓRIA</small>
<b>{bot.memoryUsageMb} MB / {bot.effectiveLimits.memoryMb} MB</b>
<span>
<i style={{width:Math.min(100,bot.memoryUsageMb/bot.effectiveLimits.memoryMb*100)+'%'}}/>
</span>
</div>
</article>
<article>
<HardDrive/>
<div>
<small>ARMAZENAMENTO</small>
<b>{bot.diskUsageMb||Math.ceil(used/1048576)} MB / {bot.effectiveLimits.diskMb} MB</b>
<span>
<i style={{width:Math.min(100,(bot.diskUsageMb||used/1048576)/bot.effectiveLimits.diskMb*100)+'%'}}/>
</span>
</div>
</article>
</div>
<div className="serverLayout">
<aside className="serverNav">
<small>GERENCIAMENTO</small>{nav.map(([key,label,icon])=>
<button key={key} className={view===key?'active':''} onClick={()=>{setView(key);setEditor(null)}}>{icon}<span>{label}</span>
<ChevronRight/>
</button>)}<div className="serverInfo">
<span className={online?'onlineDot':'offlineDot'}/>
<div>
<small>RUNNER</small>
<b>{online?'Conectado':'Offline'}</b>
<em>{bot.node?.agentVersion||'Nenhuma versão'}</em>
</div>
</div>
</aside>
<section className="serverMain">{message&&<div className="managerMessage">{message}<button onClick={()=>setMessage('')}>
<X/>
</button>
</div>}
{view==='console'&&<>
<div className="consoleActions">
<div>
<h2>Console</h2>
<p>Controles e saída do bot em tempo real.</p>
</div>
<div>
<button className="start" disabled={!online||!!busy} onClick={()=>run('START')}>
<Play/>{busy==='START'?'Enviando...':'Iniciar'}</button>
<button disabled={!online||!!busy} onClick={()=>run('RESTART')}>
<RotateCw className={busy==='RESTART'?'spin':''}/>{busy==='RESTART'?'Enviando...':'Reiniciar'}</button>
<button className="danger" disabled={!online||!!busy} onClick={()=>run('STOP')}>
<Square/>{busy==='STOP'?'Enviando...':'Parar'}</button>
</div>
</div>
<details className="logTerminal">
<summary>
<Terminal/> Logs do container <span>{logs?'saída disponível · clique para abrir':'aguardando saída'}</span>
</summary>
<section className="terminalWindow">
<header>
<span/>
<span/>
<span/>
<b>container@{bot.name.toLowerCase().replace(/\s+/g,'-')}</b>
<em>atualização automática</em>
</header>
<pre>{logs||'Aguardando a primeira saída do container...'}</pre>
</section>
</details>
<details className="taskDrawer">
<summary>
<Terminal/> Atividade do Runner <span>{jobs.length} operação(ões) · clique para abrir</span>
</summary>
<section className="taskTerminal">
<header>
<div>
<span/>
<span/>
<span/>
<b>runner@tarefas</b>
</div>
<em>últimas operações</em>
</header>{jobs.length===0?<pre>Nenhuma operação executada.</pre>:jobs.slice(0,12).map((j,index)=>
<details key={j.id} open={index===0}>
<summary>
<span className="taskPrompt">$</span>
<b>{j.action.toLowerCase()}</b>
<time>{date(j.createdAt)}</time>
<em className={j.status==='SUCCEEDED'?'success':j.status==='FAILED'?'failed':''}>{j.status}</em>
</summary>
<pre className={j.error?'jobError':''}>{j.error||j.output||'Operação sem saída.'}</pre>
</details>)}</section>
</details>
</>}
{view==='files'&&<section className="fileManagerPro">{editor?<>
<div className="editorHeader">
<div>
<button onClick={()=>setEditor(null)}>
<X/>
</button>
<div>
<small>EDITANDO</small>
<b>{editor.path}</b>
</div>
</div>
<button onClick={save}>
<Save/>Salvar alterações</button>
</div>
<textarea spellCheck={false} value={editor.content} onChange={e=>setEditor({...editor,content:e.target.value})}/>
</>:<>
<div className="managerHeader">
<div>
<h2>Gerenciador de arquivos</h2>
<p>Conteúdo persistente do bot em /home/container.</p>
</div>
<div>
<button onClick={()=>create('DIRECTORY')}>
<FolderPlus/>Nova pasta</button>
<button onClick={()=>create('FILE')}>
<FilePlus/>Novo arquivo</button>
<button className="primary" onClick={()=>input.current?.click()}>
<Upload/>{uploading?'Enviando...':'Upload'}</button>
<input ref={input} type="file" multiple onChange={upload} disabled={uploading}/>
</div>
</div>
<div className="filePathBar">
<div>
<button onClick={()=>setPath('')}>/home/container</button>{crumbs.map((c,i)=>
<span key={i}>/<button onClick={()=>setPath(crumbs.slice(0,i+1).join('/'))}>{c}</button>
</span>)}</div>
<label>
<Search/>
<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar nesta pasta"/>
</label>
</div>
<div className="fileTable">
<div className="fileTableHead">
<span>NOME</span>
<span>TAMANHO</span>
<span>MODIFICADO</span>
<span>AÇÕES</span>
</div>{visible.length===0?<div className="fileEmpty">
<Folder/>
<h3>Pasta vazia</h3>
<p>Envie arquivos ou crie um novo arquivo.</p>
</div>:visible.map(f=>
<div className="fileTableRow" key={f.path}>
<button className="fileName" onClick={()=>f.isDirectory?setPath(f.path):open(f.path)}>{f.isDirectory?<Folder/>:<FileIcon/>}<b>{f.path.split('/').pop()}</b>
</button>
<span>{f.isDirectory?'—':bytes(f.byteSize)}</span>
<span>{date(f.updatedAt)}</span>
<div className="fileActions">{!f.isDirectory&&<button title="Download" onClick={()=>download(f.path)}>
<Download/>
</button>}{!f.isDirectory&&f.path.toLowerCase().endsWith('.zip')&&<button title="Extrair ZIP" onClick={()=>extract(f.path)}>
<Archive/>
</button>}<button title="Renomear" onClick={()=>rename(f.path)}>
<Pencil/>
</button>
<button className="delete" title="Excluir" onClick={()=>remove(f.path)}>
<Trash2/>
</button>
</div>
</div>)}</div>
</>}</section>}
{view==='dependencies'&&<section className="dependencyManager">
<header>
<div>
<h2>Dependências e módulos</h2>
<p>Imports e require() detectados automaticamente.</p>
</div>
<button disabled={!online||!selected.length} onClick={install}>Instalar selecionadas</button>
</header>{!dep.detected.length?<div className="emptyFiles">
<Package/>
<h3>Nenhuma dependência externa</h3>
<p>Faça upload do código para iniciar a análise.</p>
</div>:<div className="dependencyList">{dep.detected.map(name=>
<label key={name}>
<input type="checkbox" checked={selected.includes(name)} disabled={dep.declared.includes(name)} onChange={e=>setSelected(s=>e.target.checked?[...s,name]:s.filter(x=>x!==name))}/>
<div>
<b>{name}</b>
<small>{dep.declared.includes(name)?'Declarado no package.json':'Detectado no código · pendente'}</small>
</div>
<span className={dep.declared.includes(name)?'installed':'pending'}>{dep.declared.includes(name)?'INSTALADO':'PENDENTE'}</span>
</label>)}</div>}<footer>
<span>{dep.hasPackageJson?'package.json encontrado':'O package.json será gerado automaticamente'}</span>
<button disabled={!online} onClick={()=>run('INSTALL')}>Reinstalar tudo</button>
</footer>
</section>}
{view==='startup'&&<section className="settingsCards">
<header>
<h2>Inicialização</h2>
<p>Configuração usada pelo container ao iniciar.</p>
</header>
<article>
<label>IMAGEM DO RUNTIME</label>
<div>
<b>{bot.runtime.language.toLowerCase()}:{bot.runtime.version}-{bot.runtime.variant.toLowerCase()}</b>
<span>Gerenciada pelo administrador</span>
</div>
</article>
<article>
<label>ARQUIVO INICIAL</label>
<div>
<b>{bot.entrypoint}</b>
<span>Comando: {bot.runtime.language==='NODEJS'?'node':'python'} {bot.entrypoint}</span>
</div>
</article>
<article>
<label>DEPENDÊNCIAS</label>
<div>
<b>{bot.runtime.language==='NODEJS'?'package.json':'requirements.txt'}</b>
<button disabled={!online} onClick={()=>run('INSTALL')}>Executar instalação</button>
</div>
</article>
</section>}
{view==='settings'&&<section className="settingsCards">
<header>
<h2>Configurações</h2>
<p>Recursos, localização e operações deste bot.</p>
</header>
<article>
<label>NOME DO SERVIDOR</label>
<div>
<b>{bot.name}</b>
<span>Identificador: {id}</span>
</div>
</article>
<article className="limitEditor">
<label>LIMITES DO CONTAINER</label>
<div>
<label>
<span>CPU <b>{Math.round(limits.cpuMillicores/bot.planLimits.cpuMillicores*100)}%</b>
</span>
<input type="range" min="1" max="100" value={Math.round(limits.cpuMillicores/bot.planLimits.cpuMillicores*100)} onChange={e=>setLimits({...limits,cpuMillicores:Math.max(25,Math.round(bot.planLimits.cpuMillicores*Number(e.target.value)/100))})}/>
<small>{limits.cpuMillicores} millicores de {bot.planLimits.cpuMillicores}</small>
</label>
<label>
<span>Memória RAM <b>{Math.round(limits.memoryMb/bot.planLimits.memoryMb*100)}%</b>
</span>
<input type="range" min="1" max="100" value={Math.round(limits.memoryMb/bot.planLimits.memoryMb*100)} onChange={e=>setLimits({...limits,memoryMb:Math.max(32,Math.round(bot.planLimits.memoryMb*Number(e.target.value)/100))})}/>
<small>{limits.memoryMb} MB de {bot.planLimits.memoryMb} MB</small>
</label>
<label>
<span>Disco <b>{Math.round(limits.diskMb/bot.planLimits.diskMb*100)}%</b>
</span>
<input type="range" min="1" max="100" value={Math.round(limits.diskMb/bot.planLimits.diskMb*100)} onChange={e=>setLimits({...limits,diskMb:Math.max(64,Math.round(bot.planLimits.diskMb*Number(e.target.value)/100))})}/>
<small>{limits.diskMb} MB de {bot.planLimits.diskMb} MB</small>
</label>
<button disabled={busy==='LIMITS'} onClick={saveLimits}>{busy==='LIMITS'?'Salvando...':'Salvar limites'}</button>
</div>
</article>
<article>
<label>LOCALIZAÇÃO</label>
<div>
<b>{bot.node?.name||'Não atribuído'}</b>
<span>{online?'Runner saudável e conectado':'Aguardando Runner'}</span>
</div>
</article>{adminNodes.length>0&&<article className="migrationRow">
<label>MIGRAR RUNNER</label>
<div>
<select value={bot.node?.id||''} disabled={bot.status!=='STOPPED'} onChange={e=>migrate(e.target.value)}>
<option value="">Selecione o destino</option>{adminNodes.filter(node=>node.status==='ONLINE').map(node=>
<option value={node.id} key={node.id}>{node.name} · {node.totalCpuMillicores/1000} vCPU · {node._count.bots} bots</option>)}</select>
<span>{bot.status==='STOPPED'?'Apenas servidores compatíveis aceitarão a migração.':'Pare o bot para trocar de servidor.'}</span>
</div>
</article>}<article className="dangerZone">
<label>CONTROLE</label>
<div>
<b>Parar aplicação</b>
<button disabled={!online} onClick={()=>run('STOP')}>Parar agora</button>
</div>
</article>
<article className="dangerZone">
<label>EXCLUSÃO PERMANENTE</label>
<div>
<span>Remove o container, arquivos, logs e configurações.</span>
<button onClick={deleteBot}>
<Trash2/>Excluir bot</button>
</div>
</article>
</section>}</section>
</div>
</div>
</PageShell>}
