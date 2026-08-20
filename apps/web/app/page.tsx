'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Activity, Bot, Cpu, HardDrive, LogOut, MemoryStick, Plus, Server, Settings, ShieldCheck } from 'lucide-react';

type BotItem = { id: string; name: string; status: string; runtime: { language: string; version: string; variant: string }; node: null | { name: string; status: string } };

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ displayName: string; role: string } | null>(null);
  const [bots, setBots] = useState<BotItem[]>([]);
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' }).then(async (response) => {
      if (!response.ok) return router.replace('/login');
      setUser(await response.json());
      const botsResponse = await fetch('/api/bots', { credentials: 'include' });
      if (botsResponse.ok) setBots(await botsResponse.json());
    }).catch(() => router.replace('/login'));
  }, [router]);
  async function logout() { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); router.replace('/login'); }
  if (!user) return <main className="loading"><div className="loader"/><p>Carregando painel...</p></main>;
  return <main className="shell">
    <aside>
      <div className="brand"><div className="logo"><Bot size={23}/></div><div><b>BeakoHost</b><small>Bot Cloud</small></div></div>
      <nav><Link className="active" href="/"><Activity/>Visão geral</Link><Link href="/bots"><Bot/>Meus bots</Link><Link href="/files"><HardDrive/>Arquivos</Link><Link href="/security"><ShieldCheck/>Segurança</Link>{user.role==='ADMIN'&&<Link href="/admin"><Settings/>Administração</Link>}</nav>
      <div className="account"><span>{user.displayName.slice(0, 2).toUpperCase()}</span><div><b>{user.displayName}</b><small>{user.role === 'ADMIN' ? 'Administrador' : 'Usuário'}</small></div><button className="logout" onClick={logout} title="Sair"><LogOut/></button></div>
    </aside>
    <section className="content">
      <header><div><small>PAINEL DE CONTROLE</small><h1>Olá, {user.displayName.split(' ')[0]}</h1><p>Seus bots e servidores em um só lugar.</p></div><Link className="primaryButton" href="/bots/new"><Plus/>Novo bot</Link></header>
      <div className="stats">
        <article><div className="icon purple"><Bot/></div><div><small>BOTS CADASTRADOS</small><strong>{bots.length} <em>/ 5</em></strong></div></article>
        <article><div className="icon blue"><Cpu/></div><div><small>BOTS EXECUTANDO</small><strong>{bots.filter(bot => bot.status === 'RUNNING').length}</strong></div></article>
        <article><div className="icon green"><MemoryStick/></div><div><small>MEMÓRIA EM USO</small><strong>0 MB</strong></div></article>
        <article><div className="icon orange"><Server/></div><div><small>NÓS ONLINE</small><strong>{new Set(bots.filter(bot => bot.node?.status === 'ONLINE').map(bot => bot.node?.name)).size}</strong></div></article>
      </div>
      <div className="panelTitle"><div><h2>Seus bots</h2><p>Dados cadastrados na sua conta.</p></div><Link href="/bots">Ver todos →</Link></div>
      {bots.length === 0 ? <div className="emptyState"><Bot/><h3>Nenhum bot criado</h3><p>Crie seu primeiro bot para começar.</p><Link className="primaryButton" href="/bots/new"><Plus/>Novo bot</Link></div> : <div className="botGrid">{bots.slice(0, 4).map((bot) => <article className="botCard" key={bot.id}>
        <div className="botTop"><div className="botIcon"><Bot/></div><div><h3>{bot.name}</h3><p>{bot.runtime.language === 'NODEJS' ? 'Node.js' : 'Python'} {bot.runtime.version} · {bot.runtime.variant}</p></div><span className={bot.status === 'RUNNING' ? 'online' : 'offline'}>{bot.status === 'RUNNING' ? 'Online' : 'Parado'}</span></div>
        <div className="meter"><label><span>RAM</span><b>0 MB</b></label><i><u style={{width: '0%'}}/></i></div>
        <div className="botFoot"><span><Cpu/> 0% CPU</span><Link className="manage" href={`/bots/${bot.id}`}>Gerenciar</Link></div>
      </article>)}</div>}
      {user.role==='ADMIN'&&<div className="node"><div className="nodeHead"><div><Server/><div><h3>Infraestrutura de execução</h3><p>Servidores são controlados somente por administradores.</p></div></div><Link className="manage" href="/admin/servers">Gerenciar</Link></div></div>}
    </section>
  </main>;
}
