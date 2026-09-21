/**
 * Truespace — Барный кейтеринг и финансы
 * Toast Notification Container (`src/client/components/common/Toast.tsx`)
 *
 * Displays lightweight floating feedback notifications with auto-dismiss
 * and undo capabilities.
 */

import React from 'react';
import { CheckCircle2, AlertCircle, Info, X, Undo2 } from 'lucide-react';
import { useFinance, ToastItem } from '../../context/FinanceContext.js';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useFinance();

  if (toasts.length === 0) return null;

  return (
    <div
      className="toast-container"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <ToastSingle key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

export const Toast = ToastContainer;

const ToastSingle: React.FC<{ toast: ToastItem; onClose: () => void }> = ({ toast, onClose }) => {
  let Icon = Info;
  let typeClass = 'toast-info';

  if (toast.type === 'success') {
    Icon = CheckCircle2;
    typeClass = 'toast-success';
  } else if (toast.type === 'error') {
    Icon = AlertCircle;
    typeClass = 'toast-error';
  }

  return (
    <div className={`toast-card ${typeClass}`} role="status">
      <div className="toast-icon">
        <Icon size={18} aria-hidden="true" />
      </div>

      <div className="toast-content">
        <p className="toast-message">{toast.message}</p>
      </div>

      {toast.undoAction && (
        <button
          type="button"
          onClick={() => {
            toast.undoAction?.();
            onClose();
          }}
          className="toast-undo-btn"
        >
          <Undo2 size={13} aria-hidden="true" />
          <span>Отменить</span>
        </button>
      )}

      <button
        type="button"
        onClick={onClose}
        className="toast-close-btn"
        aria-label="Закрыть уведомление"
      >
        <X size={15} />
      </button>
    </div>
  );
};
