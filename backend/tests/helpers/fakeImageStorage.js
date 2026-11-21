export function createFakeImageStorage() {
  const calls = { uploads: [], destroys: [] };
  let failNext = false;
  return {
    calls,
    failOnce() {
      failNext = true;
    },
    async upload(buffer, { publicId }) {
      if (failNext) {
        failNext = false;
        throw new Error('cloudinary is down');
      }
      calls.uploads.push({ publicId, bytes: buffer.length });
      return { url: `https://res.cloudinary.com/test/image/upload/v1/${publicId}.jpg`, publicId };
    },
    async destroy(publicId) {
      calls.destroys.push(publicId);
    },
  };
}
