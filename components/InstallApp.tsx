'use client';

import {useEffect, useState} from 'react';

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{outcome: 'accepted' | 'dismissed'}>;
};

export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)');
    const sync = () => setInstalled(standalone.matches || !!(navigator as Navigator & {standalone?: boolean}).standalone);
    const capture = (event: Event) => {event.preventDefault(); setPrompt(event as InstallPrompt);};
    const done = () => {setInstalled(true); setPrompt(null);};
    sync();
    standalone.addEventListener('change', sync);
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', done);
    return () => {
      standalone.removeEventListener('change', sync);
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', done);
    };
  }, []);

  async function install() {
    if (!prompt || pending) return;
    setPending(true);
    setMessage('');
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setMessage(choice.outcome === 'accepted' ? 'Instalarea a fost solicitată. Caută iconița SongApp pe telefon.' : 'Poți relua instalarea din meniul browserului.');
    } catch {
      setMessage('Folosește opțiunea de instalare din meniul browserului.');
    } finally {
      setPrompt(null);
      setPending(false);
    }
  }

  if (installed) return null;
  return <details className="install-app">
    <summary>Instalează SongApp pe telefon</summary>
    <div className="install-app-content">
      <p>Acces rapid de pe ecranul principal, fără magazin de aplicații.</p>
      {prompt && <button type="button" className="btn" disabled={pending} onClick={install}>{pending ? 'Se deschide instalarea…' : 'Instalează aplicația'}</button>}
      <p><strong>Android:</strong> deschide site-ul în Chrome, apoi meniul ⋮ → „Adaugă pe ecranul de pornire” / „Instalează aplicația”.</p>
      <p><strong>iPhone:</strong> deschide site-ul în Safari, apoi Partajează → „Adăugați la ecranul principal”. Activează „Deschide ca aplicație web”, dacă apare, și apasă „Adăugați”.</p>
      <p>Aplicația folosește internetul. Te poți autentifica după ce o deschizi din iconiță; vizitatorii pot accesa programele publice.</p>
      {message && <p role="status">{message}</p>}
    </div>
  </details>;
}
