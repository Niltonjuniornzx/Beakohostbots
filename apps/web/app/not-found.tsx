import Link from 'next/link';
import { Bot, Home } from 'lucide-react';

export default function NotFound() {
  return <main className="notFoundPage">
    <div className="brandMark"><Bot/></div>
    <small>ERRO 404</small>
    <h1>Página não encontrada</h1>
    <p>O endereço pode ter mudado ou não existe no painel.</p>
    <Link className="primaryButton" href="/"><Home/>Voltar ao painel</Link>
  </main>;
}
