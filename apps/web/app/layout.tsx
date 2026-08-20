import type { Metadata } from 'next';
import './styles.css';
import './auth.css';
import './panel.css';
import './admin.css';
import './limits.css';
import './file-manager.css';
import './startup-editor.css';

export const metadata: Metadata = { title: 'BeakoHost', description: 'Hospedagem segura de bots' };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
