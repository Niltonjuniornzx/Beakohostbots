'use client';
import{useEffect,useState}from'react';
import Link from'next/link';
import PageShell from'../components/PageShell';
import{Bot,HardDrive}from'lucide-react';
export default function Files(){const[bots,setBots]=useState<any[]>([]);useEffect(()=>{fetch('/api/bots').then(r=>r.ok?r.json():[]).then(setBots)},[]);return <PageShell><header><div><small>ARQUIVOS</small><h1>Gerenciador de arquivos</h1><p>Escolha um bot para enviar e organizar seu código.</p></div></header>{bots.length===0?<div className="emptyState"><HardDrive/><h3>Nenhum bot cadastrado</h3><p>Crie um bot antes de enviar arquivos.</p></div>:<div className="listPanel">{bots.map(bot=><Link className="listRow" href={'/bots/'+bot.id} key={bot.id}><div className="botIcon"><Bot/></div><div><b>{bot.name}</b><small>{bot.runtime.language==='NODEJS'?'Node.js':'Python'} {bot.runtime.version} · abrir arquivos</small></div></Link>)}</div>}</PageShell>}
