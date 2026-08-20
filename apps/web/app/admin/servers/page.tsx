'use client';
import { FormEvent, useEffect, useState } from 'react';
import PageShell from '../../components/PageShell';
import { Plus, Server, Trash2 } from 'lucide-react';

export default function ServersAdmin() {
  const [nodes, setNodes] = useState<any[]>([]);
  const [token, setToken] = useState('');
  const [origin, setOrigin] = useState('https://seu-dominio.com');
  const [show, setShow] = useState(false);
  const load = () => fetch('/api/admin/nodes').then(r => r.ok ? r.json() : []).then(setNodes);

  useEffect(() => {
    setOrigin(window.location.origin);
    void load();
    const timer=setInterval(()=>void load(),30000);
    return()=>clearInterval(timer);
  }, []);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const body = data;
    const response = await fetch('/api/admin/nodes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (response.ok) {
      const node = await response.json();
      setToken(node.enrollmentToken);
      setShow(false);
      void load();
    }
  }

  async function remove(id: string) {
    if (!confirm('Remover este servidor? Ele precisa estar sem bots.')) return;
    const response = await fetch(`/api/admin/nodes/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const body = await response.json();
      alert(body.message);
    }
    void load();
  }

  const command = `sudo bash scripts/install-runner.sh --panel ${origin} --token ${token}${origin.startsWith('http://') ? ' --allow-insecure' : ''}`;

  return <PageShell adminOnly>
    <header>
      <div><small>CLUSTER</small><h1>Servidores</h1><p>Somente administradores podem modificar a infraestrutura.</p></div>
      <button onClick={() => setShow(!show)}><Plus />Adicionar servidor</button>
    </header>
    {show && <form className="settingsForm" onSubmit={create}>
      <label>Nome<input name="name" required placeholder="node-br-01" /></label>
      <p>CPU, RAM, disco e hostname serão detectados automaticamente pelo Runner.</p>
      <button>Criar e gerar token</button>
    </form>}
    {token && <div className="tokenBox">
      <b>Instale na VPS executora — token exibido uma única vez</b>
      <code>{command}</code>
      <button type="button" onClick={() => navigator.clipboard.writeText(command)}>Copiar comando</button>
      <p>Execute na raiz do repositório. Expira em 15 minutos e só pode ser usado uma vez. Prefira domínio com HTTPS.</p>
    </div>}
    <div className="listPanel serverList">
      {nodes.length === 0 ? <div className="emptyState"><Server /><h3>Nenhum servidor cadastrado</h3><p>Adicione a primeira VPS executora.</p></div> : nodes.map(node =>
        <div className="listRow" key={node.id}>
          <div className="botIcon"><Server /></div>
          <div><b>{node.name}</b><small>{node.hostname} · {node.totalCpuMillicores / 1000} vCPU · {node.totalMemoryMb} MB · {node._count.bots} bots · agente {node.agentVersion || 'não conectado'}</small><div className="nodeRuntimes">{(Array.isArray(node.runtimeImages)?node.runtimeImages:[]).map((image:string)=><em key={image}>{image}</em>)}</div></div>
          <span className={node.status === 'ONLINE' ? 'online' : 'offline'}>{node.status}</span>
          <button className="dangerIcon" onClick={() => remove(node.id)}><Trash2 /></button>
        </div>)}
    </div>
  </PageShell>;
}
