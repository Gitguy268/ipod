type AudioEventName =
  | "playing"
  | "pause"
  | "waiting"
  | "durationchange"
  | "seeked"
  | "ended"
  | "error";

interface Deck {
  audio: HTMLAudioElement;
  url?: string;
  /** The song loaded into this deck, when it was loaded ahead of time. */
  preloadedSongId?: string;
}

const createDeck = (): Deck => {
  const audio = new Audio();
  audio.preload = "auto";

  return { audio };
};

const unload = (deck: Deck) => {
  deck.audio.pause();
  deck.audio.removeAttribute("src");
  deck.audio.load();

  if (deck.url) {
    URL.revokeObjectURL(deck.url);
  }

  deck.url = undefined;
  deck.preloadedSongId = undefined;
};

const load = (deck: Deck, file: File) => {
  if (deck.url) {
    URL.revokeObjectURL(deck.url);
  }

  deck.url = URL.createObjectURL(file);
  deck.audio.src = deck.url;
};

/**
 * Two audio elements: one playing, and one holding the next song already loaded
 * so that moving on to it doesn't wait for the file to be opened.
 */
export class AudioDecks {
  private active = createDeck();
  private standby = createDeck();

  /** The element that is playing (or about to). */
  get current() {
    return this.active.audio;
  }

  load(file: File) {
    this.active.preloadedSongId = undefined;
    load(this.active, file);
  }

  preload(songId: string, file: File) {
    load(this.standby, file);
    this.standby.preloadedSongId = songId;
    this.standby.audio.load();
  }

  hasPreloaded(songId: string) {
    return this.standby.preloadedSongId === songId;
  }

  /** Makes the preloaded song the current one and frees the deck that was playing. */
  swap() {
    [this.active, this.standby] = [this.standby, this.active];
    this.active.preloadedSongId = undefined;
    unload(this.standby);
  }

  clearPreload() {
    if (this.standby.preloadedSongId) {
      unload(this.standby);
    }
  }

  clear() {
    unload(this.active);
    unload(this.standby);
  }

  setVolume(volume: number) {
    this.active.audio.volume = volume;
    this.standby.audio.volume = volume;
  }

  /**
   * Listens to whichever deck is current. Events from the deck that is only
   * preloading (or winding down after a swap) are ignored.
   */
  on(type: AudioEventName, handler: () => void) {
    const listener = (event: Event) => {
      if (event.target === this.active.audio) {
        handler();
      }
    };

    this.active.audio.addEventListener(type, listener);
    this.standby.audio.addEventListener(type, listener);

    return () => {
      this.active.audio.removeEventListener(type, listener);
      this.standby.audio.removeEventListener(type, listener);
    };
  }
}
