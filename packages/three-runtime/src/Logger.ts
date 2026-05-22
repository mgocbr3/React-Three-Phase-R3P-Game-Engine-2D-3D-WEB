// Adapted from tools/vendor/three-game-engine/src/Logger.ts
// (MIT, WesUnwin/three-game-engine).

import * as THREE from 'three';

import type GameObject from './GameObject.js';
import type Scene from './Scene.js';

interface PrintOptions {
  positions?: boolean;
}

class Logger {
  static printHierarchy(node: GameObject | Scene, options: PrintOptions = {}): void {
    console.log(Logger._printHierarchyRecursive(node, [], true, '', options).join('\n'));
  }

  static _printHierarchyRecursive(
    node: GameObject | Scene,
    lines: string[],
    isLast: boolean,
    prefix: string,
    options: PrintOptions,
  ): string[] {
    const ctor = node.constructor?.name ?? 'unknown';
    const localPrefix = isLast ? '└─' : '├─';
    const name = (node as { name?: string }).name || 'un-named';
    lines.push(`${prefix}${prefix ? localPrefix : ''}${name}   [${ctor}]`);

    const newPrefix = prefix + (isLast ? '  ' : '│ ');
    const children = (node as { gameObjects?: GameObject[] }).gameObjects ?? [];
    const lastNdx = children.length - 1;
    children.forEach((child, ndx) => {
      Logger._printHierarchyRecursive(child, lines, ndx === lastNdx, newPrefix, options);
    });
    return lines;
  }

  static printThreeJSGraph(obj: THREE.Object3D, options: PrintOptions = { positions: false }): void {
    console.log(Logger._printThreeJSGraphRecursive(obj, [], true, '', options).join('\n'));
  }

  private static _printThreeJSGraphRecursive(
    obj: THREE.Object3D,
    lines: string[],
    isLast: boolean,
    prefix: string,
    options: PrintOptions,
  ): string[] {
    const localPrefix = isLast ? '└─' : '├─';
    const formatNumber = (n: number) => Number.parseFloat(n.toFixed(1));
    const { x, y, z } = obj.position;
    const position = `(${formatNumber(x)}, ${formatNumber(y)}, ${formatNumber(z)})`;
    lines.push(`${prefix}${prefix ? localPrefix : ''}${obj.name || 'untitled'}   ${options.positions ? position : ''}    [${obj.type}]`);
    const newPrefix = prefix + (isLast ? '  ' : '│ ');
    const lastNdx = obj.children.length - 1;
    obj.children.forEach((child, ndx) => {
      Logger._printThreeJSGraphRecursive(child, lines, ndx === lastNdx, newPrefix, options);
    });
    return lines;
  }
}

export default Logger;
