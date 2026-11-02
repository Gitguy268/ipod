import { defineView } from "@/components/views/defineView";
import { SelectableListOption } from "@/components/SelectableList";
import SelectableListView from "@/components/SelectableListView";
import { SplitScreenPreview } from "@/components/previews";

const VisualizersViewComponent = () => {
  const options: SelectableListOption[] = [
    {
      type: "view",
      label: "MilkDrop",
      viewId: "visualizer",
      props: { mode: "milkdrop" },
      preview: SplitScreenPreview.Music,
    },
    {
      type: "view",
      label: "Bars",
      viewId: "visualizer",
      props: { mode: "bars" },
      preview: SplitScreenPreview.Music,
    },
  ];

  return <SelectableListView viewId="visualizers" options={options} />;
};

export const VisualizersView = Object.assign(VisualizersViewComponent, {
  viewConfig: defineView({
    component: VisualizersViewComponent,
    type: "split",
    title: "Visualizer",
    isSplitScreen: true,
    preview: SplitScreenPreview.Music,
  }),
});
