import { Button } from "@excalidraw/excalidraw/components/Button";
import { MQ_MIN_WIDTH_DESKTOP } from "@excalidraw/common";
import { LibraryIcon } from "@excalidraw/excalidraw/components/icons";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";

export const ScenesTrigger = ({ onSelect }: { onSelect: () => void }) => {
  const appState = useUIAppState();
  const showIconOnly = appState.width < MQ_MIN_WIDTH_DESKTOP;

  return (
    <Button
      className="collab-button"
      type="button"
      onSelect={onSelect}
      style={{ position: "relative", width: showIconOnly ? undefined : "auto" }}
      title="My Boards"
    >
      {showIconOnly ? LibraryIcon : "My Boards"}
    </Button>
  );
};
