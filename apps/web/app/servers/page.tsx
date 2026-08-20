import PageShell from '../components/PageShell';
import { Server } from 'lucide-react';
export default function Servers(){return <PageShell><header><div><small>INFRAESTRUTURA</small><h1>Servidores</h1><p>Conecte as VPS onde os bots serão executados.</p></div></header><div className="emptyState"><Server/><h3>Nenhum Runner conectado</h3><p>O cadastro seguro com token descartável e mTLS será a próxima implementação.</p></div></PageShell>}
