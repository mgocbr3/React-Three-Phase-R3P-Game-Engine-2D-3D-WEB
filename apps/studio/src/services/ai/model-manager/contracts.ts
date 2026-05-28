export type RuntimeHost = 'browser' | 'electron' | 'tauri';

export type InferenceDevice = 'webgpu' | 'wasm';

export type ModelInstallState =
  | 'not_installed'
  | 'queued'
  | 'downloading'
  | 'verifying'
  | 'ready'
  | 'failed'
  | 'removing';

export interface ModelArtifact {
  id: string;
  relativePath: string;
  sizeBytes: number;
  sha256: string;
  optional?: boolean;
}

export interface ModelVariant {
  id: string;
  label: string;
  dtype: 'q4' | 'q4f16' | 'q8' | 'fp16' | 'fp32';
  estimatedVramMb: number;
  estimatedRamMb: number;
  recommendedForCode?: boolean;
  artifacts: ModelArtifact[];
}

export interface ModelDescriptor {
  modelId: string;
  title: string;
  provider: 'huggingface';
  repo: string;
  license: string;
  tags: string[];
  defaultVariantId: string;
  variants: ModelVariant[];
}

export interface ModelInstallRecord {
  installId: string;
  modelId: string;
  variantId: string;
  state: ModelInstallState;
  targetDir: string;
  bytesDownloaded: number;
  bytesTotal: number;
  progress: number;
  error?: string;
  installedAt?: string;
  lastUpdatedAt: string;
}

export interface HostCapabilities {
  runtime: RuntimeHost;
  hasWebGpu: boolean;
  hasWasmFallback: boolean;
  freeDiskBytes: number;
  totalRamMb: number;
  gpuAdapterName?: string;
}

export interface PreflightResult {
  ok: boolean;
  reasons: string[];
  warnings: string[];
  selectedDevice: InferenceDevice;
}

export interface DownloadChunk {
  artifactId: string;
  startByte: number;
  endByte: number;
}

export interface DownloadProgressEvent {
  installId: string;
  artifactId: string;
  bytesDownloaded: number;
  bytesTotal: number;
  speedBytesPerSec: number;
  etaSeconds: number;
}

export interface VerifyResult {
  ok: boolean;
  failedArtifacts: Array<{
    artifactId: string;
    expectedSha256: string;
    actualSha256: string;
  }>;
}

export interface LocalModelRuntimeConfig {
  modelId: string;
  variantId: string;
  hfRepo: string;
  localPath: string;
  device: InferenceDevice;
  dtypeMap: Record<string, string>;
}

export interface ModelRegistryEntry {
  modelId: string;
  variantId: string;
  localPath: string;
  status: 'active' | 'inactive';
  device: InferenceDevice;
  registeredAt: string;
}

export interface ModelManager {
  listAvailableModels(): Promise<ModelDescriptor[]>;
  getInstallRecord(modelId: string, variantId: string): Promise<ModelInstallRecord | null>;
  runPreflight(modelId: string, variantId: string): Promise<PreflightResult>;
  install(modelId: string, variantId: string): Promise<ModelInstallRecord>;
  remove(modelId: string, variantId: string): Promise<void>;
  activate(modelId: string, variantId: string): Promise<ModelRegistryEntry>;
  deactivate(modelId: string, variantId: string): Promise<void>;
  onProgress(listener: (event: DownloadProgressEvent) => void): () => void;
}
