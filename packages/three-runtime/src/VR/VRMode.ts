// Adapted from tools/vendor/three-game-engine/src/VR/VRMode.ts
// (MIT, WesUnwin/three-game-engine). Uses internal EventEmitter.

import EventEmitter from '../util/EventEmitter.js';

type XRSessionLike = {
  addEventListener: (event: 'end', listener: () => void) => void;
  removeEventListener: (event: 'end', listener: () => void) => void;
  end: () => void;
};

type XRSystemLike = {
  addEventListener: (event: 'devicechange', listener: () => void) => void;
  isSessionSupported: (mode: 'immersive-vr') => Promise<boolean>;
  requestSession: (
    mode: 'immersive-vr',
    init: { optionalFeatures: string[] }
  ) => Promise<XRSessionLike>;
};

class VRMode extends EventEmitter {
  private session: XRSessionLike | null;
  private webXRSupported: boolean;
  private immersiveVRSupported: boolean;
  private immersiveVRChecked: boolean;

  constructor() {
    super();
    this.session = null;
    this.webXRSupported = typeof window !== 'undefined' && 'xr' in window.navigator;
    this.immersiveVRSupported = false;
    this.immersiveVRChecked = false;
    if (this.webXRSupported) {
      const xr = (window.navigator as Navigator & { xr?: XRSystemLike }).xr;
      xr?.addEventListener('devicechange', this.onDeviceChange);
      this.checkForImmersiveVRSupport();
    }
  }

  on(eventName: string, listener: (args?: unknown) => void): void {
    this.addEventListener(eventName, listener);
  }

  off(eventName: string, listener: (args?: unknown) => void): void {
    this.removeEventListener(eventName, listener);
  }

  isWebXRSupported(): boolean {
    return this.webXRSupported;
  }

  isImmersiveVRSupported(): boolean {
    return this.immersiveVRSupported;
  }

  hasCheckedImmersiveVRSupport(): boolean {
    return this.immersiveVRChecked;
  }

  getSession(): XRSessionLike | null {
    return this.session;
  }

  enter(): void {
    if (this.session || !this.webXRSupported) return;
    const xr = (window.navigator as Navigator & { xr?: XRSystemLike }).xr;
    if (!xr) return;

    const sessionInit = {
      optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
    };

    xr.requestSession('immersive-vr', sessionInit)
      .then(this.onSessionStarted)
      .catch((error) => console.error('VRMode: request session failed', error));
  }

  exit(): void {
    this.session?.end();
  }

  private setImmersiveVRSupported(value: boolean): void {
    if (this.immersiveVRSupported !== value || !this.immersiveVRChecked) {
      this.immersiveVRSupported = value;
      this.immersiveVRChecked = true;
      this.emit('CHANGE');
    }
  }

  private checkForImmersiveVRSupport(): void {
    if (!this.webXRSupported) {
      this.setImmersiveVRSupported(false);
      return;
    }
    const xr = (window.navigator as Navigator & { xr?: XRSystemLike }).xr;
    xr?.isSessionSupported('immersive-vr')
      .then((supported) => this.setImmersiveVRSupported(supported))
      .catch((error) => {
        console.error('VRMode: isSessionSupported failed', error);
        this.setImmersiveVRSupported(false);
      });
  }

  private onDeviceChange = (): void => {
    this.checkForImmersiveVRSupport();
  };

  private onSessionStarted = (session: XRSessionLike): void => {
    session.addEventListener('end', this.onSessionEnded);
    this.session = session;
    this.emit('SESSION_STARTED', session);
    this.emit('CHANGE');
  };

  private onSessionEnded = (): void => {
    this.session?.removeEventListener('end', this.onSessionEnded);
    this.session = null;
    this.emit('SESSION_ENDED');
    this.emit('CHANGE');
  };
}

export default VRMode;
