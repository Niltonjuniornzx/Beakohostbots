import type { Metadata } from 'next';
import './styles.css';
import './auth.css';
import './panel.css';
import './admin.css';
import './limits.css';
import './file-manager.css';
import './startup-editor.css';
import './env-manager.css';

export const metadata: Metadata = {
  title: 'BeakoHost',
  description: 'Hospedagem segura de bots',
  icons: { icon: '/branding/favicon.png', apple: '/branding/icon-square.webp' },
};
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
