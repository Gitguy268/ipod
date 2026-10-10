import { useMemo } from "react";

import { SelectableListOption } from "@/components/SelectableList";
import SelectableListView from "@/components/SelectableListView";
import { SplitScreenPreview } from "@/components/previews";
import { defineView } from "@/components/views/defineView";
import { useLibrary } from "@/lib/library";
import { pluralize } from "@/utils/strings";

const GenresViewComponent = () => {
  const { index } = useLibrary();

  const options: SelectableListOption[] = useMemo(
    () =>
      index.genres.map(
        (genre): SelectableListOption => ({
          type: "view",
          label: genre.name,
          sublabel: `${genre.albums.length} ${pluralize(
            "album",
            "albums",
            genre.albums.length
          )}`,
          viewId: "albums",
          headerTitle: genre.name,
          props: { albums: genre.albums },
        })
      ),
    [index.genres]
  );

  return (
    <SelectableListView
      viewId="genres"
      options={options}
      emptyMessage="No genres"
    />
  );
};

export const GenresView = Object.assign(GenresViewComponent, {
  viewConfig: defineView({
    component: GenresViewComponent,
    type: "full",
    title: "Genres",
    preview: SplitScreenPreview.Music,
  }),
});
