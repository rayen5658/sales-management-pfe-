// ============================================================================
// UTILITAIRE UX AMÉLIORÉ - Toast & Confirmations
// ============================================================================

import { Toaster, toast } from 'react-hot-toast';

/**
 * Configuration globale des toasts (centré, avec duée longue)
 */
export function setupToasterGlobal() {
  return (
    <Toaster 
      position="top-center" 
      reverseOrder={false}
      toastOptions={{
        duration: 4000,
        style: {
          background: '#1e1b4b',
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
 * Toast de succès centrée
 * @param {string} message
 * @param {number} duration en ms (défaut: 4000)
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
 * Toast d'erreur centré
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
 * Toast d'info/warning
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
 * Composant Modal de Confirmation réutilisable
 * Usage:
 * <ConfirmDialog
 *   isOpen={isOpen}
 *   title="Supprimer produit?"
 *   message={`Êtes-vous sûr de supprimer "${productName}"? Cette action est irréversible.`}
 *   confirmText="Supprimer"
 *   cancelText="Annuler"
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
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  isDangerous = false,
  onConfirm,
  onCancel,
  isLoading = false,
  children,
}) {
  if (!isOpen) return null;

  const confirmBg = isDangerous ? '#ef4444' : '#4f46e5';
  const confirmBgHover = isDangerous ? '#dc2626' : '#6366f1';

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
          background: '#fff',
          borderRadius: '16px',
          padding: '2rem',
          maxWidth: 420,
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
          animation: 'slideUp 0.3s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Titre */}
        <h2
          style={{
            margin: 0,
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#1e1b4b',
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
            color: '#6b7280',
            lineHeight: 1.6,
            marginBottom: '1.5rem',
          }}
        >
          {message}
        </p>

        {/* Children (extra content) */}
        {children && <div style={{ marginBottom: '1.5rem' }}>{children}</div>}

        {/* Boutons */}
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
              border: '1.5px solid #e2e8f0',
              background: '#fff',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#374151',
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
 * Modal de succès commande (centré, avec actions)
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
          background: '#fff',
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
            color: '#1e1b4b',
            marginBottom: '0.5rem',
          }}
        >
          Commande créée !
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
          Votre commande <strong>#{orderNumber}</strong> a été enregistrée avec succès.
          <br />
          Elle est actuellement en attente d'approbation de notre équipe.
        </p>

        {/* Summary box */}
        <div
          style={{
            background: '#f8fafc',
            borderRadius: '12px',
            padding: '1rem',
            marginBottom: '1.5rem',
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.35rem' }}>
            Montant total
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#4f46e5' }}>
            {parseFloat(totalAmount).toFixed(2)} TND
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
          <button
            onClick={onViewOrder}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Voir mes commandes
          </button>

          <button
            onClick={onContinueShopping}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#f1f5f9',
              border: '1.5px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#374151',
              cursor: 'pointer',
            }}
          >
            Continuer mon shopping
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
