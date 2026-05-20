import { useMemo } from "react";

export type RuntimeEnv = {
  label: "Preview" | "Publicado";
  isPreview: boolean;
  isEmbedded: boolean;
};

export function getRuntimeEnv(): RuntimeEnv {
  const hostname = window.location.hostname;
  const isPreview = hostname.includes("id-preview--") || hostname.includes("lovableproject.com");
  const isEmbedded = new URLSearchParams(window.location.search).get("embedded") === "true";

  return {
    label: isPreview ? "Preview" : "Publicado",
    isPreview,
    isEmbedded,
  };
}

export function EnvironmentBadge() {
  const env = useMemo(() => getRuntimeEnv(), []);

  const title = env.isPreview
    ? "Você está no Preview (ambiente de teste). Logins e projetos NÃO são os mesmos do site publicado."
    : "Você está no site Publicado (ambiente de produção).";

  return (
    <span
      title={title}
      className={
        env.isPreview
          ? "hidden sm:inline text-xs px-2 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20"
          : "hidden sm:inline text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground border border-border"
      }
    >
      {env.label}{env.isEmbedded ? " · Embutido" : ""}
    </span>
  );
}
