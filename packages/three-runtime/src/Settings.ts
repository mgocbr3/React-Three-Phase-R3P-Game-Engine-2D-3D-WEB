// Adapted from tools/vendor/three-game-engine/src/Settings.ts
// (MIT, WesUnwin/three-game-engine). Uses internal EventEmitter.

import EventEmitter from './util/EventEmitter.js';
import Util from './Util.js';

const LOCAL_STORAGE_KEY = 'game_settings';

type SettingsMap = Record<string, unknown>;

class Settings {
  private static emitter = new EventEmitter();
  private static settings: SettingsMap | null = null;
  private static promiseChain: Promise<void> = Promise.resolve();

  static on(event: string, listener: (args?: unknown) => void): void {
    Settings.emitter.addEventListener(event, listener);
  }

  static off(event: string, listener: (args?: unknown) => void): void {
    Settings.emitter.removeEventListener(event, listener);
  }

  static getInitialSettings(): SettingsMap {
    return {
      max_arrows: 30,
      bow_in_right_hand: false,
      draw_distance_min: 0.15,
      draw_distance_max: 0.5,
    };
  }

  static load(): void {
    Settings.promiseChain = Settings.promiseChain.then(async () => {
      let savedSettings: string | null = null;
      try {
        savedSettings = typeof window !== 'undefined'
          ? window.localStorage.getItem(LOCAL_STORAGE_KEY)
          : null;
      } catch {
        savedSettings = null;
      }

      if (savedSettings) {
        try {
          Settings.settings = JSON.parse(savedSettings) as SettingsMap;
          Settings.validate();
        } catch {
          Settings.settings = Settings.getInitialSettings();
        }
      } else {
        Settings.settings = Settings.getInitialSettings();
      }
      Settings.emitter.emit('CHANGE');
    });
  }

  static get<T = unknown>(key: string): T | undefined {
    return Settings.settings?.[key] as T | undefined;
  }

  static set(key: string, value: unknown): void {
    if (!Settings.settings) Settings.settings = Settings.getInitialSettings();
    Settings.settings[key] = value;
    Settings.save();
  }

  static reset(): void {
    Settings.settings = Settings.getInitialSettings();
    Settings.save();
  }

  private static validate(): void {
    const maxArrows = Settings.settings?.max_arrows;
    if (typeof maxArrows !== 'number' || maxArrows <= 0) {
      throw new Error('Settings: invalid max_arrows value');
    }
  }

  private static save(): void {
    Settings.debouncedSave();
  }

  private static debouncedSave = Util.debounce(() => {
    Settings.promiseChain = Settings.promiseChain.then(async () => {
      try {
        if (typeof window !== 'undefined') {
          const json = JSON.stringify(Settings.settings ?? Settings.getInitialSettings());
          window.localStorage.setItem(LOCAL_STORAGE_KEY, json);
        }
        Settings.emitter.emit('SAVED');
      } catch {
        Settings.emitter.emit('SAVE_ERROR');
      }
    });
  }, 500);
}

export default Settings;
