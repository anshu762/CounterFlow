export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const IMAGE_ACCEPT = IMAGE_TYPES.join(',');

const EXTENSION_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

// The Content-Type we will send, or null if the file is not an allowed photo.
// Some browsers leave `type` empty, so then the file extension decides.
export function imageContentType(file) {
  if (!file) return null;
  const declared = String(file.type ?? '').toLowerCase();
  if (IMAGE_TYPES.includes(declared)) return declared;
  if (declared !== '') return null;
  const name = String(file.name ?? '');
  const dot = name.lastIndexOf('.');
  if (dot < 0) return null;
  const ext = name.slice(dot + 1).toLowerCase();
  return Object.hasOwn(EXTENSION_TYPES, ext) ? EXTENSION_TYPES[ext] : null;
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Returns a message for the user, or null when the file can be uploaded.
export function validateImageFile(file) {
  if (!file) return 'Choose a photo first.';
  if (!imageContentType(file)) return 'Use a JPG, PNG or WebP photo.';
  if (!file.size) return 'That file is empty.';
  if (file.size > MAX_IMAGE_BYTES) {
    return `That photo is ${formatBytes(file.size)}. The limit is 10 MB.`;
  }
  return null;
}

const UPLOAD_MESSAGES = {
  IMAGE_TOO_LARGE: 'That photo is over the 10 MB limit.',
  UNSUPPORTED_IMAGE: 'Use a JPG, PNG or WebP photo.',
  IMAGE_REQUIRED: 'Choose a photo first.',
  UPLOAD_FAILED: 'The photo service could not take that photo. Please try again.',
  UPLOADS_NOT_CONFIGURED: 'Photo uploads are not set up on the server yet.',
};

export function uploadErrorMessage(code, fallback) {
  return Object.hasOwn(UPLOAD_MESSAGES, code) ? UPLOAD_MESSAGES[code] : fallback;
}