# Contributing to React 3 Phase

React 3 Phase is an alpha engine created by Pixlland Entertainment. Contributions are welcome, especially when they make the engine easier to understand, test, run, or extend.

## Ground Rules

- Keep changes focused.
- Prefer small pull requests with clear validation.
- Preserve the engine/editor boundary. Do not mix unrelated game repository work into engine commits.
- Add or update tests when behavior changes.
- Keep public documentation in English.
- Respect the repository license and third-party asset licenses.

## Good First Contributions

- Fix outdated docs.
- Improve README clarity.
- Add missing attribution for third-party assets.
- Add focused tests around `packages/cli`, `packages/ops`, or runtime adapters.
- Improve alpha UX in the Studio without changing unrelated workflows.
- Report reproducible bugs with screenshots and exact steps.

## Local Setup

```bash
pnpm install
pnpm dev
```

The Studio editor runs at:

```text
http://localhost:8080/
```

## Validation

Before opening a pull request, run the relevant checks:

```bash
pnpm engine:test
pnpm engine:typecheck
git diff --check
```

For UI-only documentation work, at minimum run:

```bash
git diff --check
```

## Pull Request Expectations

Your pull request should explain:

- what changed;
- why it changed;
- how you validated it;
- what remains alpha, risky, or intentionally out of scope.

Include screenshots for visible editor changes.

## License Expectations

By contributing, you agree that your contribution can be distributed under this repository's license: Creative Commons Attribution-NonCommercial 3.0 Unported (`CC BY-NC 3.0`), unless Pixlland explicitly agrees to a different written arrangement.

Do not add third-party assets unless their license is clear and compatible with public redistribution in this repository. Add attribution to [docs/THIRD-PARTY-ASSETS.md](./docs/THIRD-PARTY-ASSETS.md).
