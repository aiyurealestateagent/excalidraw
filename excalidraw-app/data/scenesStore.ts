/**
 * Multi-scene storage backed by IndexedDB (via idb-keyval).
 *
 * Each scene holds a snapshot of elements + a slim appState. Image binaries
 * stay in the shared `files-db` (see LocalData.ts) — scenes only reference
 * them by fileId, just like the existing single-scene behaviour.
 */

import { clearAppStateForLocalStorage } from "@excalidraw/excalidraw/appState";
import { randomId } from "@excalidraw/common";
import { createStore, del, entries, get, set } from "idb-keyval";

import { getNonDeletedElements } from "@excalidraw/element";

import type { AppState } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";

const scenesStore = createStore("excalidraw-scenes-db", "scenes-store");

const ACTIVE_SCENE_ID_KEY = "excalidraw-active-scene-id";

export type StoredScene = {
  id: string;
  name: string;
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  createdAt: number;
  updatedAt: number;
};

export const SceneStore = {
  list: async (): Promise<StoredScene[]> => {
    const all = (await entries(scenesStore)) as [string, StoredScene][];
    return all
      .map(([, scene]) => scene)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },

  get: async (id: string): Promise<StoredScene | undefined> => {
    return (await get(id, scenesStore)) as StoredScene | undefined;
  },

  upsert: async (scene: StoredScene): Promise<void> => {
    await set(scene.id, scene, scenesStore);
  },

  saveSnapshot: async (
    id: string,
    name: string,
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    createdAt?: number,
  ): Promise<StoredScene> => {
    const scene: StoredScene = {
      id,
      name,
      elements: getNonDeletedElements(elements),
      appState: clearAppStateForLocalStorage(appState),
      createdAt: createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };
    await set(id, scene, scenesStore);
    return scene;
  },

  rename: async (id: string, name: string): Promise<void> => {
    const scene = (await get(id, scenesStore)) as StoredScene | undefined;
    if (!scene) {
      return;
    }
    await set(id, { ...scene, name, updatedAt: Date.now() }, scenesStore);
  },

  remove: async (id: string): Promise<void> => {
    await del(id, scenesStore);
  },

  newId: () => randomId(),

  getActiveId: (): string | null => {
    try {
      return localStorage.getItem(ACTIVE_SCENE_ID_KEY);
    } catch {
      return null;
    }
  },

  setActiveId: (id: string | null) => {
    try {
      if (id) {
        localStorage.setItem(ACTIVE_SCENE_ID_KEY, id);
      } else {
        localStorage.removeItem(ACTIVE_SCENE_ID_KEY);
      }
    } catch {
      // ignore
    }
  },
};
