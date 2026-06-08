# Third-party Assets and Attribution

This document tracks third-party assets and vendored references that are bundled with the React 3 Phase alpha repository. The repository license does not replace third-party licenses. Always check the source license before redistributing assets outside this repository or using them in a game release.

## MANEQUIN

- **Repo path:** `apps/studio/public/models/manequin/`
- **Use:** Default visual mannequin/player model reference in 3D projects.
- **Source:** https://sketchfab.com/3d-models/manequin-3087ff2a167241ae997291667dc9f079
- **Author:** rato biônico games (https://sketchfab.com/felip32pppp)
- **License:** CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)
- **Requirement:** Attribution is required.

Attribution text:

> This work is based on "MANEQUIN" (https://sketchfab.com/3d-models/manequin-3087ff2a167241ae997291667dc9f079) by rato biônico games (https://sketchfab.com/felip32pppp) licensed under CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/).

The original license file is also kept at `apps/studio/public/models/manequin/license.txt`.

## three.js Soldier / Mixamo Sample

- **Repo path:** `apps/studio/public/models/manequin/mixamo/soldier.glb`
- **Use:** Rigged fallback/reference model with `Idle`, `Walk`, `Run`, and `TPose` clips.
- **Source:** https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/Soldier.glb
- **Repository license:** MIT, three.js authors (https://github.com/mrdoob/three.js/blob/dev/LICENSE)

## three.js X Bot / Mixamo Sample

- **Repo path:** `apps/studio/public/models/manequin/mixamo/xbot.glb`
- **Use:** Main rigged mannequin for first-person and third-person 3D templates.
- **Source:** https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/Xbot.glb
- **Repository license:** MIT, three.js authors (https://github.com/mrdoob/three.js/blob/dev/LICENSE)

## Kloppenheim 05 Pure Sky

- **Repo path:** `apps/studio/public/skybox/kloppenheim_05_puresky_4k.jpg`
- **Use:** Default equirectangular skybox texture for 3D editor/runtime scenes.
- **Source:** https://polyhaven.com/a/kloppenheim_05_puresky
- **Downloaded asset:** Tonemapped JPG, resized to 4096x2048 for browser runtime use.
- **License:** CC0
- **Authors listed by Poly Haven:** Greg Zaal (Original), Jarod Guest (Sky Edits)
- **Requirement:** Attribution is not required by CC0, but it is retained here as courtesy.

The local source note is kept at `apps/studio/public/skybox/kloppenheim_05_puresky_LICENSE.txt`.

## Kloofendal 43d Clear Pure Sky

- **Repo path:** `apps/studio/public/models/skybox/clear-sky.hdr`
- **Use:** Legacy/reference HDR skybox asset retained for rendering experiments.
- **Source:** https://polyhaven.com/a/kloofendal_43d_clear_puresky
- **Author:** Greg Zaal / Poly Haven
- **License:** CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/)
- **Requirement:** Attribution is not required by CC0, but it is retained here as courtesy.

## Kenney Mobile Icons

- **Repo path:** `apps/studio/public/sample-projects/harvest-rush-3d/assets/vendor/kenney/all-in-one/mobile-icons/`
- **Use:** UI icons inside the Harvest Rush 3D sample project.
- **Source:** Kenney game assets collection.
- **License:** Kenney assets are commonly distributed under CC0; keep attribution when possible and verify source package details before shipping a public game using these files.

## Harvest Rush 3D Farm Pack

- **Repo path:** `apps/studio/public/sample-projects/harvest-rush-3d/assets/vendor/farm-pack/`
- **Use:** Alpha sample project validation assets.
- **Status:** Included for engine alpha testing. Verify original asset source and license before redistributing the sample as a standalone public game or commercial build.

## Magic Battleground 2D Sample Assets

- **Repo path:** `apps/studio/public/sample-projects/magic-battleground-2d/assets/`
- **Use:** Alpha Phaser runtime validation sample.
- **Status:** Derived from Pixlland/PixlPlayground sample work according to project metadata. Treat as sample validation content and verify ownership before reuse outside this repository.

## realism-effects

- **Repo path:** `tools/vendor/realism-effects/`
- **Use:** Vendored reference/patched experiment for future realism effects research.
- **Repository:** https://github.com/0beqz/realism-effects
- **Author:** 0beqz / Felix Mariotto
- **License:** MIT
- **Notes:** The npm release is not directly compatible with this repository's Three.js version because of removed Three.js APIs. The vendored copy is kept as a patched reference; preserve upstream credit if it is ported further.
