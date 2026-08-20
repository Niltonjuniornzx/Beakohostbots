'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Bot, Cpu, HardDrive, LogOut, MemoryStick, Plus, Server, ShieldCheck } from 'lucide-react';

const bots = [
  { name: 'Sticker Downloader', runtime: 'Node.js 22', state: 'Online', ram: '146 / 256 MB', cpu: '4%' },
  { name: 'Atendimento Discord', runtime: 'Python 3.12', state: 'Parado', ram: '0 / 256 MB', cpu: '0%' },
];

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ displayName: string; role: string } | null>(null);
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' }).then(async (response) => {
      if (!response.ok) return router.replace('/login');
      setUser(await response.json());
    }).catch(() => router.replace('/login'));
  }, [router]);
  async function logout() { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); router.replace('/login'); }
  if (!user) return <main className="loading"><div className="loader"/><p>Carregando painel...</p></main>;
  return <main className="shell">
    <aside>
      <div className="brand"><div className="logo"><Bot size={23}/></div><div><b>BeakoHost</b><small>Bot Cloud</small></div></div>
      <nav><a className="active"><Activity/>Visão geral</a><a><Bot/>Meus bots</a><a><Server/>Servidores</a><a><HardDrive/>Arquivos</a><a><ShieldCheck/>Segurança</a></nav>
      <div className="account"><span>{user.displayName.slice(0, 2).toUpperCase()}</span><div><b>{user.displayName}</b><small>{user.role === 'ADMIN' ? 'Administrador' : 'Usuário'}</small></div><button className="logout" onClick={logout} title="Sair"><LogOut/></button></div>
    </aside>
    <section className="content">
      <header><div><small>PAINEL DE CONTROLE</small><h1>Olá, {user.displayName.split(' ')[0]}</h1><p>Seus bots e servidores em um só lugar.</p></div><button><Plus/>Novo bot</button></header>
      <div className="stats">
        <article><div className="icon purple"><Bot/></div><div><small>BOTS ATIVOS</small><strong>1 <em>/ 5</em></strong></div></article>
        <article><div className="icon blue"><Cpu/></div><div><small>CPU EM USO</small><strong>4%</strong></div></article>
        <article><div className="icon green"><MemoryStick/></div><div><small>MEMÓRIA</small><strong>146 MB <em>/ 8 GB</em></strong></div></article>
        <article><div className="icon orange"><Server/></div><div><small>NÓS ONLINE</small><strong>1 <em>/ 1</em></strong></div></article>
      </div>
      <div className="panelTitle"><div><h2>Seus bots</h2><p>Controle e acompanhe suas aplicações.</p></div><a>Ver todos →</a></div>
      <div className="botGrid">{bots.map((bot) => <article className="botCard" key={bot.name}>
        <div className="botTop"><div className="botIcon"><Bot/></div><div><h3>{bot.name}</h3><p>{bot.runtime}</p></div><span className={bot.state === 'Online' ? 'online' : 'offline'}>{bot.state}</span></div>
        <div className="meter"><label><span>RAM</span><b>{bot.ram}</b></label><i><u style={{width: bot.state === 'Online' ? '57%' : '0%'}}/></i></div>
        <div className="botFoot"><span><Cpu/> {bot.cpu} CPU</span><button className="manage">Gerenciar</button></div>
      </article>)}</div>
      <div className="node"><div className="nodeHead"><div><Server/><div><h3>node-br-01</h3><p>São Paulo · Docker rootless</p></div></div><span className="online">Saudável</span></div><div className="nodeStats"><span>CPU<b>2 vCPU</b></span><span>RAM<b>1.4 / 8 GB</b></span><span>DISCO<b>12 / 80 GB</b></span><span>AGENTE<b>v0.1.0</b></span></div></div>
    </section>
  </main>;
}
