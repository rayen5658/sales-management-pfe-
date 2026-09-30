import React, { useEffect, useState } from 'react';
import { LuCreditCard, LuEye, LuEyeOff, LuExternalLink, LuLandmark } from 'react-icons/lu';
import { paymentSettingsService } from '../services/api';
import '../styles/pages.css';
import './PaymentSettingsPage.css';

export default function PaymentSettingsPage() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Konnect card state ──
  const [apiKey, setApiKey] = useState('');
  const [walletId, setWalletId] = useState('');
  const [konnectEnabled, setKonnectEnabled] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [konnectSaving, setKonnectSaving] = useState(false);
  const [konnectError, setKonnectError] = useState('');
  const [konnectSuccess, setKonnectSuccess] = useState('');

  // ── Bank transfer card state ──
  const [bankName, setBankName] = useState('');
  const [bankRib, setBankRib] = useState('');
  const [bankHolder, setBankHolder] = useState('');
  const [bankInstructions, setBankInstructions] = useState('');
  const [bankEnabled, setBankEnabled] = useState(false);
  const [bankSaving, setBankSaving] = useState(false);
  const [bankError, setBankError] = useState('');
  const [bankSuccess, setBankSuccess] = useState('');

  const load = async () => {
    try {
      const r = await paymentSettingsService.get();
      setStatus(r.data);
      setKonnectEnabled(r.data.konnect_enabled);
      setBankEnabled(r.data.bank_enabled);
      setBankName(r.data.bank_name || '');
      setBankHolder(r.data.bank_holder || '');
      setBankInstructions(r.data.bank_instructions || '');
      // bank_rib is left blank in the field (not pre-filled) — same "leave blank to keep it" convention as the API key
    } catch {
      setKonnectError('Could not load payment settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const konnectConfigured = status?.has_api_key && status?.has_wallet_id;
  const bankConfigured = !!status?.bank_rib;
  const activeCount = (status?.konnect_enabled ? 1 : 0) + (status?.bank_enabled ? 1 : 0);

  const lastUpdatedLabel = status?.updated_at
    ? `${new Date(status.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} at ${new Date(status.updated_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
    : null;

  // ── Konnect save ──
  const handleToggleKonnect = () => {
    if (!(konnectConfigured || (apiKey && walletId))) return;
    if (konnectEnabled && status?.konnect_enabled) {
      if (!window.confirm('Turn off card payments? Customers will no longer see a "Pay Online" button on their orders.')) return;
    }
    setKonnectEnabled(v => !v);
  };

  const handleSaveKonnect = async (e) => {
    e.preventDefault();
    setKonnectError(''); setKonnectSuccess('');
    if (konnectEnabled && !apiKey && !status?.has_api_key) { setKonnectError('Add your Konnect API key before enabling card payments'); return; }
    if (konnectEnabled && !walletId && !status?.has_wallet_id) { setKonnectError('Add your Konnect wallet ID before enabling card payments'); return; }

    setKonnectSaving(true);
    try {
      await paymentSettingsService.update({
        api_key: apiKey || undefined,
        wallet_id: walletId || undefined,
        konnect_enabled: konnectEnabled,
        bank_enabled: status?.bank_enabled || false, // preserve the other card's setting
      });
      setApiKey(''); setWalletId('');
      setKonnectSuccess('Konnect settings saved');
      await load();
      setTimeout(() => setKonnectSuccess(''), 3000);
    } catch (err) {
      setKonnectError(err.response?.data?.message || 'Could not save Konnect settings');
    } finally {
      setKonnectSaving(false);
    }
  };

  // ── Bank transfer save ──
  const handleToggleBank = () => {
    if (!(bankConfigured || bankRib)) return;
    if (bankEnabled && status?.bank_enabled) {
      if (!window.confirm('Turn off bank transfer? Customers will no longer see it as a payment option.')) return;
    }
    setBankEnabled(v => !v);
  };

  const handleSaveBank = async (e) => {
    e.preventDefault();
    setBankError(''); setBankSuccess('');
    if (bankEnabled && !bankRib && !status?.bank_rib) { setBankError('Add your bank account RIB before enabling bank transfer'); return; }

    setBankSaving(true);
    try {
      await paymentSettingsService.update({
        konnect_enabled: status?.konnect_enabled || false, // preserve the other card's setting
        bank_name: bankName || undefined,
        bank_rib: bankRib || undefined,
        bank_holder: bankHolder || undefined,
        bank_instructions: bankInstructions || undefined,
        bank_enabled: bankEnabled,
      });
      setBankRib('');
      setBankSuccess('Bank transfer settings saved');
      await load();
      setTimeout(() => setBankSuccess(''), 3000);
    } catch (err) {
      setBankError(err.response?.data?.message || 'Could not save bank transfer settings');
    } finally {
      setBankSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div className="spinner-lg" />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Payment Settings</h1>
      </div>

      {/* ── Hero status banner ── */}
      <div className="pay-hero">
        <div className="pay-hero-left">
          <div className="pay-hero-icon"><LuCreditCard size={24} /></div>
          <div>
            <p className="pay-hero-title">Payment Methods</p>
            <p className="pay-hero-sub">
              <span className={`pulse-dot ${activeCount > 0 ? '' : 'off'}`} />
              {activeCount === 0 ? 'No payment method active yet' : `${activeCount} of 2 methods active`}
            </p>
          </div>
        </div>
        <span className="pay-hero-badge">{activeCount}/2 ACTIVE</span>
      </div>

      <div className="pay-methods-grid">
        {/* ── Konnect card ── */}
        <div className="card pay-card">
          <div className="method-header">
            <div className="method-icon konnect"><LuCreditCard size={19} /></div>
            <div>
              <p className="method-title">Card / Online (Konnect)</p>
              <span className={`method-pill ${status?.konnect_enabled ? 'on' : ''}`}>
                {status?.konnect_enabled ? 'LIVE' : konnectConfigured ? 'CONFIGURED — OFF' : 'NOT CONFIGURED'}
              </span>
            </div>
          </div>
          <p className="method-note">
            Customers pay by card or e-DINAR through{' '}
            <a href="https://konnect.network" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>
              Konnect <LuExternalLink size={11} style={{ verticalAlign: '-1px' }} />
            </a>{' '}— they handle KYC/KYB and hold the funds. Paste your API key and wallet ID once your Konnect account is approved.
          </p>

          {konnectSuccess && <div className="alert alert-success">✅ {konnectSuccess}</div>}
          {konnectError && <div className="alert alert-error">⚠ {konnectError}</div>}

          {/* autoComplete="off" on the form + "new-password" on the key field stop Chrome
              from treating this as a login form and autofilling saved credentials into it. */}
          <form onSubmit={handleSaveKonnect} autoComplete="off">
            <div className="form-group pay-field">
              <label>API Key {status?.has_api_key && <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>(saved, ending {status.api_key_last4} — leave blank to keep it)</span>}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showKey ? 'text' : 'password'}
                  name="konnect_api_key_field"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder={status?.has_api_key ? `•••• ${status.api_key_last4 || ''}` : 'Paste your Konnect API key'}
                  style={{ paddingRight: '2.5rem' }}
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-1p-ignore
                />
                <button
                  type="button"
                  onClick={() => setShowKey(v => !v)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', display: 'flex', padding: 0 }}
                  title={showKey ? 'Hide' : 'Show'}
                >
                  {showKey ? <LuEyeOff size={16} /> : <LuEye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group pay-field">
              <label>Wallet ID {status?.has_wallet_id && <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>(saved, ending {status.wallet_id_last4} — leave blank to keep it)</span>}</label>
              <input
                type="text"
                name="konnect_wallet_id_field"
                value={walletId}
                onChange={e => setWalletId(e.target.value)}
                placeholder={status?.has_wallet_id ? `•••• ${status.wallet_id_last4 || ''}` : 'Paste your Konnect wallet ID'}
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore
              />
            </div>

            <div className="toggle-row" style={{ margin: '1.1rem 0', padding: '0.75rem 0.9rem', background: 'var(--card-bg-2)', borderRadius: '10px' }}>
              <div>
                <p className="toggle-row-label">Enable card payments</p>
                <p className="toggle-row-hint">Customers will see a &quot;Pay Online&quot; button</p>
              </div>
              <div
                className={`toggle-switch light ${konnectEnabled ? 'on' : ''} ${!(konnectConfigured || (apiKey && walletId)) ? 'disabled' : ''}`}
                onClick={handleToggleKonnect}
              >
                <div className="knob" />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
              <button type="submit" className="btn btn-primary btn-pay-save" disabled={konnectSaving}>
                {konnectSaving ? 'Saving…' : 'Save'}
              </button>
              {lastUpdatedLabel && <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>Last updated {lastUpdatedLabel}</span>}
            </div>
          </form>
        </div>

        {/* ── Bank transfer card ── */}
        <div className="card pay-card">
          <div className="method-header">
            <div className="method-icon bank"><LuLandmark size={19} /></div>
            <div>
              <p className="method-title">Bank Transfer</p>
              <span className={`method-pill ${status?.bank_enabled ? 'on' : ''}`}>
                {status?.bank_enabled ? 'LIVE' : bankConfigured ? 'CONFIGURED — OFF' : 'NOT CONFIGURED'}
              </span>
            </div>
          </div>
          <p className="method-note">
            Customers see your bank details and transfer offline. Nothing is verified automatically —
            once you see the funds in your account, mark the order as paid from the Orders page.
          </p>

          {bankSuccess && <div className="alert alert-success">✅ {bankSuccess}</div>}
          {bankError && <div className="alert alert-error">⚠ {bankError}</div>}

          <form onSubmit={handleSaveBank} autoComplete="off">
            <div className="form-group pay-field">
              <label>Bank Name</label>
              <input
                type="text"
                value={bankName}
                onChange={e => setBankName(e.target.value)}
                placeholder="e.g. Biat, Attijari Bank"
              />
            </div>

            <div className="form-group pay-field">
              <label>RIB / IBAN {status?.bank_rib && <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>(saved — leave blank to keep it)</span>}</label>
              <input
                type="text"
                value={bankRib}
                onChange={e => setBankRib(e.target.value)}
                placeholder={status?.bank_rib || 'e.g. TN59 1000 6035 0000 1234 5678'}
              />
            </div>

            <div className="form-group pay-field">
              <label>Account Holder</label>
              <input
                type="text"
                value={bankHolder}
                onChange={e => setBankHolder(e.target.value)}
                placeholder="Name on the account"
              />
            </div>

            <div className="form-group pay-field">
              <label>Instructions for customers <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>(optional)</span></label>
              <textarea
                value={bankInstructions}
                onChange={e => setBankInstructions(e.target.value)}
                placeholder="e.g. Please mention your order number as the transfer reference"
                rows={2}
              />
            </div>

            <div className="toggle-row" style={{ margin: '1.1rem 0', padding: '0.75rem 0.9rem', background: 'var(--card-bg-2)', borderRadius: '10px' }}>
              <div>
                <p className="toggle-row-label">Enable bank transfer</p>
                <p className="toggle-row-hint">Customers will see it as a payment option</p>
              </div>
              <div
                className={`toggle-switch light ${bankEnabled ? 'on' : ''} ${!(bankConfigured || bankRib) ? 'disabled' : ''}`}
                onClick={handleToggleBank}
              >
                <div className="knob" />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
              <button type="submit" className="btn btn-primary btn-pay-save" disabled={bankSaving}>
                {bankSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
