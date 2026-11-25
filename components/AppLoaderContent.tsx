"use client";

import { useEffect, useState } from "react";

const verses = [
  {
    reference: "Coloseni 3:23-24",
    before:
      "Orice faceți, să faceți din toată inima, ca pentru Domnul, nu ca pentru oameni, ca unii care știți că veți primi de la Domnul răsplata moștenirii. ",
    emphasis: "Voi slujiți Domnului Hristos.",
    after: "",
  },
  {
    reference: "Matei 20:28",
    before: "După cum nici Fiul omului n-a venit să I se slujească, ci ",
    emphasis: "El să slujească",
    after: " și să-Și dea viața ca răscumpărare pentru mulți.",
  },
  {
    reference: "Galateni 5:13",
    before: "",
    emphasis: "Slujiți-vă unii altora în dragoste.",
    after: "",
  },
  {
    reference: "Coloseni 3:23-24",
    before: "Orice faceți, să faceți din toată inima, ca pentru Domnul, nu ca pentru oameni, căci știți că ",
    emphasis: "de la Domnul veți primi răsplata moștenirii.",
    after: "",
  },
  {
    reference: "1 Petru 4:10",
    before: "Ca niște buni ispravnici ai harului felurit al lui Dumnezeu, fiecare din voi ",
    emphasis: "să slujească altora după darul pe care l-a primit.",
    after: "",
  },
  {
    reference: "Tit 3:8",
    before: "Vreau să spui apăsat aceste lucruri, pentru ca cei ce au crezut în Dumnezeu, să caute să fie ",
    emphasis: "cei dintâi în fapte bune.",
    after: "",
  },
  {
    reference: "Romani 12:1",
    before:
      "Vă îndemn deci, fraților, pentru îndurarea lui Dumnezeu, să vă aduceți trupurile ca jertfă vie, sfântă, plăcută lui Dumnezeu; ",
    emphasis: "aceasta va fi închinarea voastră duhovnicească.",
    after: "",
  },
  {
    reference: "Ioan 4:23-24",
    before: "Dar vine ceasul, și acum a și venit, când închinătorii adevărați se vor închina Tatălui ",
    emphasis: "în duh și în adevăr",
    after: "; căci astfel de închinători dorește și Tatăl.",
  },
  {
    reference: "Psalmul 95:6",
    before: "",
    emphasis: "Veniți să ne închinăm și să ne smerim",
    after: ", să ne plecăm genunchiul înaintea Domnului, Făcătorului nostru!",
  },
  {
    reference: "Psalmul 99:9",
    before: "Înălțați pe Domnul Dumnezeul nostru și ",
    emphasis: "închinați-vă pe muntele Lui cel sfânt!",
    after: " Căci Domnul Dumnezeul nostru este sfânt!",
  },
] as const;

export function AppLoaderContent() {
  const [verseIndex, setVerseIndex] = useState(0);
  useEffect(() => {
    try {
      const stored = Number.parseInt(window.localStorage.getItem("songapp:loader-verse") || "0", 10);
      const current = Number.isFinite(stored) ? Math.abs(stored) % verses.length : 0;
      setVerseIndex(current);
      window.localStorage.setItem("songapp:loader-verse", String((current + 1) % verses.length));
    } catch {
      setVerseIndex(Math.floor(Math.random() * verses.length));
    }
  }, []);
  const verse = verses[verseIndex];
  return (
    <div className="app-loader-content">
      <span className="app-loader-mark" aria-hidden="true">
        ♫
      </span>
      <strong className="app-loader-name">SongApp</strong>
      <blockquote>
        {verse.before}
        <b>{verse.emphasis}</b>
        {verse.after}
      </blockquote>
      <cite>{verse.reference}</cite>
      <i className="app-loader-progress" aria-hidden="true" />
      <small>Se încarcă…</small>
    </div>
  );
}
