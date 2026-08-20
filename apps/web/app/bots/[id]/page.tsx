'use client';
import { ChangeEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { File as FileIcon, Play, RotateCw, Square, Trash2, Upload } from 'lucide-react';
import PageShell from '../../components/PageShell';

type BotFile={id:string;path:string;byteSize:number;updatedAt:string};
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
  const load=()=>Promise.all([
    fetch('/api/bots/'+id).then(r=>r.ok?r.json():null),
    fetch('/api/bots/'+id+'/files').then(r=>r.ok?r.json():[]),
  ]).then(([nextBot,nextFiles])=>{setBot(nextBot);setFiles(nextFiles)});
  useEffect(()=>{void load()},[id]);

  async function upload(event:ChangeEvent<HTMLInputElement>){
    const selected=Array.from(event.target.files||[]);
    if(!selected.length)return;
    setUploading(true);setMessage('');
    for(const file of selected){
      const path=(file.webkitRelativePath||file.name).replace(/^\/+/,'');
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

  if(!bot)return <PageShell><div className="loader"/></PageShell>;
  const runnerOnline=bot.node?.status==='ONLINE';
  return <PageShell>
    <header><div><small>BOT</small><h1>{bot.name}</h1><p>{bot.runtime.language==='NODEJS'?'Node.js':'Python'} {bot.runtime.version} · {bot.runtime.variant}</p></div><span className="offline">{bot.status}</span></header>
    <div className="botActions">
      <button disabled={!runnerOnline}><Play/>Iniciar</button>
      <button disabled={!runnerOnline}><Square/>Parar</button>
      <button disabled={!runnerOnline}><RotateCw/>Reiniciar</button>
    </div>
    <div className="detailGrid">
      <article><small>ARQUIVO INICIAL</small><b>{bot.entrypoint}</b></article>
      <article><small>SERVIDOR</small><b>{bot.node?.name||'Não atribuído'}</b></article>
      <article><small>RUNNER</small><b>{runnerOnline?'Online · '+(bot.node?.agentVersion||''):'Offline'}</b></article>
    </div>
    <section className="fileManager">
      <div className="fileHeader"><div><h3>Arquivos do bot</h3><p>Envie o código, package.json, requirements.txt e demais arquivos.</p></div>
        <label className="primaryButton"><Upload/>{uploading?'Enviando...':'Enviar arquivos'}<input type="file" multiple onChange={upload} disabled={uploading}/></label>
      </div>
      {message&&<div className="authError">{message}</div>}
      {files.length===0?<div className="emptyFiles"><FileIcon/><p>Nenhum arquivo enviado.</p></div>:<div className="fileList">{files.map(item=><div className="fileRow" key={item.id}><FileIcon/><div><b>{item.path}</b><small>{(item.byteSize/1024).toFixed(1)} KB</small></div><button onClick={()=>remove(item.path)} title="Excluir"><Trash2/></button></div>)}</div>}
    </section>
    <div className="notice"><h3>Dependências e módulos</h3><p>{bot.runtime.language==='NODEJS'?'Envie package.json e package-lock.json para instalar com npm ci.':'Envie requirements.txt ou pyproject.toml para instalar com pip.'}</p><button disabled={!runnerOnline}>Instalar dependências</button><p>O envio ao container e os controles de execução serão liberados na próxima atualização do Runner.</p></div>
  </PageShell>;
}
