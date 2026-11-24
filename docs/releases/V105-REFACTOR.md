# v105 / 0.34.0

- reguli ESLint și Prettier, comandă unică `npm run validate`;
- structură documentată pentru rute, domenii, infrastructură și cod legacy;
- importul, întâlnirile, cântările și wishlistul mutate sub domenii clare; tipurile folosite de client sunt separate de acțiunile server;
- CSS global grupat sub un singur punct de intrare;
- testul bazei mutat în zona de integrare și primele teste Playwright desktop/mobil;
- limitele de import centralizate și limită explicită pentru contribuțiile publice;
- workerul vechi de sincronizare izolat în `legacy/`;
- SQL-ul și documentele duplicate scoase din rădăcină.

Nu există migrare SQL pentru acest release.
