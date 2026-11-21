// env.js must load first so dotenv has filled process.env before the SDK reads CLOUDINARY_URL.
import '../../config/env.js';
import { v2 as cloudinary } from 'cloudinary';
import { AppError } from '../../utils/errors.js';

export function createCloudinaryStorage() {
  const ensureConfigured = () => {
    if (!process.env.CLOUDINARY_URL) {
      throw new AppError('Image uploads are not configured', 503, 'UPLOADS_NOT_CONFIGURED');
    }
  };

  return {
    upload(buffer, { publicId }) {
      ensureConfigured();
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            public_id: publicId,
            overwrite: true,
            invalidate: true,
            resource_type: 'image',
            transformation: [{ width: 1000, crop: 'limit', quality: 'auto' }],
          },
          (err, result) => {
            if (err) return reject(err);
            return resolve({ url: result.secure_url, publicId: result.public_id });
          },
        );
        stream.end(buffer);
      });
    },

    async destroy(publicId) {
      ensureConfigured();
      await cloudinary.uploader.destroy(publicId, { invalidate: true });
    },
  };
}
