'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Activity, Bot, Gauge, KeyRound, LogOut, Menu, Server, Settings, ShieldCheck, Users, X } from 'lucide-react';

export default function PageShell({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { fetch('/api/auth/me').then(async response => { if (!response.ok) return router.replace('/login'); const user = await response.json(); if (adminOnly && user.role !== 'ADMIN') return router.replace('/'); setName(user.displayName); setRole(user.role); }).catch(() => router.replace('/login')); }, [router, adminOnly]);
  useEffect(() => setMenuOpen(false), [pathname]);
  async function logout() { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); router.replace('/login'); }
  if (!name) return <main className="loading"><div className="loader"/><p>Preparando seu painel...</p></main>;
  const item = (href: string, icon: ReactNode, label: string) => { const active = pathname === href || (href !== '/' && href !== '/admin' && pathname.startsWith(href + '/')); return <Link className={active ? 'active' : ''} href={href}>{icon}<span>{label}</span>{active && <i/>}</Link>; };
  return <main className="shell">
    <div className={`sidebarBackdrop ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)}/>
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="brand"><div className="logo"><Bot size={23}/></div><div><b>BeakoHost</b><small>BOT CLOUD</small></div><button className="closeMenu" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X/></button></div>
      <nav><span className="navSection">PAINEL</span>{item('/', <Activity/>, 'Visão geral')}{item('/bots', <Bot/>, 'Meus bots')}{item('/security', <ShieldCheck/>, 'Segurança')}{role === 'ADMIN' && <><span className="navSection">ADMINISTRAÇÃO</span>{item('/admin', <Settings/>, 'Resumo')}{item('/admin/plans', <Gauge/>, 'Planos e limites')}{item('/admin/settings', <KeyRound/>, 'Configurações')}{item('/admin/users', <Users/>, 'Usuários')}{item('/admin/servers', <Server/>, 'Servidores')}{item('/admin/bots', <Bot/>, 'Distribuição')}</>}</nav>
      <div className="sidebarStatus"><span/><div><b>Plataforma operacional</b><small>Ambiente beta</small></div></div>
      <div className="account"><span>{name.slice(0, 2).toUpperCase()}</span><div><b>{name}</b><small>{role === 'ADMIN' ? 'Administrador' : 'Usuário'}</small></div><button className="logout" onClick={logout} title="Sair"><LogOut/></button></div>
    </aside>
    <section className="workspace"><div className="mobileTopbar"><button onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Menu/></button><div className="mobileBrand"><span><Bot/></span><b>BeakoHost</b></div><div className="mobileAvatar">{name.slice(0, 2).toUpperCase()}</div></div><div className="content">{children}</div></section>
  </main>;
}
