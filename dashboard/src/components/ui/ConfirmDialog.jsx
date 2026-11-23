import Modal from './Modal';
import Spinner from './Spinner';
import { dangerButton } from './buttons';
import { secondaryButton } from '../settings/styles';

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  pending = false,
  error = null,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      title={title}
      size="sm"
      onClose={() => {
        if (!pending) onCancel();
      }}
      footer={
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onCancel} disabled={pending} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={pending} className={dangerButton}>
            {pending && <Spinner className="h-4 w-4" />}
            {confirmLabel}
          </button>
        </div>
      }
    >
      <p className="text-sm text-stone-700">{message}</p>
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </Modal>
  );
}