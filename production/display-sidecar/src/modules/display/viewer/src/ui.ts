import type { ViewerElements, ViewerUi } from "./types";

export function createViewerUi(elements: ViewerElements): ViewerUi {
  const { title, copy, status, message, canvas } = elements;

  const showStatus = (text: string, nextTitle?: string, nextCopy?: string) => {
    if (nextTitle && title) title.textContent = nextTitle;
    if (nextCopy && copy) copy.textContent = nextCopy;
    if (status) status.textContent = text;
    message?.classList.remove("hidden");
  };

  return {
    showStatus,
    showFailure(text: string) {
      showStatus(text, "Live display paused", "The app screen did not start cleanly.");
    },
    showCanvas() {
      canvas.classList.remove("hidden");
      message?.classList.add("hidden");
    },
    showStarting(text = "Rebroid is opening the app screen.") {
      showStatus(text, "Starting live display", "Rebroid is opening the app screen.");
    },
  };
}
