// File System Access API allows only one active picker at a time. Calling
// showSaveFilePicker / showOpenFilePicker / showDirectoryPicker while another
// is open throws "File picker already active" — which shows up as a noisy
// toast when an auto-save handler races a manual save click.
//
// This is a tiny module-scope lock: every picker entry point in the studio
// wraps its call in withFilePicker(). The lock is released regardless of
// success, failure, or user abort.

let pickerActive = false;
let activeLabel = '';

const isAbortError = (error: unknown): boolean => {
  const name = (error as DOMException)?.name;
  return name === 'AbortError';
};

export class FilePickerBusyError extends Error {
  readonly busyWith: string;
  constructor(busyWith: string) {
    super(`File picker already active (${busyWith}). Finish or cancel the current picker first.`);
    this.name = 'FilePickerBusyError';
    this.busyWith = busyWith;
  }
}

export const isFilePickerActive = (): boolean => pickerActive;

export const withFilePicker = async <T>(
  label: string,
  task: () => Promise<T>,
): Promise<T> => {
  if (pickerActive) {
    throw new FilePickerBusyError(activeLabel);
  }
  pickerActive = true;
  activeLabel = label;
  try {
    return await task();
  } finally {
    pickerActive = false;
    activeLabel = '';
  }
};

export const isAbortLikeError = isAbortError;
