/** Big enough for Cover Flow and the album grid on a high-density screen. */
const THUMBNAIL_SIZE = 480;

/**
 * Shrinks artwork to a square thumbnail. Embedded covers are often several megabytes,
 * which is far too heavy to decode for every row of a list.
 */
export const makeThumbnail = async (source: Blob): Promise<Blob | undefined> => {
  try {
    const bitmap = await createImageBitmap(source);
    const crop = Math.min(bitmap.width, bitmap.height);
    const size = Math.min(THUMBNAIL_SIZE, crop);

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext("2d");
    if (!context) {
      return undefined;
    }

    context.imageSmoothingQuality = "high";
    context.drawImage(
      bitmap,
      (bitmap.width - crop) / 2,
      (bitmap.height - crop) / 2,
      crop,
      crop,
      0,
      0,
      size,
      size
    );
    bitmap.close();

    return await new Promise<Blob | undefined>((resolve) =>
      canvas.toBlob((blob) => resolve(blob ?? undefined), "image/jpeg", 0.86)
    );
  } catch (error) {
    console.warn("Unable to create artwork thumbnail:", error);
    return undefined;
  }
};
