'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bot, Cpu, MemoryStick, Plus, Server, Sparkles, ArrowUpRight, CircleAlert } from 'lucide-react';
import PageShell from './components/PageShell';

type BotItem = { id: string; name: string; status: string; cpuUsagePercent: number; memoryUsageMb: number; runtime: { language: string; version: string; variant: string }; node: null | { name: string; status: string } };
const statusLabel = (status: string) => ({ RUNNING: 'Online', CRASHED: 'Com falha', STARTING: 'Iniciando', STOPPING: 'Parando', STOPPED: 'Parado' }[status] ?? status);

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ displayName: string; role: string } | null>(null);
  const [bots, setBots] = useState<BotItem[]>([]);
  const [limits, setLimits] = useState<any>(null);
  useEffect(() => { Promise.all([
    fetch('/api/auth/me', { credentials: 'include' }).then(r => r.ok ? r.json() : null),
    fetch('/api/bots', { credentials: 'include' }).then(r => r.ok ? r.json() : []),
    fetch('/api/auth/me/limits', { credentials: 'include' }).then(r => r.ok ? r.json() : null)
  ]).then(([currentUser, currentBots, currentLimits]) => { if (!currentUser) return router.replace('/login'); setUser(currentUser); setBots(currentBots); setLimits(currentLimits); }).catch(() => router.replace('/login')); }, [router]);
  if (!user) return <main className="loading"><div className="loader"/><p>Carregando painel...</p></main>;
  const running = bots.filter(bot => bot.status === 'RUNNING').length;
  const failing = bots.filter(bot => bot.status === 'CRASHED').length;
  const memory = bots.reduce((total, bot) => total + (bot.memoryUsageMb || 0), 0);
  const onlineNodes = new Set(bots.filter(bot => bot.node?.status === 'ONLINE').map(bot => bot.node?.name)).size;
  const usage=limits?.usage||{};const meter=(label:string,used:number,total:number,unit='')=><div className="usageBar"><div><b>{label}</b><span>{Math.round(used)}{unit} / {Math.round(total)}{unit}</span></div><i><u style={{width:`${Math.min(100,total?used/total*100:0)}%`}}/></i></div>;
  return <PageShell>
    <header className="dashboardHeader brandHero"><div><small>VISÃO GERAL</small><h1>Olá, {user.displayName.split(' ')[0]} <span>👋</span></h1><p>Acompanhe seus bots e recursos em tempo real.</p></div><Link className="primaryButton" href="/bots/new"><Plus/>Novo bot</Link></header>
    {failing > 0 && <Link className="healthAlert" href="/bots"><CircleAlert/><div><b>{failing} bot{failing > 1 ? 's precisam' : ' precisa'} de atenção</b><span>Confira o diagnóstico e os últimos registros.</span></div><ArrowUpRight/></Link>}
    <div className="stats dashboardStats">
      <article><div className="icon purple"><Bot/></div><div><small>BOTS CADASTRADOS</small><strong>{bots.length}<em> / {limits?.maxBots ?? 5}</em></strong><span className="statHint">{running} em execução</span></div></article>
      <article><div className="icon blue"><Cpu/></div><div><small>BOTS EXECUTANDO</small><strong>{running}</strong><span className="statHint">Atualização automática</span></div></article>
      <article><div className="icon green"><MemoryStick/></div><div><small>MEMÓRIA EM USO</small><strong>{memory} <em>MB</em></strong><span className="statHint">Soma dos bots ativos</span></div></article>
      <article><div className="icon orange"><Server/></div><div><small>NÓS EM USO</small><strong>{onlineNodes}</strong><span className="statHint">Servidores disponíveis</span></div></article>
    </div>
    {limits&&<section className="resourceUsage"><h3>Seus recursos</h3>{meter('CPU',usage.cpuMillicores||0,limits.totalCpuMillicores||limits.cpuMillicores,'m')}{meter('RAM',usage.memoryMb||0,limits.totalMemoryMb||limits.memoryMb,' MB')}{meter('Disco',usage.diskMb||0,Number(limits.diskMb),' MB')}{meter('Tráfego mensal',usage.trafficMb||0,Number(limits.bandwidthIngressMb)+Number(limits.bandwidthEgressMb),' MB')}{meter('Bots',usage.bots||0,limits.maxBots)}</section>}
    <div className="panelTitle"><div><small>APLICAÇÕES</small><h2>Seus bots</h2><p>Acesso rápido às aplicações mais recentes.</p></div><Link href="/bots">Ver todos <ArrowUpRight/></Link></div>
    {bots.length === 0 ? <div className="emptyState dashboardEmpty"><div className="emptyGlow"><Sparkles/></div><h3>Seu espaço está pronto</h3><p>Crie seu primeiro bot e coloque sua aplicação online em poucos passos.</p><Link className="primaryButton" href="/bots/new"><Plus/>Criar primeiro bot</Link></div> : <div className="botGrid">{bots.slice(0, 4).map(bot => <article className="botCard" key={bot.id}>
      <div className="botTop"><div className="botIcon"><Bot/></div><div><h3>{bot.name}</h3><p>{bot.runtime.language === 'NODEJS' ? 'Node.js' : 'Python'} {bot.runtime.version} · {bot.runtime.variant}</p></div><span className={bot.status === 'RUNNING' ? 'online' : bot.status === 'CRASHED' ? 'failed' : 'offline'}><i/>{statusLabel(bot.status)}</span></div>
      <div className="botMetrics"><div><span>CPU</span><b>{(bot.cpuUsagePercent || 0).toFixed(1)}%</b></div><div><span>MEMÓRIA</span><b>{bot.memoryUsageMb || 0} MB</b></div><div><span>SERVIDOR</span><b>{bot.node?.name || 'Aguardando'}</b></div></div>
      <div className="meter"><i><u style={{ width: Math.min(100, (bot.memoryUsageMb || 0) / 256 * 100) + '%' }}/></i></div>
      <div className="botFoot"><span className={bot.node?.status === 'ONLINE' ? 'nodeOk' : ''}><i/>{bot.node?.status === 'ONLINE' ? 'Servidor conectado' : 'Servidor indisponível'}</span><Link className="manage" href={`/bots/${bot.id}`}>Gerenciar <ArrowUpRight/></Link></div>
    </article>)}</div>}
    {user.role === 'ADMIN' && <div className="node adminShortcut"><div className="nodeHead"><div><Server/><div><small>ADMINISTRAÇÃO</small><h3>Infraestrutura de execução</h3><p>Acompanhe capacidade, disponibilidade e runtimes dos servidores.</p></div></div><Link className="manage" href="/admin/servers">Abrir servidores <ArrowUpRight/></Link></div></div>}
  </PageShell>;
}
