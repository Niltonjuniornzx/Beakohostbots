'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bot, Plus } from 'lucide-react';
import PageShell from '../components/PageShell';

type Item={id:string;name:string;status:string;entrypoint:string;runtime:{language:string;version:string;variant:string}};
const label=(status:string)=>({RUNNING:'Online',CRASHED:'Com falha',STARTING:'Iniciando',STOPPING:'Parando',STOPPED:'Parado'}[status]??status);
export default function BotsPage(){const[bots,setBots]=useState<Item[]>([]);const[loading,setLoading]=useState(true);useEffect(()=>{fetch('/api/bots').then(r=>r.ok?r.json():[]).then(setBots).finally(()=>setLoading(false))},[]);return <PageShell><header><div><small>APLICAÇÕES</small><h1>Meus bots</h1><p>Gerencie os bots cadastrados na sua conta.</p></div><Link className="primaryButton" href="/bots/new"><Plus/>Novo bot</Link></header>{loading?<div className="loader"/>:bots.length===0?<div className="emptyState"><Bot/><h3>Nenhum bot cadastrado</h3><p>Crie um bot para preparar seus arquivos e runtime.</p><Link className="primaryButton" href="/bots/new"><Plus/>Criar bot</Link></div>:<div className="listPanel">{bots.map(bot=><Link className="listRow" href={`/bots/${bot.id}`} key={bot.id}><div className="botIcon"><Bot/></div><div><b>{bot.name}</b><small>{bot.runtime.language==='NODEJS'?'Node.js':'Python'} {bot.runtime.version} · {bot.entrypoint}</small></div><span className={bot.status==='RUNNING'?'online':bot.status==='CRASHED'?'failed':'offline'}>{label(bot.status)}</span></Link>)}</div>}</PageShell>}
