export interface MusicWidgetRefs {
  widget: HTMLElement;
  toggleButton: HTMLButtonElement;
  closeButton: HTMLButtonElement;
  panel: HTMLElement;
  iframe: HTMLIFrameElement;
}

// WaterTower Music's official upload of the full Interstellar soundtrack (Hans Zimmer).
const INTERSTELLAR_VIDEO_ID = "YF1eYbfbH5k";
const DEFAULT_VOLUME_PERCENT = 50;
const YOUTUBE_ORIGIN = "https://www.youtube.com";
const IFRAME_API_SRC = `${YOUTUBE_ORIGIN}/iframe_api`;

export function buildMusicEmbedSrc(videoId: string = INTERSTELLAR_VIDEO_ID): string {
  const params = new URLSearchParams({
    enablejsapi: "1", // required for the IFrame Player API used to set the starting volume below
    loop: "1",
    playlist: videoId, // required alongside loop=1 for YouTube to loop a single video
    modestbranding: "1",
    rel: "0",
  });
  return `${YOUTUBE_ORIGIN}/embed/${videoId}?${params.toString()}`;
}

interface YouTubePlayer {
  setVolume(volume: number): void;
}

interface YouTubePlayerConstructor {
  new (
    element: HTMLElement,
    options: { events: { onReady: (event: { target: YouTubePlayer }) => void } },
  ): YouTubePlayer;
}

declare global {
  interface Window {
    YT?: { Player: YouTubePlayerConstructor };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let iframeApiLoading = false;
const onIframeApiReadyCallbacks: Array<() => void> = [];

function loadYouTubeIframeApi(onApiReady: () => void): void {
  if (window.YT?.Player) {
    onApiReady();
    return;
  }
  onIframeApiReadyCallbacks.push(onApiReady);
  if (iframeApiLoading) return;
  iframeApiLoading = true;

  const previousCallback = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    previousCallback?.();
    onIframeApiReadyCallbacks.splice(0).forEach((callback) => callback());
  };

  const script = document.createElement("script");
  script.src = IFRAME_API_SRC;
  document.head.appendChild(script);
}

/*
 * The embed URL has no "starting volume" param, so this is set through the
 * IFrame Player API instead. Unlike a blind postMessage-on-a-timer, `onReady`
 * fires exactly once the player can actually accept commands — so there's no
 * window where a guessed retry can land mid-tap and stomp on the user's own
 * play action.
 */
function setInitialVolume(iframe: HTMLIFrameElement): void {
  loadYouTubeIframeApi(() => {
    new window.YT!.Player(iframe, {
      events: {
        onReady: (event) => event.target.setVolume(DEFAULT_VOLUME_PERCENT),
      },
    });
  });
}

export function initMusicWidget(refs: MusicWidgetRefs): void {
  const { widget, toggleButton, closeButton, panel, iframe } = refs;

  function expand(): void {
    if (!iframe.getAttribute("src")) {
      iframe.src = buildMusicEmbedSrc();
      setInitialVolume(iframe);
    }
    widget.dataset.expanded = "true";
    panel.hidden = false;
    toggleButton.setAttribute("aria-expanded", "true");
  }

  function collapse(): void {
    widget.dataset.expanded = "false";
    panel.hidden = true;
    toggleButton.setAttribute("aria-expanded", "false");
  }

  toggleButton.addEventListener("click", () => {
    if (widget.dataset.expanded === "true") collapse();
    else expand();
  });

  closeButton.addEventListener("click", collapse);
}
