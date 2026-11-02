// Neither butterchurn package ships types; these cover the calls this project makes.
declare module "butterchurn" {
  interface Visualizer {
    connectAudio(node: AudioNode): void;
    disconnectAudio(node: AudioNode): void;
    loadPreset(preset: object, blendSeconds: number): void;
    render(): void;
  }

  const butterchurn: {
    createVisualizer(
      context: AudioContext,
      canvas: HTMLCanvasElement,
      options: { width: number; height: number; pixelRatio?: number }
    ): Visualizer;
  };

  export default butterchurn;
}

declare module "butterchurn-presets" {
  const presets: { getPresets(): Record<string, object> };

  export default presets;
}
