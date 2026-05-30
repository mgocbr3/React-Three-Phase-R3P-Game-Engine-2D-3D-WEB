# Desktop Release (Electron + Tauri)

Este app agora tem dois caminhos de distribuicao desktop:

- Electron: empacotamento Node + Chromium, pronto para DMG/NSIS/AppImage.
- Tauri: shell Rust + WebView nativa, pronto para build desktop com menor tamanho.

## Pre-requisitos

1. Node 18+
2. pnpm 10+
3. Rust toolchain (para Tauri)
4. Dependencias do Tauri no macOS (Xcode Command Line Tools)

## Instalar dependencias

```bash
pnpm install
```

## Electron

### Desenvolvimento

```bash
pnpm --filter pixlplaygroundstudio electron:dev
```

### Gerar build local sem instalador (pasta unpacked)

```bash
pnpm --filter pixlplaygroundstudio electron:pack
```

### Gerar instaladores/distribuiveis

```bash
pnpm --filter pixlplaygroundstudio electron:dist
```

Artefatos: `apps/studio/release/electron`

## Tauri

### Desenvolvimento

```bash
pnpm --filter pixlplaygroundstudio tauri:dev
```

### Build de distribuicao

```bash
pnpm --filter pixlplaygroundstudio tauri:build
```

Artefatos: `apps/studio/src-tauri/target/release/bundle`

## Assinatura e publicacao

- Electron (macOS): configure assinatura/notarizacao via variaveis `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `CSC_LINK`, `CSC_KEY_PASSWORD`.
- Tauri (macOS): configure assinatura do Rust/Apple conforme docs oficiais do Tauri.
- Suba os artefatos finais (DMG/ZIP/NSIS/AppImage) para sua pagina de download.

## Troubleshooting (Electron)

Se o Electron falhar com `unable to get local issuer certificate`, a rede local
esta interceptando TLS (proxy/cert corporativo). Nesse caso:

1. Configure o certificado raiz da rede no trust store do sistema.
2. Ou configure `npm/pnpm` para usar o CA interno (`cafile`).
3. Rode novamente:

```bash
pnpm approve-builds --all
pnpm rebuild electron
pnpm --filter pixlplaygroundstudio exec electron --version
```
