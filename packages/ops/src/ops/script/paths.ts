// Path safety for the Scripts/ subtree. Every script op must call resolveScriptPath
// to reject path traversal and to normalize to POSIX-style relative paths
// (since they end up in doc.assets and on the wire).

import path from 'node:path';
import { OpInputError } from '../../types.js';

export const SCRIPTS_FOLDER = 'Scripts';

export const resolveScriptPath = (
  projectDir: string,
  scriptPath: string,
): { absPath: string; relPath: string } => {
  if (!scriptPath) {
    throw new OpInputError('script path é obrigatório.');
  }
  if (scriptPath.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(scriptPath)) {
    throw new OpInputError(`script path deve ser relativo: ${scriptPath}`);
  }
  // Allow callers to pass either "foo.js" or "Scripts/foo.js" — we always
  // resolve under <projectDir>/Scripts/.
  const stripped = scriptPath.replace(/^[/\\]+/, '');
  const normalized = stripped.startsWith(`${SCRIPTS_FOLDER}/`) || stripped.startsWith(`${SCRIPTS_FOLDER}\\`)
    ? stripped.slice(SCRIPTS_FOLDER.length + 1)
    : stripped;

  const scriptsRoot = path.resolve(projectDir, SCRIPTS_FOLDER);
  const candidate = path.resolve(scriptsRoot, normalized);
  // Guard against `..` escaping the Scripts/ subtree.
  const rel = path.relative(scriptsRoot, candidate);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new OpInputError(`script path tenta escapar de Scripts/: ${scriptPath}`);
  }
  return {
    absPath: candidate,
    relPath: `${SCRIPTS_FOLDER}/${rel.split(path.sep).join('/')}`,
  };
};
