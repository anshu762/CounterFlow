import { AppError } from '../../utils/errors.js';

export const categoryNotFound = () => new AppError('Category not found', 404, 'CATEGORY_NOT_FOUND');
export const itemNotFound = () => new AppError('Menu item not found', 404, 'ITEM_NOT_FOUND');
export const variantNotFound = () =>
  new AppError('Size option not found', 404, 'VARIANT_NOT_FOUND');
export const categoryNameTaken = () =>
  new AppError('A category with this name already exists', 409, 'CATEGORY_NAME_TAKEN');
export const itemNameTaken = () =>
  new AppError('This category already has an item with this name', 409, 'ITEM_NAME_TAKEN');
export const variantLabelTaken = () =>
  new AppError('This item already has a size with this label', 409, 'VARIANT_LABEL_TAKEN');
export const categoryNotEmpty = () =>
  new AppError(
    'This category still has items. Hide it instead of deleting it.',
    409,
    'CATEGORY_NOT_EMPTY',
  );
export const invalidOrder = (message = 'The order list does not match the existing records') =>
  new AppError(message, 400, 'INVALID_ORDER');
