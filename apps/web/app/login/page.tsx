'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, LockKeyhole, Mail, User } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [needsAdmin, setNeedsAdmin] = useState(false);
  const [register, setRegister] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([fetch('/api/auth/me', { credentials: 'include' }), fetch('/api/auth/setup-status')]).then(async ([me, status]) => {
      if (me.ok) return router.replace('/');
      const setup = await status.json(); setNeedsAdmin(Boolean(setup.needsAdmin)); setRegister(Boolean(setup.needsAdmin)); setLoading(false);
    }).catch(() => { setError('Não foi possível conectar à API.'); setLoading(false); });
  }, [router]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSending(true); setError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const endpoint = needsAdmin ? 'setup' : register ? 'register' : 'login';
    const response = await fetch(`/api/auth/${endpoint}`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    if (!response.ok) { const body = await response.json().catch(() => ({})); setError(Array.isArray(body.message) ? body.message[0] : body.message ?? 'Não foi possível entrar.'); setSending(false); return; }
    router.replace('/'); router.refresh();
  }
  return <main className="authPage">
    <section className="authBrand"><div className="brandMark"><Bot/></div><h1>BeakoHost</h1><p>Hospede, monitore e controle seus bots em uma plataforma segura.</p><div className="authGlow"/></section>
    <section className="authPanel"><div className="authBox"><div className="mobileBrand"><Bot/> BeakoHost</div>
      {loading ? <div className="authLoading"><div className="loader"/>Verificando instalação...</div> : <>
        <small>{needsAdmin ? 'CONFIGURAÇÃO INICIAL' : register ? 'CRIAR CONTA' : 'BEM-VINDO DE VOLTA'}</small>
        <h2>{needsAdmin ? 'Crie o administrador' : register ? 'Comece agora' : 'Entre no painel'}</h2>
        <p>{needsAdmin ? 'Esta será a primeira conta e terá acesso administrativo.' : register ? 'Crie sua conta de hospedagem.' : 'Use seu e-mail e senha para continuar.'}</p>
        <form onSubmit={submit}>
          {(needsAdmin || register) && <label>Nome<div><User/><input name="displayName" minLength={2} maxLength={60} required placeholder="Seu nome"/></div></label>}
          <label>E-mail<div><Mail/><input name="email" type="email" required autoComplete="email" placeholder="voce@email.com"/></div></label>
          <label>Senha<div><LockKeyhole/><input name="password" type="password" minLength={8} required autoComplete={register ? 'new-password' : 'current-password'} placeholder="Mínimo de 8 caracteres"/></div></label>
          {error && <div className="authError">{error}</div>}
          <button disabled={sending}>{sending ? 'Aguarde...' : needsAdmin ? 'Criar administrador' : register ? 'Criar conta' : 'Entrar'}</button>
        </form>
        {!needsAdmin && <button className="switchAuth" onClick={() => { setRegister(!register); setError(''); }}>{register ? 'Já possui conta? Entrar' : 'Não possui conta? Cadastre-se'}</button>}
        <div className="oauth"><span>Google e Discord serão habilitados em breve</span></div>
      </>}
    </div></section>
  </main>;
}
