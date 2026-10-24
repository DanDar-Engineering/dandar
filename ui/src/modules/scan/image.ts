// Phone photos are 3–10 MB, but the Apollo Router rejects request bodies over
// 2 MB. Re-encoding at 1600 px keeps handwriting legible for Gemma and the
// upload around 300–600 KB.
const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.85;
// Mirrors MAX_IMAGE_CHARS in api/src/graphql/scan.ts.
export const MAX_IMAGE_CHARS = 1_500_000;

export const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp";

export type PreparedImage = {
  fileName: string;
  mimeType: "image/jpeg";
  data: string;
  previewUrl: string;
};

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Зургийг уншиж чадсангүй. JPEG, PNG эсвэл WebP файл сонгоно уу."));
    };
    image.src = url;
  });

export const prepareImage = async (file: File): Promise<PreparedImage> => {
  if (!ACCEPTED_IMAGE_TYPES.split(",").includes(file.type)) {
    throw new Error("Зөвхөн JPEG, PNG эсвэл WebP зураг оруулна уу.");
  }

  const image = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Энэ browser зураг боловсруулж чадахгүй байна.");
  }
  // PNG transparency would turn black in JPEG.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const previewUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  const data = previewUrl.slice(previewUrl.indexOf(",") + 1);
  if (data.length > MAX_IMAGE_CHARS) {
    throw new Error("Зураг хэт том байна. Илүү ойроос, зөвхөн хуудсыг нь авна уу.");
  }

  return {
    fileName: file.name.replace(/\.[^.]+$/, "") + ".jpg",
    mimeType: "image/jpeg",
    data,
    previewUrl,
  };
};
