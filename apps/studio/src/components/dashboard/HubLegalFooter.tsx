export const HubLegalFooter = () => (
  <section className="mt-14 border-t border-border/70 pt-8">
    <div className="mx-auto flex max-w-xl flex-col items-center gap-5 text-center text-xs text-muted-foreground">
      <div>
        <p className="text-sm font-medium text-foreground">Criado por Pixlland Entertainment</p>
        <p className="mt-1">React 3 Phase e Pixlland para criacao de jogos 2D e 3D.</p>
      </div>

      <div className="flex items-center justify-center gap-7" aria-label="Marcas Pixlland e React 3 Phase">
        <img
          src="/branding/pixlland-logo.png"
          alt="Pixlland"
          data-testid="hub-pixlland-logo"
          className="h-20 w-auto object-contain"
        />
        <img
          src="/branding/react-3-phase-logo.png"
          alt="React 3 Phase"
          data-testid="hub-react-3-phase-logo"
          className="h-20 w-auto object-contain"
        />
      </div>
    </div>
  </section>
);
