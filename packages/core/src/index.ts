// Public surface of @pixlland/engine-core.
//
// Browser code SHOULD import only from this file. Node-only helpers live in
// `./nodeProjectIO.js` and must be imported explicitly so bundlers can prune.

export {
  PIXL_PACKAGE_FORMAT,
  PIXL_PACKAGE_FORMAT_VERSION,
  PIXL_PACKAGE_MANIFEST_PATH,
  PIXL_PROJECT_DOCUMENT_PATH,
  isPixlPackageManifest,
} from './manifest.js';

export type {
  PixlPackageFileEntry,
  PixlPackageManifest,
} from './manifest.js';

export {
  packProject,
  unpackPackage,
  readManifestFromPackage,
} from './pixlPackage.js';

export {
  createAssetSource,
} from './assetSource.js';

export type {
  AssetSource,
  AssetSourceInput,
} from './assetSource.js';

export {
  sha256,
  sha256OfString,
} from './contentHash.js';
