// ============================================================================
// UX UTILITIES - Toast & Confirmations
// ============================================================================

import { Toaster, toast } from 'react-hot-toast';

/**
 * Global toast configuration (centered, long duration)
 */
export function setupToasterGlobal() {
  return (
    <Toaster 
      position="top-center" 
      reverseOrder={false}
      toastOptions={{
        duration: 4000,
        style: {
          background: '#042f2e',
          color: '#fff',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '0.875rem',
          fontWeight: 500,
          borderRadius: '12px',
          padding: '1rem 1.25rem',
        },
      }}
    />
  );
}

/**
 * Success toast
 * @param {string} message
 * @param {number} duration in ms (default: 4000)
 */
export const notifySuccess = (message, duration = 4000) => {
  toast.success(message, {
    duration,
    icon: '✅',
    style: {
      background: '#166534',
      color: '#fff',
    },
  });
};

/**
 * Error toast
 * @param {string} message
 */
export const notifyError = (message, duration = 5000) => {
  toast.error(message, {
    duration,
    icon: '❌',
    style: {
      background: '#991b1b',
      color: '#fff',
    },
  });
};

/**
 * Info/warning toast
 * @param {string} message
 */
export const notifyInfo = (message, duration = 4000) => {
  toast(message, {
    duration,
    icon: 'ℹ️',
    style: {
      background: '#1e40af',
      color: '#fff',
    },
  });
};

/**
 * Reusable Confirmation Modal
 * Usage:
 * <ConfirmDialog
 *   isOpen={isOpen}
 *   title="Delete product?"
 *   message={`Are you sure you want to delete "${productName}"? This action is irreversible.`}
 *   confirmText="Delete"
 *   cancelText="Cancel"
 *   isDangerous={true}
 *   onConfirm={() => { ... }}
 *   onCancel={() => { ... }}
 *   isLoading={false}
 * />
 */
export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDangerous = false,
  onConfirm,
  onCancel,
  isLoading = false,
  children,
}) {
  if (!isOpen) return null;

  const confirmBg = isDangerous ? '#ef4444' : '#0d9488';
  const confirmBgHover = isDangerous ? '#dc2626' : '#0d9488';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 300,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--card-bg)',
          borderRadius: '16px',
          padding: '2rem',
          maxWidth: 420,
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
          animation: 'slideUp 0.3s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <h2
          style={{
            margin: 0,
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: '0.75rem',
          }}
        >
          {title}
        </h2>

        {/* Message */}
        <p
          style={{
            margin: 0,
            fontSize: '0.875rem',
            color: 'var(--text-muted)',
            lineHeight: 1.6,
            marginBottom: '1.5rem',
          }}
        >
          {message}
        </p>

        {/* Children (extra content) */}
        {children && <div style={{ marginBottom: '1.5rem' }}>{children}</div>}

        {/* Buttons */}
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onCancel}
            disabled={isLoading}
            style={{
              padding: '0.6rem 1.2rem',
              border: '1.5px solid var(--border)',
              background: 'var(--card-bg)',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--text-muted)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            {cancelText}
          </button>

          <button
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              padding: '0.6rem 1.2rem',
              border: 'none',
              background: confirmBg,
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#fff',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              transition: 'background 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
            onMouseEnter={(e) => !isLoading && (e.target.style.background = confirmBgHover)}
            onMouseLeave={(e) => (e.target.style.background = confirmBg)}
          >
            {isLoading && (
              <span
                style={{
                  display: 'inline-block',
                  width: '0.75rem',
                  height: '0.75rem',
                  borderRadius: '50%',
                  border: '2px solid #fff',
                  borderRightColor: 'transparent',
                  animation: 'spin 0.6s linear infinite',
                }}
              />
            )}
            {confirmText}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/**
 * Order success modal (centered, with actions)
 */
export function OrderSuccessModal({
  isOpen,
  orderId,
  orderNumber,
  totalAmount,
  onViewOrder,
  onContinueShopping,
}) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 300,
      }}
    >
      <div
        style={{
          background: 'var(--card-bg)',
          borderRadius: '16px',
          padding: '2.5rem',
          maxWidth: 480,
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
          animation: 'slideUp 0.3s ease-out',
        }}
      >
        {/* Checkmark animation */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: '#dcfce7',
            margin: '0 auto 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
          }}
        >
          ✅
        </div>

        <h2
          style={{
            margin: 0,
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#042f2e',
            marginBottom: '0.5rem',
          }}
        >
          Order Placed!
        </h2>

        <p
          style={{
            margin: 0,
            fontSize: '0.875rem',
            color: '#6b7280',
            marginBottom: '1.5rem',
            lineHeight: 1.6,
          }}
        >
          Your order <strong>#{orderNumber}</strong> has been successfully placed.
          <br />
          It is currently awaiting approval from our team.
        </p>

        {/* Summary box */}
        <div
          style={{
            background: 'var(--card-bg-2)',
            borderRadius: '12px',
            padding: '1rem',
            marginBottom: '1.5rem',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginBottom: '0.35rem' }}>
            Order Total
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0d9488' }}>
            {parseFloat(totalAmount).toFixed(2)} TND
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
          <button
            onClick={onViewOrder}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #0d9488, #0891b2)',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            View my orders
          </button>

          <button
            onClick={onContinueShopping}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'var(--card-bg-2)',
              border: '1.5px solid var(--border)',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            Continue shopping
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
