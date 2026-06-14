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
    preserveVideoFrame(source: HTMLVideoElement) {
      if (
        source.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        source.videoWidth <= 0 ||
        source.videoHeight <= 0
      ) {
        return false;
      }

      canvas.width = source.videoWidth;
      canvas.height = source.videoHeight;
      elements.context.drawImage(source, 0, 0, canvas.width, canvas.height);
      canvas.classList.remove("hidden");
      video.classList.add("hidden");
      message?.classList.add("hidden");
      return true;
    },
    showStarting(text = "Rebroid is opening the app screen.") {
      showStatus(
        text,
        "Starting live display",
        "Rebroid is opening the app screen.",
      );
    },
    showCompatibility(_mode: string, _detail?: string) {
      if (!compatibility) {
        return;
      }
      compatibility.classList.add("hidden");
      compatibility.textContent = "";
    },
  };
}
