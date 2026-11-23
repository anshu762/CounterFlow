import { describe, it, expect } from 'vitest';
import {
  MAX_IMAGE_BYTES,
  formatBytes,
  imageContentType,
  uploadErrorMessage,
  validateImageFile,
} from '../src/lib/imageFile';

const file = (type, size = 1000, name = 'photo.jpg') => ({ type, size, name });

describe('imageContentType', () => {
  it('accepts jpeg, png and webp', () => {
    expect(imageContentType(file('image/jpeg'))).toBe('image/jpeg');
    expect(imageContentType(file('image/png', 1000, 'a.png'))).toBe('image/png');
    expect(imageContentType(file('image/webp', 1000, 'a.webp'))).toBe('image/webp');
  });

  it('rejects other types, even with an image-like name', () => {
    expect(imageContentType(file('image/gif', 1000, 'a.gif'))).toBeNull();
    expect(imageContentType(file('application/pdf', 1000, 'a.pdf'))).toBeNull();
    expect(imageContentType(file('text/plain', 1000, 'a.jpg'))).toBeNull();
  });

  it('falls back to the extension only when the browser gives no type', () => {
    expect(imageContentType(file('', 1000, 'Menu Shot.JPG'))).toBe('image/jpeg');
    expect(imageContentType(file('', 1000, 'x.jpeg'))).toBe('image/jpeg');
    expect(imageContentType(file('', 1000, 'x.webp'))).toBe('image/webp');
    expect(imageContentType(file('', 1000, 'x.bmp'))).toBeNull();
    expect(imageContentType(file('', 1000, 'jpg'))).toBeNull();
    expect(imageContentType(file('', 1000, 'noextension'))).toBeNull();
  });

  it('handles a missing file', () => {
    expect(imageContentType(null)).toBeNull();
  });
});

describe('validateImageFile', () => {
  it('accepts a normal photo', () => {
    expect(validateImageFile(file('image/jpeg', 2 * 1024 * 1024))).toBeNull();
  });

  it('accepts exactly 10 MB and rejects one byte more', () => {
    expect(validateImageFile(file('image/png', MAX_IMAGE_BYTES, 'a.png'))).toBeNull();
    expect(validateImageFile(file('image/png', MAX_IMAGE_BYTES + 1, 'a.png'))).toMatch(/10 MB/);
  });

  it('rejects empty files, wrong types and a missing file', () => {
    expect(validateImageFile(file('image/jpeg', 0))).toMatch(/empty/);
    expect(validateImageFile(file('image/gif', 1000, 'a.gif'))).toMatch(/JPG, PNG or WebP/);
    expect(validateImageFile(null)).toMatch(/Choose a photo/);
  });

  it('reports the type problem before the size problem', () => {
    expect(validateImageFile(file('image/gif', MAX_IMAGE_BYTES * 2, 'a.gif'))).toMatch(/JPG, PNG or WebP/);
  });
});

describe('formatBytes', () => {
  it('uses B, KB and MB', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(11 * 1024 * 1024)).toBe('11.0 MB');
  });
});

describe('uploadErrorMessage', () => {
  it('maps the server codes to plain sentences', () => {
    expect(uploadErrorMessage('IMAGE_TOO_LARGE', 'x')).toMatch(/10 MB/);
    expect(uploadErrorMessage('UNSUPPORTED_IMAGE', 'x')).toMatch(/JPG, PNG or WebP/);
    expect(uploadErrorMessage('UPLOAD_FAILED', 'x')).toMatch(/try again/i);
    expect(uploadErrorMessage('UPLOADS_NOT_CONFIGURED', 'x')).toMatch(/not set up/);
  });

  it('keeps the server message for unknown codes', () => {
    expect(uploadErrorMessage('SOMETHING_ELSE', 'Server said no')).toBe('Server said no');
    expect(uploadErrorMessage('constructor', 'Server said no')).toBe('Server said no');
  });
});