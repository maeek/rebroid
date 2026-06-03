import type { ViewerElements, ViewerUi } from "./types";

export function createViewerUi(elements: ViewerElements): ViewerUi {
  const { title, copy, status, compatibility, message, canvas, video } =
    elements;

  const showStatus = (text: string, nextTitle?: string, nextCopy?: string) => {
    if (nextTitle && title) title.textContent = nextTitle;
    if (nextCopy && copy) copy.textContent = nextCopy;
    if (status) status.textContent = text;
    message?.classList.remove("hidden");
  };

  return {
    showStatus,
    showFailure(text: string) {
      showStatus(
        text,
        "Live display paused",
        "The app screen did not start cleanly.",
      );
    },
    showCanvas() {
      video.classList.add("hidden");
      canvas.classList.remove("hidden");
      message?.classList.add("hidden");
    },
    showVideo() {
      canvas.classList.add("hidden");
      video.classList.remove("hidden");
      message?.classList.add("hidden");
    },
    showStarting(text = "Rebroid is opening the app screen.") {
      showStatus(
        text,
        "Starting live display",
        "Rebroid is opening the app screen.",
      );
    },
    showCompatibility(mode: string, detail?: string) {
      if (!compatibility) {
        return;
      }
      if (!mode || mode === "normal") {
        compatibility.classList.add("hidden");
        compatibility.textContent = "";
        return;
      }
      const label =
        mode === "audio-disabled"
          ? "Audio disabled"
          : mode === "stream-control-disabled"
            ? "ADB control fallback"
            : mode === "stable-video"
              ? "Stable video mode"
              : mode;
      compatibility.textContent = detail ? `${label}: ${detail}` : label;
      compatibility.classList.remove("hidden");
    },
  };
}
