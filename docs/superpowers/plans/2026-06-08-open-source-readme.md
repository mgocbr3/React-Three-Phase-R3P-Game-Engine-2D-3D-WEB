# Open Source README and Public Repo Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the React Three Phase (R3P) repository into a professional English-language public alpha engine repository with branding, screenshots, licensing, collaboration guidance, and clean public docs.

**Architecture:** Keep the change documentation-first and isolated to root repo metadata plus `docs/assets`. Do not refactor engine code or move sample projects unless a public-license issue requires removing unused files.

**Tech Stack:** Markdown, GitHub repository metadata, pnpm workspace validation, in-app browser screenshots.

---

### Task 1: Public Repository Inventory

**Files:**
- Inspect: `README.md`
- Inspect: `package.json`
- Inspect: `docs/THIRD-PARTY-ASSETS.md`
- Inspect: `apps/studio/public/branding/`
- Inspect: `apps/studio/public/skybox/`

- [x] **Step 1: Check existing public docs**

Run:

```bash
find . -maxdepth 3 \( -iname 'README*' -o -iname 'LICENSE*' -o -iname 'CONTRIBUTING*' \) -print
```

Expected: identify existing README files and missing root license/contribution docs.

- [x] **Step 2: Check existing brand and screenshot assets**

Run:

```bash
rg --files | rg -i '\.(png|jpe?g|webp|gif|svg)$'
```

Expected: find Pixlland and React Three Phase (R3P) logos under `apps/studio/public/branding`.

- [x] **Step 3: Check GitHub visibility**

Run:

```bash
gh repo view --json nameWithOwner,visibility,isPrivate,url
```

Expected: confirm whether the repository still needs to be made public.

### Task 2: README and License Materials

**Files:**
- Modify: `README.md`
- Create: `LICENSE.md`
- Create: `CONTRIBUTING.md`
- Modify: `package.json`

- [x] **Step 1: Rewrite the README in English**

Include Pixlland ownership, alpha status, engine description, screenshots, repository layout, quick start, architecture overview, collaboration guidance, and non-commercial license summary.

- [x] **Step 2: Add the non-commercial license file**

Use Creative Commons Attribution-NonCommercial 3.0 Unported (`CC BY-NC 3.0`) because it matches the requested non-commercial use intent.

- [x] **Step 3: Add contribution guidance**

Create `CONTRIBUTING.md` with local setup, validation commands, PR expectations, and asset-license rules.

- [x] **Step 4: Add package metadata**

Set root `package.json` license metadata to `CC-BY-NC-3.0` and align the description with the public engine identity.

### Task 3: Brand Assets and Screenshots

**Files:**
- Create: `docs/assets/brand/pixlland-logo.png`
- Create: `docs/assets/brand/react-3-phase-logo.png`
- Create: `docs/assets/screenshots/studio-editor-3d.png`
- Create: `docs/assets/screenshots/studio-hub.png`

- [x] **Step 1: Copy logo assets into docs**

Run:

```bash
mkdir -p docs/assets/brand docs/assets/screenshots
cp apps/studio/public/branding/pixlland-logo.png docs/assets/brand/pixlland-logo.png
cp apps/studio/public/branding/react-3-phase-logo.png docs/assets/brand/react-3-phase-logo.png
```

- [x] **Step 2: Capture two browser screenshots**

Capture the active 3D editor and the Hub page from the local dev server, then reference both screenshots from `README.md`.

### Task 4: Public Asset Cleanup

**Files:**
- Modify: `docs/THIRD-PARTY-ASSETS.md`
- Remove if unused: `apps/studio/public/skybox/sky.glb`
- Remove if unused: `apps/studio/public/skybox/sky.png`
- Remove if unused: `apps/studio/public/skybox/clear_blue_sky.jpg`

- [x] **Step 1: Check whether legacy skybox assets are referenced**

Run:

```bash
rg -n "sky\.glb|sky\.png|clear_blue_sky|/skybox/sky|/skybox/clear" apps packages docs
```

Expected: no active code references.

- [x] **Step 2: Remove unused assets without clear public-license value**

Run:

```bash
git rm apps/studio/public/skybox/sky.glb apps/studio/public/skybox/sky.png apps/studio/public/skybox/clear_blue_sky.jpg
```

- [x] **Step 3: Rewrite asset attribution in English**

Document active bundled third-party assets and clearly state that third-party assets keep their own licenses.

### Task 5: Verification and Publish

**Files:**
- Verify: `README.md`
- Verify: `LICENSE.md`
- Verify: `CONTRIBUTING.md`
- Verify: `docs/THIRD-PARTY-ASSETS.md`
- Verify: GitHub repository visibility

- [ ] **Step 1: Verify Markdown links and image paths**

Run:

```bash
rg -n "\(docs/assets|LICENSE.md|CONTRIBUTING.md|THIRD-PARTY-ASSETS.md\)" README.md
test -f docs/assets/screenshots/studio-editor-3d.png
test -f docs/assets/screenshots/studio-hub.png
```

- [ ] **Step 2: Verify workspace health**

Run:

```bash
git diff --check
pnpm engine:test
pnpm engine:typecheck
```

- [ ] **Step 3: Make GitHub repository public**

Run:

```bash
gh repo edit --visibility public --accept-visibility-change-consequences
```

- [ ] **Step 4: Commit and push**

Run:

```bash
git add -A
git commit -m "Polish public alpha repository docs"
git push
```
