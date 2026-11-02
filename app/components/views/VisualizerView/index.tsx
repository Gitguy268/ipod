import { useEffect, useRef, useState } from "react";

import { defineView } from "@/components/views/defineView";
import { useAudioPlayer, useEventListener, useMenuHideView } from "@/hooks";
import type { AudioTap } from "@/hooks/audio/audioDecks";
import { IpodEvent } from "@/utils/events";
import styled from "styled-components";

import { BarsFrame, createBarsState, drawBars, stepBars } from "./bars";

/** How long a MilkDrop preset stays before the next one fades in. */
const PRESET_SECONDS = 30;
const BLEND_SECONDS = 2.7;
/** How long to wait for the browser to let audio run before asking for a click. */
const CLICK_HINT_DELAY_MS = 1000;
const BARS_FFT_SIZE = 2048;
/** The bars stand on the bottom edge and reach two thirds of the way up, as in Musializer. */
const BARS_FRAME: BarsFrame = {
  left: 0,
  right: 1,
  top: 1 / 3,
  bottom: 1,
  glow: 6,
};

const RootContainer = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  background: black;
  overflow: clip;
`;

const Canvas = styled.canvas`
  display: block;
  width: 100%;
  height: 100%;
`;

const Message = styled.p`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  margin: 0;
  padding: 0 16px;
  color: white;
  font-size: 14px;
  text-align: center;
`;

export type VisualizerMode = "milkdrop" | "bars";

type Status = "starting" | "needsClick" | "running" | "unsupported";

const messages: Partial<Record<Status, string>> = {
  needsClick: "Press the center button to start",
  unsupported: "MilkDrop needs WebGL 2, which this browser does not have",
};

interface Renderer {
  render: (now: number, dt: number) => void;
  /** What the center button does, beyond waking the audio. */
  next: () => void;
  dispose: () => void;
}

// Both packages are CommonJS bundles; depending on the bundler the export sits one level deeper.
const unwrap = <T,>(module: { default: T }): T =>
  (module.default as { default?: T }).default ?? module.default;

const createMilkdrop = async (
  canvas: HTMLCanvasElement,
  tap: AudioTap
): Promise<Renderer> => {
  const [butterchurn, presetPack] = await Promise.all([
    import("butterchurn"),
    import("butterchurn-presets"),
  ]);

  const visualizer = unwrap(butterchurn).createVisualizer(tap.context, canvas, {
    width: canvas.width,
    height: canvas.height,
    pixelRatio: 1,
  });
  visualizer.connectAudio(tap.node);

  const presets = Object.values(unwrap(presetPack).getPresets());
  let nextPresetAt = 0;
  const loadNextPreset = (blendSeconds: number) => {
    visualizer.loadPreset(
      presets[Math.floor(Math.random() * presets.length)],
      blendSeconds
    );
    nextPresetAt = performance.now() + PRESET_SECONDS * 1000;
  };
  loadNextPreset(0);

  return {
    render: (now) => {
      if (now >= nextPresetAt) loadNextPreset(BLEND_SECONDS);
      visualizer.render();
    },
    next: () => loadNextPreset(BLEND_SECONDS),
    dispose: () => {
      visualizer.disconnectAudio(tap.node);
      // This view is rebuilt on every visit, and a browser only keeps about 16 WebGL contexts alive.
      canvas
        .getContext("webgl2")
        ?.getExtension("WEBGL_lose_context")
        ?.loseContext();
    },
  };
};

const createBars = (canvas: HTMLCanvasElement, tap: AudioTap): Renderer => {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is not available");

  const analyser = tap.context.createAnalyser();
  analyser.fftSize = BARS_FFT_SIZE;
  // The bars do their own easing.
  analyser.smoothingTimeConstant = 0;
  tap.node.connect(analyser);
  const spectrum = new Float32Array(analyser.frequencyBinCount);
  const state = createBarsState(analyser.frequencyBinCount);

  return {
    render: (_now, dt) => {
      analyser.getFloatFrequencyData(spectrum);
      stepBars(state, spectrum, dt);
      drawBars(context, canvas.width, canvas.height, state, BARS_FRAME);
    },
    next: () => {},
    dispose: () => tap.node.disconnect(analyser),
  };
};

interface Props {
  mode?: VisualizerMode;
}

const VisualizerViewComponent = ({ mode = "milkdrop" }: Props) => {
  useMenuHideView("visualizer");
  const { getVisualizerTap } = useAudioPlayer();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const [status, setStatus] = useState<Status>("starting");

  // The center button is a real click: the moment a browser that was holding audio back lets it run.
  useEventListener<IpodEvent>("centerclick", () => {
    void getVisualizerTap();
    rendererRef.current?.next();
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (mode === "milkdrop" && typeof WebGL2RenderingContext === "undefined") {
      setStatus("unsupported");
      return;
    }

    let frame = 0;
    let cancelled = false;
    const hintTimer = setTimeout(
      () =>
        setStatus((current) =>
          current === "starting" ? "needsClick" : current
        ),
      CLICK_HINT_DELAY_MS
    );

    const start = async () => {
      const tap = await getVisualizerTap();
      if (cancelled) return;

      // Both styles draw in canvas pixels, so the screen's pixel ratio goes into the size.
      const pixelRatio = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * pixelRatio;
      canvas.height = canvas.clientHeight * pixelRatio;

      const renderer =
        mode === "bars"
          ? createBars(canvas, tap)
          : await createMilkdrop(canvas, tap);
      if (cancelled) {
        renderer.dispose();
        return;
      }
      rendererRef.current = renderer;

      let last = performance.now();
      const render = (now: number) => {
        // A tab that was hidden comes back with one very long frame.
        renderer.render(now, Math.min((now - last) / 1000, 0.1));
        last = now;
        frame = requestAnimationFrame(render);
      };
      frame = requestAnimationFrame(render);
      setStatus("running");
    };

    start().catch(() => {
      if (!cancelled) setStatus("unsupported");
    });

    return () => {
      cancelled = true;
      clearTimeout(hintTimer);
      cancelAnimationFrame(frame);
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [getVisualizerTap, mode]);

  return (
    <RootContainer>
      <Canvas ref={canvasRef} aria-hidden />
      {messages[status] && <Message>{messages[status]}</Message>}
    </RootContainer>
  );
};

export const VisualizerView = Object.assign(VisualizerViewComponent, {
  viewConfig: defineView({
    component: VisualizerViewComponent,
    type: "full",
    title: "Visualizer",
    disableLongPress: true,
  }),
});
