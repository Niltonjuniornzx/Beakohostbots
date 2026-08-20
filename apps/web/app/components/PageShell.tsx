'use client';
import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Activity, Bot, HardDrive, Server, ShieldCheck } from 'lucide-react';

export default function PageShell({ children }: { children: ReactNode }) {
  const router = useRouter(); const pathname = usePathname(); const [name, setName] = useState('');
  useEffect(() => { fetch('/api/auth/me').then(async r => { if (!r.ok) return router.replace('/login'); setName((await r.json()).displayName); }).catch(() => router.replace('/login')); }, [router]);
  if (!name) return <main className="loading"><div className="loader"/></main>;
  const item = (href:string, icon:ReactNode, label:string) => <Link className={pathname === href || (href !== '/' && pathname.startsWith(href)) ? 'active' : ''} href={href}>{icon}{label}</Link>;
  return <main className="shell"><aside><div className="brand"><div className="logo"><Bot size={23}/></div><div><b>BeakoHost</b><small>Bot Cloud</small></div></div><nav>
    {item('/', <Activity/>, 'Visão geral')}{item('/bots', <Bot/>, 'Meus bots')}{item('/servers', <Server/>, 'Servidores')}{item('/files', <HardDrive/>, 'Arquivos')}{item('/security', <ShieldCheck/>, 'Segurança')}
  </nav><div className="account"><span>{name.slice(0,2).toUpperCase()}</span><div><b>{name}</b><small>Conta autenticada</small></div></div></aside><section className="content">{children}</section></main>;
}
