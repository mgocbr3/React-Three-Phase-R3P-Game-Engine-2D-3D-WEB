// Adapted from tools/vendor/three-game-engine/src/components/UserInterfaceComponent.ts
// (MIT, WesUnwin/three-game-engine).

import Component from '../Component.js';
import { createUIComponent, type UserInterfaceJSON } from '../ui/UIHelpers.js';

class UserInterfaceComponent extends Component {
  async load(): Promise<void> {
    const scene = this.gameObject.getScene();
    const assetStore = scene.game.assetStore;
    await createUIComponent(this.jsonData as unknown as UserInterfaceJSON, this.gameObject.threeJSGroup, assetStore);
  }
}

export default UserInterfaceComponent;
