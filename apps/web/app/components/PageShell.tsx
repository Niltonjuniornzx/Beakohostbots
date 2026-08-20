'use client';
import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Activity, Bot, HardDrive, Settings, ShieldCheck } from 'lucide-react';

export default function PageShell({ children, adminOnly=false }: { children: ReactNode; adminOnly?: boolean }) {
  const router = useRouter(); const pathname = usePathname(); const [name, setName] = useState(''); const[role,setRole]=useState('');
  useEffect(() => { fetch('/api/auth/me').then(async r => { if (!r.ok) return router.replace('/login');const user=await r.json();if(adminOnly&&user.role!=='ADMIN')return router.replace('/');setName(user.displayName);setRole(user.role); }).catch(() => router.replace('/login')); }, [router,adminOnly]);
  if (!name) return <main className="loading"><div className="loader"/></main>;
  const item = (href:string, icon:ReactNode, label:string) => <Link className={pathname === href || (href !== '/' && pathname.startsWith(href)) ? 'active' : ''} href={href}>{icon}{label}</Link>;
  return <main className="shell"><aside><div className="brand"><div className="logo"><Bot size={23}/></div><div><b>BeakoHost</b><small>Bot Cloud</small></div></div><nav>
    {item('/', <Activity/>, 'Visão geral')}{item('/bots', <Bot/>, 'Meus bots')}{item('/files', <HardDrive/>, 'Arquivos')}{item('/security', <ShieldCheck/>, 'Segurança')}{role==='ADMIN'&&item('/admin', <Settings/>, 'Administração')}
  </nav><div className="account"><span>{name.slice(0,2).toUpperCase()}</span><div><b>{name}</b><small>Conta autenticada</small></div></div></aside><section className="content">{children}</section></main>;
}
