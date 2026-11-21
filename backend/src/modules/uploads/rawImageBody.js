import express from 'express';
import { AppError } from '../../utils/errors.js';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const describeSize = (bytes) =>
  bytes >= 1048576 ? `${Math.round((bytes / 1048576) * 10) / 10} MB` : `${bytes} bytes`;

// Reads the request body as raw bytes (the image itself) with a hard size cap.
export function rawImageBody(limitBytes = MAX_IMAGE_BYTES) {
  const parser = express.raw({ type: () => true, limit: limitBytes });
  return (req, res, next) => {
    parser(req, res, (err) => {
      if (err) {
        if (err.type === 'entity.too.large' || err.status === 413) {
          return next(
            new AppError(
              `Image is too large (max ${describeSize(limitBytes)})`,
              413,
              'IMAGE_TOO_LARGE',
            ),
          );
        }
        return next(err);
      }
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return next(new AppError('Send the image file as the request body', 400, 'IMAGE_REQUIRED'));
      }
      return next();
    });
  };
}
