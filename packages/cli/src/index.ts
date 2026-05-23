#!/usr/bin/env node
import { printReport, runValidate } from './commands/validate.js';
import { printOutdatedReport, runOutdated } from './commands/outdated.js';
import { printMigrationResult, runMigrate } from './commands/migrate.js';
import { printNewResult, runNew, type ProjectKind } from './commands/new.js';
import { runImportLevel3D, runExportLevel3D } from './commands/level3d.js';
import { runExportThree, printExportThreeResult } from './commands/exportThree.js';
import { runExportRuntime, printExportRuntimeResult } from './commands/exportRuntime.js';
import {
  printInspectResult,
  printPackResult,
  printUnpackResult,
  runInspect,
  runPack,
  runUnpack,
} from './commands/pack.js';
import {
  isKnownOp,
  listOps,
  parseOpArgs,
  printOpsList,
  runOpsCall,
} from './commands/ops.js';

const USAGE = `pixl-engine — PixlPlayground engine CLI

Commands:
  validate <project.pixlproject.json>          Check schema + 2D/3D coherence.
  outdated <project.pixlproject.json>          Compare against engine/engine.versions.json.
  migrate  <project.pixlproject.json> [--dry]  Align project with the engine manifest.
  new <dir> --kind 2d|3d [--name <name>]       Scaffold a new project folder.
  import-level3d <src.level3d.json> <out.pixlproject.json>   Convert level3d.json -> project doc.
  export-level3d <project.pixlproject.json> <out.level3d.json>   Reverse: project doc -> level3d.json.
  export-three <project.pixlproject.json> <out-dir> [--asset-search <dir>...] [--skip-bundle] [--sourcemap] [--no-minify]
                                               Emit a standalone Three.js+Rapier web bundle for the project.
  export-runtime <project.pixlproject.json> <out-dir> [--runtime-file <path>] [--sourcemap] [--no-minify]
                                               Bundle the project's GAME runtime (game.source.runtimeFile) as a
                                               standalone playable web app. Distinct from export-three (which
                                               bundles the editor snapshot view).
  pack    <project-dir> <out.pixl>             Pack a project folder into a single .pixl archive.
  unpack  <in.pixl> <project-dir>              Unpack a .pixl archive into a project folder (verifies hashes).
  inspect <in.pixl>                            Print the manifest header of a .pixl archive (no hash verify).

  ops list                                     Print JSON catalog of every @pixlland/engine-ops op.
  ops <name> <project-dir> [--key value...]    Invoke an op against the project at <project-dir>.

Examples:
  pixl-engine validate ./apps/portal/games-src/harvest-rush-3d/pixlplayground/project.pixlproject.json
  pixl-engine new ./my-3d-game --kind 3d --name "My 3D Game"
  pixl-engine import-level3d ./apps/portal/games-src/harvest-rush-3d/public/levels/harvest-rush.level3d.json /tmp/harvest.pixlproject.json
  pixl-engine export-level3d /tmp/harvest.pixlproject.json /tmp/harvest.level3d.json
  pixl-engine export-three ./apps/studio/public/sample-projects/harvest-rush-3d/project.pixlproject.json /tmp/harvest-three
  pixl-engine pack    ./apps/portal/games-src/harvest-rush-3d/pixlplayground /tmp/harvest-rush.pixl
  pixl-engine unpack  /tmp/harvest-rush.pixl /tmp/harvest-rush-unpacked
  pixl-engine inspect /tmp/harvest-rush.pixl
`;

const requireTarget = (rest: string[], command: string): string | null => {
  const target = rest[0];
  if (!target) {
    console.error(`${command}: caminho do projeto obrigatorio.\n`);
    console.error(USAGE);
    return null;
  }
  return target;
};

const main = async (): Promise<number> => {
  const [, , command, ...rest] = process.argv;

  if (!command || command === '--help' || command === '-h') {
    console.log(USAGE);
    return command ? 0 : 1;
  }

  switch (command) {
    case 'validate': {
      const target = requireTarget(rest, 'validate');
      if (!target) return 1;
      const report = await runValidate(target);
      printReport(report);
      return report.ok ? 0 : 1;
    }

    case 'outdated': {
      const target = requireTarget(rest, 'outdated');
      if (!target) return 1;
      const report = await runOutdated(target);
      printOutdatedReport(report);
      return report.ok ? 0 : 1;
    }

    case 'migrate': {
      const target = requireTarget(rest, 'migrate');
      if (!target) return 1;
      const dryRun = rest.includes('--dry') || rest.includes('--dry-run');
      const result = await runMigrate(target, { dryRun });
      printMigrationResult(result);
      return 0;
    }

    case 'import-level3d': {
      const source = rest[0];
      const out = rest[1];
      if (!source || !out) {
        console.error('import-level3d: <src.level3d.json> <out.pixlproject.json> obrigatorios.\n');
        console.error(USAGE);
        return 1;
      }
      const result = await runImportLevel3D(source, out);
      console.log(`pixl-engine import-level3d`);
      console.log(`  out:      ${result.outPath}`);
      console.log(`  objetos:  ${result.objectCount}`);
      console.log(`  assets:   ${result.assetCount}`);
      return 0;
    }

    case 'export-level3d': {
      const source = rest[0];
      const out = rest[1];
      if (!source || !out) {
        console.error('export-level3d: <project.pixlproject.json> <out.level3d.json> obrigatorios.\n');
        console.error(USAGE);
        return 1;
      }
      const result = await runExportLevel3D(source, out);
      console.log(`pixl-engine export-level3d`);
      console.log(`  out:      ${result.outPath}`);
      console.log(`  objetos:  ${result.objectCount}`);
      console.log(`  assets:   ${result.assetCount}`);
      return 0;
    }

    case 'export-three': {
      const source = rest[0];
      const out = rest[1];
      if (!source || !out) {
        console.error('export-three: <project.pixlproject.json> <out-dir> obrigatorios.\n');
        console.error(USAGE);
        return 1;
      }
      // Parse --asset-search <dir> (repeatable), --skip-bundle, --sourcemap,
      // and --no-minify flags. Unknown flags abort with a clear error.
      const assetSearchPaths: string[] = [];
      let skipBundle = false;
      let sourcemap = false;
      let minify: boolean | undefined = undefined;
      for (let i = 2; i < rest.length; i += 1) {
        const arg = rest[i];
        if (arg === '--asset-search') {
          const value = rest[i + 1];
          if (!value) {
            console.error('export-three: --asset-search requer um caminho.');
            return 1;
          }
          assetSearchPaths.push(value);
          i += 1;
        } else if (arg === '--skip-bundle') {
          skipBundle = true;
        } else if (arg === '--sourcemap') {
          sourcemap = true;
        } else if (arg === '--no-minify') {
          minify = false;
        } else {
          console.error(`export-three: opcao desconhecida "${arg}".`);
          return 1;
        }
      }
      const result = await runExportThree(source, out, {
        assetSearchPaths,
        skipBundle,
        sourcemap,
        minify,
      });
      printExportThreeResult(result);
      return result.missingAssets.length > 0 ? 0 : 0;
    }

    case 'export-runtime': {
      const source = rest[0];
      const out = rest[1];
      if (!source || !out) {
        console.error('export-runtime: <project.pixlproject.json> <out-dir> obrigatorios.\n');
        console.error(USAGE);
        return 1;
      }
      let runtimeFile: string | undefined = undefined;
      let sourcemap = false;
      let minify: boolean | undefined = undefined;
      for (let i = 2; i < rest.length; i += 1) {
        const arg = rest[i];
        if (arg === '--runtime-file') {
          const value = rest[i + 1];
          if (!value) {
            console.error('export-runtime: --runtime-file requer um caminho.');
            return 1;
          }
          runtimeFile = value;
          i += 1;
        } else if (arg === '--sourcemap') {
          sourcemap = true;
        } else if (arg === '--no-minify') {
          minify = false;
        } else {
          console.error(`export-runtime: opcao desconhecida "${arg}".`);
          return 1;
        }
      }
      const result = await runExportRuntime(source, out, { runtimeFile, sourcemap, minify });
      printExportRuntimeResult(result);
      return 0;
    }

    case 'new': {
      const target = requireTarget(rest, 'new');
      if (!target) return 1;
      const kindIndex = rest.indexOf('--kind');
      const kindValue = kindIndex >= 0 ? rest[kindIndex + 1] : undefined;
      if (kindValue !== '2d' && kindValue !== '3d') {
        console.error('new: --kind 2d|3d obrigatorio.\n');
        console.error(USAGE);
        return 1;
      }
      const nameIndex = rest.indexOf('--name');
      const name = nameIndex >= 0 ? rest[nameIndex + 1] : target;
      const force = rest.includes('--force');
      const result = await runNew({
        name,
        targetDir: target,
        kind: kindValue as ProjectKind,
        force,
      });
      printNewResult(result);
      return 0;
    }

    case 'pack': {
      const source = rest[0];
      const out = rest[1];
      if (!source || !out) {
        console.error('pack: <project-dir> <out.pixl> obrigatorios.\n');
        console.error(USAGE);
        return 1;
      }
      const result = await runPack(source, out);
      printPackResult(result);
      return 0;
    }

    case 'unpack': {
      const source = rest[0];
      const out = rest[1];
      if (!source || !out) {
        console.error('unpack: <in.pixl> <project-dir> obrigatorios.\n');
        console.error(USAGE);
        return 1;
      }
      const result = await runUnpack(source, out);
      printUnpackResult(result);
      return 0;
    }

    case 'inspect': {
      const source = rest[0];
      if (!source) {
        console.error('inspect: <in.pixl> obrigatorio.\n');
        console.error(USAGE);
        return 1;
      }
      const manifest = await runInspect(source);
      printInspectResult(manifest);
      return 0;
    }

    case 'ops': {
      const sub = rest[0];
      if (!sub) {
        console.error('ops: subcomando obrigatorio. Use "ops list" ou "ops <name> <project-dir>".\n');
        console.error(USAGE);
        return 1;
      }
      if (sub === 'list') {
        printOpsList(listOps());
        return 0;
      }
      if (!isKnownOp(sub)) {
        console.error(`ops: nome de op desconhecido "${sub}". Rode "pixl-engine ops list".`);
        return 1;
      }
      const projectDir = rest[1];
      if (!projectDir) {
        console.error(`ops ${sub}: <project-dir> obrigatorio.`);
        return 1;
      }
      let args: Record<string, unknown>;
      try {
        args = parseOpArgs(rest.slice(2));
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        return 1;
      }
      const result = await runOpsCall(sub, projectDir, args);
      console.log(JSON.stringify(result, null, 2));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ok = (result as any)?.ok === true;
      return ok ? 0 : 1;
    }

    default:
      console.error(`Comando desconhecido: ${command}\n`);
      console.error(USAGE);
      return 1;
  }
};

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
