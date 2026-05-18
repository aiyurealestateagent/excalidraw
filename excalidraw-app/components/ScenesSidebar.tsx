import {
  CaptureUpdateAction,
  Sidebar,
  useExcalidrawAPI,
} from "@excalidraw/excalidraw";
import { restoreAppState, restoreElements } from "@excalidraw/excalidraw/data/restore";
import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";
import { useCallback, useEffect, useState } from "react";

import { SceneStore, type StoredScene } from "../data/scenesStore";

import "./ScenesSidebar.scss";

const formatTime = (ts: number) => {
  const date = new Date(ts);
  return date.toLocaleString();
};

const downloadJSON = (filename: string, content: string) => {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export const ScenesSidebarContent = () => {
  const excalidrawAPI = useExcalidrawAPI();
  const [scenes, setScenes] = useState<StoredScene[]>([]);
  const [activeId, setActiveId] = useState<string | null>(
    SceneStore.getActiveId(),
  );
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const refresh = useCallback(async () => {
    const list = await SceneStore.list();
    setScenes(list);
  }, []);

  // Initial load: ensure there's always at least one scene representing the
  // current canvas. If no active scene is recorded, adopt the canvas as the
  // first scene named "Default" so we don't lose it on first interaction.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let list = await SceneStore.list();
      let currentActive = SceneStore.getActiveId();

      if (list.length === 0 && excalidrawAPI) {
        const id = SceneStore.newId();
        await SceneStore.saveSnapshot(
          id,
          "Default",
          excalidrawAPI.getSceneElements(),
          excalidrawAPI.getAppState(),
        );
        SceneStore.setActiveId(id);
        currentActive = id;
        list = await SceneStore.list();
      }

      if (!cancelled) {
        setScenes(list);
        setActiveId(currentActive);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [excalidrawAPI]);

  const saveCurrentToActive = useCallback(async () => {
    if (!excalidrawAPI) {
      return;
    }
    const id = SceneStore.getActiveId();
    if (!id) {
      return;
    }
    const existing = await SceneStore.get(id);
    await SceneStore.saveSnapshot(
      id,
      existing?.name ?? "Untitled",
      excalidrawAPI.getSceneElements(),
      excalidrawAPI.getAppState(),
      existing?.createdAt,
    );
  }, [excalidrawAPI]);

  const switchTo = useCallback(
    async (target: StoredScene) => {
      if (!excalidrawAPI || target.id === activeId) {
        return;
      }
      await saveCurrentToActive();

      const elements = restoreElements(target.elements, null, {
        repairBindings: true,
      });
      const appState = restoreAppState(target.appState, null);

      excalidrawAPI.updateScene({
        elements,
        appState,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });

      SceneStore.setActiveId(target.id);
      setActiveId(target.id);
      await refresh();
    },
    [excalidrawAPI, activeId, saveCurrentToActive, refresh],
  );

  const createNew = useCallback(async () => {
    if (!excalidrawAPI) {
      return;
    }
    await saveCurrentToActive();

    const id = SceneStore.newId();
    const name = `Scene ${scenes.length + 1}`;
    // create empty scene with current appState (keeps theme/zoom-ish defaults)
    const baseAppState = excalidrawAPI.getAppState();
    await SceneStore.saveSnapshot(id, name, [], baseAppState);
    SceneStore.setActiveId(id);

    excalidrawAPI.updateScene({
      elements: [],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    setActiveId(id);
    await refresh();
  }, [excalidrawAPI, scenes.length, saveCurrentToActive, refresh]);

  const startRename = (scene: StoredScene) => {
    setRenamingId(scene.id);
    setRenameValue(scene.name);
  };

  const commitRename = async () => {
    if (renamingId && renameValue.trim()) {
      await SceneStore.rename(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue("");
    await refresh();
  };

  const remove = useCallback(
    async (scene: StoredScene) => {
      if (!window.confirm(`Delete "${scene.name}"? This cannot be undone.`)) {
        return;
      }
      await SceneStore.remove(scene.id);

      if (scene.id === activeId) {
        const remaining = await SceneStore.list();
        if (remaining.length > 0 && excalidrawAPI) {
          await switchTo(remaining[0]);
        } else if (excalidrawAPI) {
          // no scenes left: blank canvas + clear active
          SceneStore.setActiveId(null);
          setActiveId(null);
          excalidrawAPI.updateScene({
            elements: [],
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
          });
        }
      }
      await refresh();
    },
    [activeId, excalidrawAPI, refresh, switchTo],
  );

  const exportScene = useCallback(
    async (scene: StoredScene) => {
      // for the active scene, use latest in-memory state so unsaved tweaks land
      const isActive = scene.id === activeId;
      const elements = isActive && excalidrawAPI
        ? excalidrawAPI.getSceneElements()
        : scene.elements;
      const appState = isActive && excalidrawAPI
        ? excalidrawAPI.getAppState()
        : (scene.appState as any);
      const files = isActive && excalidrawAPI ? excalidrawAPI.getFiles() : {};
      const json = serializeAsJSON(elements, appState, files, "local");
      const safe = scene.name.replace(/[^\w\-\u4e00-\u9fa5]+/g, "_");
      downloadJSON(`${safe}.excalidraw`, json);
    },
    [activeId, excalidrawAPI],
  );

  return (
    <div className="scenes-sidebar">
      <div className="scenes-sidebar__header">
        <span>My Boards</span>
        <button
          className="scenes-sidebar__new"
          onClick={createNew}
          title="New blank board"
        >
          + New
        </button>
      </div>
      <ul className="scenes-sidebar__list">
        {scenes.map((scene) => {
          const isActive = scene.id === activeId;
          const isRenaming = scene.id === renamingId;
          return (
            <li
              key={scene.id}
              className={`scenes-sidebar__item${
                isActive ? " scenes-sidebar__item--active" : ""
              }`}
            >
              <button
                className="scenes-sidebar__row"
                onClick={() => !isRenaming && switchTo(scene)}
                onDoubleClick={() => startRename(scene)}
              >
                {isRenaming ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.currentTarget.blur();
                      } else if (e.key === "Escape") {
                        setRenamingId(null);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="scenes-sidebar__name">{scene.name}</span>
                )}
                <span className="scenes-sidebar__time">
                  {formatTime(scene.updatedAt)}
                </span>
              </button>
              <div className="scenes-sidebar__actions">
                <button
                  title="Rename"
                  onClick={(e) => {
                    e.stopPropagation();
                    startRename(scene);
                  }}
                >
                  ✎
                </button>
                <button
                  title="Export .excalidraw"
                  onClick={(e) => {
                    e.stopPropagation();
                    exportScene(scene);
                  }}
                >
                  ⬇
                </button>
                <button
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(scene);
                  }}
                >
                  ✕
                </button>
              </div>
            </li>
          );
        })}
        {scenes.length === 0 && (
          <li className="scenes-sidebar__empty">No boards yet</li>
        )}
      </ul>
    </div>
  );
};

export const ScenesSidebarTab = () => (
  <Sidebar.Tab tab="scenes">
    <ScenesSidebarContent />
  </Sidebar.Tab>
);
