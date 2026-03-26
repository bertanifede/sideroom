const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_ARTWORK_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB
const ARTWORK_MAX_DIMENSION = 1500;
const AVATAR_MAX_DIMENSION = 400;

export { ALLOWED_IMAGE_TYPES, MAX_ARTWORK_SIZE, MAX_AVATAR_SIZE };

export function validateImageFile(
  file: File,
  maxSize: number
): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Please upload a PNG, JPG, or WEBP image.";
  }
  if (file.size > maxSize) {
    const mb = (maxSize / (1024 * 1024)).toFixed(0);
    return `Image must be under ${mb}MB.`;
  }
  return null;
}

/**
 * Compresses and resizes an image file using canvas.
 * Returns the original file if it's already small enough.
 */
export async function compressImage(
  file: File,
  maxDimension: number,
  quality = 0.85
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);

      let { width, height } = img;

      // Skip if already within bounds and small enough
      if (width <= maxDimension && height <= maxDimension) {
        resolve(file);
        return;
      }

      // Scale down preserving aspect ratio
      if (width > height) {
        if (width > maxDimension) {
          height = Math.round(height * (maxDimension / width));
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width = Math.round(width * (maxDimension / height));
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const compressed = new File([blob], file.name, {
            type: "image/webp",
            lastModified: Date.now(),
          });
          resolve(compressed);
        },
        "image/webp",
        quality
      );
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

export function compressArtwork(file: File): Promise<File> {
  return compressImage(file, ARTWORK_MAX_DIMENSION);
}

export function compressAvatar(file: File): Promise<File> {
  return compressImage(file, AVATAR_MAX_DIMENSION);
}
