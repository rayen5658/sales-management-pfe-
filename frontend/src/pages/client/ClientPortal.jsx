import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuShoppingCart, LuPlus, LuMinus, LuTrash2, LuLogOut, LuClock, LuSearch, LuMapPin, LuPhone, LuUser, LuFileText, LuChevronRight, LuCheck, LuTriangleAlert } from 'react-icons/lu';
import { useClientAuthStore } from '../../stores/clientAuthStore';
import { clientPortalService } from '../../services/clientApi';
import { ConfirmDialog, OrderSuccessModal, notifySuccess, notifyError, setupToasterGlobal } from '../../utils/uxHelpers';
import ClientChatBot from '../../components/ClientChatBot';
import AppLogo from '../../components/common/AppLogo';
import DarkModeToggle from '../../components/common/DarkModeToggle';

import { CART_STORAGE_KEY } from '../../utils/constants';
const REGIONS = ['Tunis','Ariana','Ben Arous','Manouba','Nabeul','Zaghouan','Bizerte','Béja','Jendouba','Le Kef','Siliana','Sousse','Monastir','Mahdia','Sfax','Kairouan','Kasserine','Sidi Bouzid','Gabès','Medenine','Tataouine','Gafsa','Tozeur','Kebili'];

const fmt = v => parseFloat(v || 0).toFixed(2) + ' TND';

// Cart entries are keyed by product+variant so the same product with two different
// variants (or the base product alongside a variant) can coexist as separate lines.
const cartKey = (productId, variantId) => variantId ? `${productId}:${variantId}` : `${productId}`;
const linePrice = (product, variant) => parseFloat(variant ? variant.unit_price : product.unit_price);
const lineStock = (product, variant) => variant ? variant.stock : product.stock;
const lineName  = (product, variant) => variant ? `${product.name} — ${variant.name}` : product.name;

export default function ClientPortal() {
  const navigate = useNavigate();
  const { client, logout } = useClientAuthStore();

  const [products, setProducts]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filterCat, setFilterCat]   = useState('');
  const [minPrice, setMinPrice]     = useState('');
  const [maxPrice, setMaxPrice]     = useState('');
  const [priceInput, setPriceInput] = useState({ min: '', max: '' }); // local slider state
  const [relatedProducts, setRelatedProducts] = useState([]);

  // ✨ Cart persisted in localStorage
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [notes, setNotes] = useState('');

  // Show "cart restored" toast on mount if cart has items
  useEffect(() => {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    if (saved) {
      const items = Object.values(JSON.parse(saved));
      if (items.length > 0) {
        setTimeout(() => notifySuccess(`Cart restored — ${items.length} item(s) ready`), 800);
      }
    }
  }, []);

  const [placing, setPlacing]   = useState(false);
  const [error, setError]       = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ── Checkout modal ─────────────────────────────────────────────────────────
  const [checkoutOpen, setCheckoutOpen]   = useState(false);
  const [checkoutStep, setCheckoutStep]   = useState(1); // 1=summary 2=delivery 3=review
  const [delivery, setDelivery] = useState({
    contact_name: '',
    contact_phone: '',
    address: '',
    region: '',
    notes: '',
  });

  // ✨ Order success modal
  const [successOrder, setSuccessOrder] = useState(null);
  const [productModal, setProductModal] = useState(null);
  const [modalVariants, setModalVariants] = useState([]);
  const [selectedVariantId, setSelectedVariantId] = useState(null);

  // Load variants when modal opens for a product that has them
  useEffect(() => {
    if (!productModal || !productModal.has_variants) { setModalVariants([]); setSelectedVariantId(null); return; }
    setSelectedVariantId(null);
    clientPortalService.getVariants(productModal.id)
      .then(r => { setModalVariants(r.data); if (r.data.length > 0) setSelectedVariantId(r.data[0].id); })
      .catch(() => setModalVariants([]));
  }, [productModal]);

  // Load related products when modal opens
  useEffect(() => {
    if (!productModal) { setRelatedProducts([]); return; }
    clientPortalService.getRelated(productModal.id)
      .then(r => setRelatedProducts(r.data))
      .catch(() => setRelatedProducts([]));
  }, [productModal]);


  // ✨ Persist cart in localStorage on every change
  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  // Load categories once on mount; products are loaded by the search/filter effect below
  useEffect(() => {
    clientPortalService.getCategories()
      .then(c => setCategories(c.data))
      .catch(() => setError('Error loading categories'))
      .finally(() => setLoading(false));
  }, []);

  // Fetch products whenever search, category, or price filter changes
  useEffect(() => {
    const params = {};
    if (search)    params.search = search;
    if (filterCat) params.category_id = filterCat;
    if (minPrice)  params.min_price = minPrice;
    if (maxPrice)  params.max_price = maxPrice;
    clientPortalService.getProducts(params)
      .then(r => setProducts(r.data))
      .catch(() => {});
  }, [search, filterCat, minPrice, maxPrice]);

  const addToCart = (product, variant = null) => {
    const key = cartKey(product.id, variant?.id);
    setCart(prev => ({
      ...prev,
      [key]: {
        product,
        variant,
        quantity: (prev[key]?.quantity || 0) + 1,
      },
    }));
    // ✨ Toast notification
    notifySuccess(`✨ "${lineName(product, variant)}" added to cart!`);
  };

  const updateQty = (key, qty) => {
    if (qty <= 0) {
      removeFromCart(key);
      return;
    }
    setCart(prev => ({
      ...prev,
      [key]: { ...prev[key], quantity: qty },
    }));
  };

  const removeFromCart = (key) => {
    const entry = cart[key];
    setCart(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    notifySuccess(`"${entry ? lineName(entry.product, entry.variant) : 'Product'}" removed from cart`);
  };

  const cartItems = Object.entries(cart).map(([key, entry]) => ({ key, ...entry }));
  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);
  const cartHT    = cartItems.reduce((s, i) => s + linePrice(i.product, i.variant) * i.quantity, 0);
  const cartTVA   = cartHT * 0.19;
  const cartTTC   = cartHT + cartTVA;

  const openCheckout = () => {
    setDelivery({
      contact_name:  client?.company_name || '',
      contact_phone: client?.phone        || '',
      address:       client?.address      || '',
      region:        client?.region       || '',
      notes:         notes,
    });
    setCheckoutStep(1);
    setError('');
    setCheckoutOpen(true);
  };

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) return;
    setPlacing(true);
    setError('');
    try {
      const deliveryNote = [
        `Contact: ${delivery.contact_name}`,
        delivery.contact_phone ? `Phone: ${delivery.contact_phone}` : '',
        delivery.address       ? `Address: ${delivery.address}`     : '',
        delivery.region        ? `Region: ${delivery.region}`       : '',
        delivery.notes         ? `Notes: ${delivery.notes}`         : '',
      ].filter(Boolean).join(' | ');

      const response = await clientPortalService.placeOrder({
        items: cartItems.map(i => ({ product_id: i.product.id, variant_id: i.variant?.id || null, quantity: i.quantity })),
        notes: deliveryNote,
      });
      
      // ✨ Show order success modal with order number
      setSuccessOrder({
        id: response.data?.order?.id,
        number: response.data?.order?.id || 'N/A',
        totalAmount: cartTTC,
      });

      // Clear cart and close all modals
      setCart({});
      setNotes('');
      setCartOpen(false);
      setConfirmOpen(false);
      setCheckoutOpen(false);
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Error placing the order. Please try again.';
      setError(errMsg);
      notifyError(errMsg);
    } finally {
      setPlacing(false);
    }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const filtered = products; // already filtered server-side

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* ✨ Setup toaster global */}
      {setupToasterGlobal()}

      {/* ── Top bar ── */}
      <header className="cp-header" style={{
        background: 'var(--card-bg)', borderBottom: '1px solid var(--border)',
        padding: '0 1.5rem', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
      }}>
        <div className="cp-header-left" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
          <AppLogo size={30} showText={true} />
          <div className="cp-header-divider" style={{ width: 1, height: 28, background: 'var(--border)', margin: '0 0.25rem' }} />
          <div className="cp-header-company" style={{ minWidth: 0 }}>
            <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {client?.company_name}
            </p>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>Client Portal</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
          <DarkModeToggle size={36} />
          <button
            className="cp-header-btn"
            onClick={() => navigate('/client/orders')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 0.9rem', border: '1.5px solid var(--border)',
              borderRadius: '8px', background: 'var(--card-bg)', cursor: 'pointer',
              fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)',
              minHeight: '36px',
            }}
          >
            <LuClock size={14} /> <span className="cp-header-btn-label">My Orders</span>
          </button>

          {/* Cart button */}
          <button
            className="cp-header-btn"
            onClick={() => setCartOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 0.9rem',
              background: cartCount > 0 ? 'linear-gradient(135deg,#0d9488,#0891b2)' : 'var(--card-bg-2)',
              color: cartCount > 0 ? '#fff' : 'var(--text-muted)',
              border: 'none', borderRadius: '8px', cursor: 'pointer',
              fontSize: '0.8rem', fontWeight: 700,
              boxShadow: cartCount > 0 ? '0 4px 12px rgba(13,148,136,0.3)' : 'none',
              transition: 'all 0.2s',
              minHeight: '36px',
            }}
          >
            <LuShoppingCart size={14} />
            <span className="cp-header-btn-label">Cart </span>
            {cartCount > 0 && <span>({cartCount})</span>}
          </button>

          <button
            onClick={handleLogout}
            title="Log out"
            style={{
              padding: '0.5rem 0.6rem', border: '1.5px solid var(--border)',
              borderRadius: '8px', background: 'var(--card-bg)', cursor: 'pointer', color: 'var(--text-muted)',
              minHeight: '36px', minWidth: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <LuLogOut size={14} />
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem' }}>

        {/* ── Filters bar ── */}
        <div style={{ marginBottom: '1.5rem' }}>
          {/* Row 1: Search + Price range */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <LuSearch size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search products..."
                style={{
                  width: '100%', padding: '0.6rem 0.75rem 0.6rem 2.25rem',
                  border: '1.5px solid var(--border)', borderRadius: '8px',
                  fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box',
                  background: 'var(--card-bg)',
                }}
              />
            </div>

            {/* Price range inputs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--card-bg)', border: '1.5px solid var(--border)', borderRadius: '8px', padding: '0 0.75rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>💰 Price</span>
              <input
                type="number"
                min="0"
                placeholder="Min"
                value={priceInput.min}
                onChange={e => setPriceInput(p => ({ ...p, min: e.target.value }))}
                onBlur={() => setMinPrice(priceInput.min)}
                onKeyDown={e => e.key === 'Enter' && setMinPrice(priceInput.min)}
                style={{ width: 70, border: 'none', outline: 'none', fontSize: '0.82rem', textAlign: 'center', padding: '0.5rem 0' }}
              />
              <span style={{ color: '#d1d5db' }}>—</span>
              <input
                type="number"
                min="0"
                placeholder="Max"
                value={priceInput.max}
                onChange={e => setPriceInput(p => ({ ...p, max: e.target.value }))}
                onBlur={() => setMaxPrice(priceInput.max)}
                onKeyDown={e => e.key === 'Enter' && setMaxPrice(priceInput.max)}
                style={{ width: 70, border: 'none', outline: 'none', fontSize: '0.82rem', textAlign: 'center', padding: '0.5rem 0' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>TND</span>
              {(minPrice || maxPrice) && (
                <button
                  onClick={() => { setMinPrice(''); setMaxPrice(''); setPriceInput({ min: '', max: '' }); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.85rem', padding: '0 0.2rem', lineHeight: 1 }}
                  title="Clear price filter"
                >✕</button>
              )}
            </div>
          </div>

          {/* Row 2: Category pills */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)', fontWeight: 600, marginRight: '0.25rem' }}>Category:</span>
            <button
              onClick={() => setFilterCat('')}
              style={{
                padding: '0.3rem 0.85rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                border: filterCat === '' ? '2px solid #0d9488' : '1.5px solid var(--border)',
                background: filterCat === '' ? '#0d9488' : 'var(--card-bg)',
                color: filterCat === '' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}
            >All</button>
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setFilterCat(filterCat === String(c.id) ? '' : String(c.id))}
                style={{
                  padding: '0.3rem 0.85rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                  border: filterCat === String(c.id) ? '2px solid #0d9488' : '1.5px solid var(--border)',
                  background: filterCat === String(c.id) ? '#0d9488' : 'var(--card-bg)',
                  color: filterCat === String(c.id) ? '#fff' : 'var(--text-muted)',
                  transition: 'all 0.15s',
                }}
              >{c.name}</button>
            ))}
            {/* Active filter summary */}
            {(filterCat || minPrice || maxPrice || search) && (
              <button
                onClick={() => { setFilterCat(''); setMinPrice(''); setMaxPrice(''); setPriceInput({ min: '', max: '' }); setSearch(''); }}
                style={{
                  marginLeft: 'auto', padding: '0.3rem 0.75rem', borderRadius: '999px',
                  fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                  border: '1.5px solid #fecaca', background: '#fef2f2', color: '#ef4444',
                }}
              >✕ Clear all filters</button>
            )}
          </div>

          {/* Active filter tags */}
          {(minPrice || maxPrice) && (
            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>Active:</span>
              <span style={{ fontSize: '0.75rem', background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', borderRadius: '999px', padding: '0.15rem 0.65rem', fontWeight: 600 }}>
                💰 {minPrice || '0'} – {maxPrice || '∞'} TND
              </span>
            </div>
          )}
        </div>

        {/* Product grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-faint)' }}>Loading products...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-faint)' }}>
            <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</p>
            <p style={{ fontWeight: 600 }}>No products found</p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Try adjusting your filters</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '1rem',
          }}>
            {filtered.map(product => {
              const inCart = cart[cartKey(product.id)]?.quantity || 0;
              return (
                <div key={product.id} style={{
                  background: 'var(--card-bg)', borderRadius: '12px',
                  border: inCart > 0 ? '2px solid #0d9488' : '1px solid var(--border)',
                  padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem',
                  boxShadow: inCart > 0 ? '0 4px 16px rgba(13,148,136,0.12)' : '0 1px 4px rgba(0,0,0,0.04)',
                  transition: 'all 0.2s',
                }}>
                  {/* Product image */}
                  <div style={{
                    width: '100%', height: 140,
                    background: 'var(--card-bg-2)', borderRadius: '8px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', border: '1px solid var(--border)',
                  }}>
                    <img
                      src={product.image || ''}
                      alt={product.name}
                      onError={e => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextSibling.style.display = 'flex';
                      }}
                      style={{
                        maxWidth: '100%', maxHeight: '100%',
                        objectFit: 'contain', display: product.image ? 'block' : 'none',
                      }}
                    />
                    <div style={{
                      display: product.image ? 'none' : 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      fontSize: '2.5rem', color: '#cbd5e1',
                    }}>📦</div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', margin: 0, lineHeight: 1.3 }}>
                        {product.name}
                      </h3>
                      {inCart > 0 && (
                        <span style={{
                          background: '#0d9488', color: '#fff',
                          borderRadius: '999px', padding: '0.1rem 0.5rem',
                          fontSize: '0.7rem', fontWeight: 700, flexShrink: 0, marginLeft: '0.5rem',
                        }}>
                          {inCart} in cart
                        </span>
                      )}
                    </div>
                    {product.reference && (
                      <code style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--border)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                        {product.reference}
                      </code>
                    )}
                    {product.category_name && (
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.3rem 0 0' }}>{product.category_name}</p>
                    )}
                  </div>

                    {product.description && (
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                      {product.description.length > 80 ? product.description.slice(0, 80) + '…' : product.description}
                    </p>
                  )}

                  <button
                    onClick={() => setProductModal(product)}
                    style={{
                      marginTop: '0.25rem',
                      background: 'var(--card-bg, #fff)',
                      border: '1.5px solid var(--border, var(--border))',
                      borderRadius: '8px',
                      padding: '0.45rem 0.65rem',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: 'var(--text, var(--text-muted))',
                    }}
                    title='View details'
                  >
                    View details
                  </button>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                    <div>
                      <p style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0d9488', margin: 0 }}>
                        {product.has_variants ? 'From ' : ''}{fmt(product.unit_price)}
                      </p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-faint)', margin: 0 }}>
                        {product.has_variants ? 'Multiple options available' : `Stock: ${product.stock} units`}
                      </p>
                    </div>

                    {product.has_variants ? (
                      <button
                        onClick={() => setProductModal(product)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.3rem',
                          padding: '0.5rem 0.9rem',
                          background: 'linear-gradient(135deg,#0d9488,#0891b2)',
                          color: '#fff', border: 'none', borderRadius: '8px',
                          fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                          minHeight: '32px',
                        }}
                      >
                        Select options
                      </button>
                    ) : inCart === 0 ? (
                      <button
                        onClick={() => addToCart(product)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.3rem',
                          padding: '0.5rem 0.9rem',
                          background: 'linear-gradient(135deg,#0d9488,#0891b2)',
                          color: '#fff', border: 'none', borderRadius: '8px',
                          fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                          minHeight: '32px',
                        }}
                      >
                        <LuPlus size={13} /> Add to cart
                      </button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button
                          onClick={() => updateQty(cartKey(product.id), inCart - 1)}
                          style={{
                            width: 32, height: 32, borderRadius: '6px',
                            border: '1.5px solid var(--border, var(--border))',
                            background: 'var(--card-bg, #fff)',
                            color: 'var(--text, var(--text-muted))',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        ><LuMinus size={13} /></button>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', minWidth: 24, textAlign: 'center' }}>{inCart}</span>
                        <button
                          onClick={() => updateQty(cartKey(product.id), inCart + 1)}
                          disabled={inCart >= product.stock}
                          style={{
                            width: 32, height: 32, borderRadius: '6px',
                            border: '1.5px solid #0d9488', background: '#0d9488',
                            cursor: inCart >= product.stock ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                            opacity: inCart >= product.stock ? 0.5 : 1,
                          }}
                        ><LuPlus size={13} /></button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Cart Drawer ── */}
      {cartOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }}
          onClick={() => setCartOpen(false)}
        >
          <div
            style={{
              position: 'absolute', right: 0, top: 0, bottom: 0, width: '100%', maxWidth: 420,
              background: 'var(--card-bg)', display: 'flex', flexDirection: 'column',
              boxShadow: '-8px 0 40px rgba(0,0,0,0.15)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div style={{
              padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)' }}>
                🛒 Your Cart {cartCount > 0 && <span style={{ color: '#0d9488' }}>({cartCount})</span>}
              </h2>
              <button onClick={() => setCartOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-muted)' }}>✕</button>
            </div>

            {/* Cart items */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
              {cartItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-faint)' }}>
                  <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🛒</p>
                  <p>Your cart is empty</p>
                </div>
              ) : (
                cartItems.map(({ key, product, variant, quantity }) => {
                  const price = linePrice(product, variant);
                  const stock = lineStock(product, variant);
                  return (
                    <div key={key} style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.85rem 0', borderBottom: '1px solid var(--border)',
                    }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: 0, color: 'var(--text)' }}>{product.name}</p>
                        {variant && <p style={{ fontSize: '0.72rem', color: '#0d9488', margin: '0.1rem 0 0', fontWeight: 600 }}>{variant.name}</p>}
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.15rem 0 0' }}>
                          {fmt(price)} × {quantity} = <strong style={{ color: '#0d9488' }}>{fmt(price * quantity)}</strong>
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <button onClick={() => updateQty(key, quantity - 1)} style={{ width: 26, height: 26, borderRadius: '6px', border: '1.5px solid var(--border)', background: 'var(--card-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LuMinus size={11} /></button>
                        <span style={{ fontWeight: 700, fontSize: '0.875rem', minWidth: 18, textAlign: 'center' }}>{quantity}</span>
                        <button onClick={() => updateQty(key, quantity + 1)} disabled={quantity >= stock} style={{ width: 26, height: 26, borderRadius: '6px', border: '1.5px solid #0d9488', background: '#0d9488', cursor: quantity >= stock ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', opacity: quantity >= stock ? 0.5 : 1 }}><LuPlus size={11} /></button>
                        <button onClick={() => removeFromCart(key)} style={{ width: 26, height: 26, borderRadius: '6px', border: '1.5px solid #fee2e2', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', marginLeft: '0.2rem' }}><LuTrash2 size={11} /></button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Order summary + place order */}
            {cartItems.length > 0 && (
              <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border)' }}>
                <div style={{ background: 'var(--card-bg-2)', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
                  {[
                    ['Subtotal (ex. tax)', fmt(cartHT)],
                    ['Tax (19%)',          fmt(cartTVA)],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>
                      <span>{label}</span><span>{value}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid var(--border)', fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>
                    <span>Total (inc. tax)</span>
                    <span style={{ color: '#0d9488' }}>{fmt(cartTTC)}</span>
                  </div>
                </div>

                <div style={{ marginBottom: '0.85rem' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                    Delivery Notes (optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Special instructions, specific requests..."
                    rows={2}
                    style={{
                      width: '100%', padding: '0.6rem 0.75rem', border: '1.5px solid var(--border)',
                      borderRadius: '8px', fontSize: '0.8rem', resize: 'vertical',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>

                {error && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.6rem 0.85rem', marginBottom: '0.75rem', color: '#991b1b', fontSize: '0.8rem' }}>
                    ⚠ {error}
                  </div>
                )}

                <button
                  onClick={openCheckout}
                  disabled={placing}
                  style={{
                    width: '100%', padding: '0.85rem',
                    background: 'linear-gradient(135deg,#0d9488,#0891b2)',
                    color: '#fff', border: 'none', borderRadius: '10px',
                    fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(13,148,136,0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  }}
                >
                  Checkout <LuChevronRight size={16} />
                </button>
                <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: '0.5rem' }}>
                  Order will be confirmed by our team
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      {/* ── 3-Step Checkout Modal ── */}
      {checkoutOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}
          onClick={() => !placing && setCheckoutOpen(false)}>
          <div style={{ background:'var(--card-bg)', borderRadius:'20px', width:'100%', maxWidth:520, boxShadow:'0 32px 80px rgba(0,0,0,0.22)', overflow:'hidden', maxHeight:'90vh', display:'flex', flexDirection:'column' }}
            onClick={e => e.stopPropagation()}>

            {/* ── Header with step indicator ── */}
            <div style={{ background:'linear-gradient(135deg,#0d9488,#0891b2)', padding:'1.25rem 1.5rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
                <h2 style={{ margin:0, color:'#fff', fontSize:'1.05rem', fontWeight:800 }}>Checkout</h2>
                <button onClick={() => setCheckoutOpen(false)} disabled={placing}
                  style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'8px', color:'#fff', width:30, height:30, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem' }}>✕</button>
              </div>
              {/* Step pills */}
              <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
                {[{n:1,label:'Summary'},{n:2,label:'Delivery'},{n:3,label:'Confirm'}].map(({n,label},i,arr) => (
                  <React.Fragment key={n}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', cursor: n < checkoutStep ? 'pointer' : 'default' }}
                      onClick={() => n < checkoutStep && setCheckoutStep(n)}>
                      <div style={{
                        width:24, height:24, borderRadius:'50%',
                        background: checkoutStep > n ? 'rgba(255,255,255,0.9)' : checkoutStep === n ? '#fff' : 'rgba(255,255,255,0.25)',
                        color: checkoutStep > n ? '#0d9488' : checkoutStep === n ? '#0d9488' : 'rgba(255,255,255,0.7)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:'0.72rem', fontWeight:800,
                      }}>
                        {checkoutStep > n ? <LuCheck size={13} /> : n}
                      </div>
                      <span style={{ fontSize:'0.75rem', fontWeight:600, color: checkoutStep === n ? '#fff' : 'rgba(255,255,255,0.65)' }}>{label}</span>
                    </div>
                    {i < arr.length-1 && <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.25)' }} />}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* ── Step content ── */}
            <div style={{ flex:1, overflowY:'auto' }}>

              {/* STEP 1 — Order Summary */}
              {checkoutStep === 1 && (
                <div style={{ padding:'1.25rem 1.5rem' }}>
                  <p style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--text-faint)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.75rem' }}>
                    {cartItems.length} item{cartItems.length > 1 ? 's' : ''} in your order
                  </p>

                  {/* Stock warnings */}
                  {cartItems.some(({product, variant, quantity}) => quantity > lineStock(product, variant)) && (
                    <div style={{ background:'#fffbeb', border:'1.5px solid #fcd34d', borderRadius:'10px', padding:'0.65rem 0.9rem', marginBottom:'0.85rem', display:'flex', gap:'0.6rem', alignItems:'flex-start' }}>
                      <LuTriangleAlert size={16} style={{ color:'#d97706', flexShrink:0, marginTop:'0.1rem' }} />
                      <div>
                        <p style={{ margin:0, fontWeight:700, fontSize:'0.82rem', color:'#92400e' }}>Stock limit reached for some items</p>
                        <p style={{ margin:'0.2rem 0 0', fontSize:'0.76rem', color:'#b45309' }}>
                          Quantities have been adjusted to available stock. Please review below.
                        </p>
                      </div>
                    </div>
                  )}

                  <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', marginBottom:'1rem' }}>
                    {cartItems.map(({key, product, variant, quantity}) => {
                      const price = linePrice(product, variant);
                      const stock = lineStock(product, variant);
                      const stockOk = quantity <= stock;
                      const effectiveQty = Math.min(quantity, stock);
                      return (
                        <div key={key} style={{
                          display:'flex', alignItems:'center', gap:'0.75rem',
                          background: stockOk ? 'var(--card-bg-2)' : '#fffbeb',
                          borderRadius:'10px', padding:'0.65rem 0.85rem',
                          border: stockOk ? '1px solid var(--border)' : '1.5px solid #fcd34d',
                        }}>
                          <div style={{ width:40, height:40, borderRadius:'8px', background:'var(--card-bg)', border:'1px solid var(--border)', flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
                            {product.image
                              ? <img src={product.image} alt={product.name} style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }} onError={e => { e.currentTarget.style.display='none'; }} />
                              : <LuFileText size={16} style={{ color:'#cbd5e1' }} />}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <p style={{ margin:0, fontWeight:700, fontSize:'0.85rem', color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {product.name}{variant && <span style={{ color: '#0d9488', fontWeight: 600 }}> — {variant.name}</span>}
                            </p>
                            <p style={{ margin:0, fontSize:'0.75rem', color: stockOk ? 'var(--text-muted)' : '#b45309' }}>
                              {fmt(price)} × {effectiveQty}
                              {!stockOk && <span style={{ marginLeft:'0.4rem', background:'#fef3c7', color:'#92400e', padding:'0.1rem 0.4rem', borderRadius:'4px', fontSize:'0.68rem', fontWeight:700 }}>
                                Max: {stock}
                              </span>}
                            </p>
                          </div>
                          <span style={{ fontWeight:800, color: stockOk ? '#0d9488' : '#b45309', fontSize:'0.9rem', flexShrink:0 }}>
                            {fmt(price * effectiveQty)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Totals */}
                  <div style={{ background:'var(--card-bg-2)', borderRadius:'12px', padding:'0.85rem 1rem', border:'1px solid var(--border)' }}>
                    {[['Subtotal (ex. tax)', fmt(cartHT)],['Tax (19%)', fmt(cartTVA)]].map(([l,v]) => (
                      <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:'0.8rem', color:'var(--text-muted)', marginBottom:'0.35rem' }}>
                        <span>{l}</span><span>{v}</span>
                      </div>
                    ))}
                    <div style={{ display:'flex', justifyContent:'space-between', paddingTop:'0.5rem', borderTop:'1px solid var(--border)', fontWeight:800, fontSize:'1rem', color:'var(--text)' }}>
                      <span>Total (inc. tax)</span>
                      <span style={{ color:'#0d9488' }}>{fmt(cartTTC)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2 — Delivery Info */}
              {checkoutStep === 2 && (
                <div style={{ padding:'1.25rem 1.5rem' }}>
                  <p style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--text-faint)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'1rem' }}>
                    Delivery & Contact Information
                  </p>

                  {/* Contact name */}
                  <div style={{ marginBottom:'0.85rem' }}>
                    <label style={{ display:'flex', alignItems:'center', gap:'0.35rem', fontSize:'0.78rem', fontWeight:700, color:'var(--text-muted)', marginBottom:'0.4rem' }}>
                      <LuUser size={13} /> Contact Name *
                    </label>
                    <input
                      value={delivery.contact_name}
                      onChange={e => setDelivery(d => ({...d, contact_name: e.target.value}))}
                      placeholder="Company or contact name"
                      style={{ width:'100%', padding:'0.65rem 0.85rem', border:'1.5px solid var(--border)', borderRadius:'10px', fontSize:'0.875rem', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }}
                      onFocus={e => e.target.style.borderColor='#0d9488'}
                      onBlur={e => e.target.style.borderColor='var(--border)'}
                    />
                  </div>

                  {/* Phone */}
                  <div style={{ marginBottom:'0.85rem' }}>
                    <label style={{ display:'flex', alignItems:'center', gap:'0.35rem', fontSize:'0.78rem', fontWeight:700, color:'var(--text-muted)', marginBottom:'0.4rem' }}>
                      <LuPhone size={13} /> Phone *
                    </label>
                    <input
                      value={delivery.contact_phone}
                      onChange={e => setDelivery(d => ({...d, contact_phone: e.target.value}))}
                      placeholder="+216 XX XXX XXX"
                      style={{ width:'100%', padding:'0.65rem 0.85rem', border:'1.5px solid var(--border)', borderRadius:'10px', fontSize:'0.875rem', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }}
                      onFocus={e => e.target.style.borderColor='#0d9488'}
                      onBlur={e => e.target.style.borderColor='var(--border)'}
                    />
                  </div>

                  {/* Address */}
                  <div style={{ marginBottom:'0.85rem' }}>
                    <label style={{ display:'flex', alignItems:'center', gap:'0.35rem', fontSize:'0.78rem', fontWeight:700, color:'var(--text-muted)', marginBottom:'0.4rem' }}>
                      <LuMapPin size={13} /> Delivery Address *
                    </label>
                    <input
                      value={delivery.address}
                      onChange={e => setDelivery(d => ({...d, address: e.target.value}))}
                      placeholder="Street, building, floor..."
                      style={{ width:'100%', padding:'0.65rem 0.85rem', border:'1.5px solid var(--border)', borderRadius:'10px', fontSize:'0.875rem', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }}
                      onFocus={e => e.target.style.borderColor='#0d9488'}
                      onBlur={e => e.target.style.borderColor='var(--border)'}
                    />
                  </div>

                  {/* Region */}
                  <div style={{ marginBottom:'0.85rem' }}>
                    <label style={{ display:'flex', alignItems:'center', gap:'0.35rem', fontSize:'0.78rem', fontWeight:700, color:'var(--text-muted)', marginBottom:'0.4rem' }}>
                      <LuMapPin size={13} /> Region *
                    </label>
                    <select
                      value={delivery.region}
                      onChange={e => setDelivery(d => ({...d, region: e.target.value}))}
                      style={{ width:'100%', padding:'0.65rem 0.85rem', border:'1.5px solid var(--border)', borderRadius:'10px', fontSize:'0.875rem', outline:'none', boxSizing:'border-box', fontFamily:'inherit', background:'var(--card-bg)' }}
                    >
                      <option value="">-- Select region --</option>
                      {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>

                  {/* Notes */}
                  <div>
                    <label style={{ display:'flex', alignItems:'center', gap:'0.35rem', fontSize:'0.78rem', fontWeight:700, color:'var(--text-muted)', marginBottom:'0.4rem' }}>
                      <LuFileText size={13} /> Order Notes (optional)
                    </label>
                    <textarea
                      value={delivery.notes}
                      onChange={e => setDelivery(d => ({...d, notes: e.target.value}))}
                      placeholder="Special instructions, delivery time preference..."
                      rows={3}
                      style={{ width:'100%', padding:'0.65rem 0.85rem', border:'1.5px solid var(--border)', borderRadius:'10px', fontSize:'0.875rem', outline:'none', resize:'vertical', boxSizing:'border-box', fontFamily:'inherit' }}
                      onFocus={e => e.target.style.borderColor='#0d9488'}
                      onBlur={e => e.target.style.borderColor='var(--border)'}
                    />
                  </div>
                </div>
              )}

              {/* STEP 3 — Review & Confirm */}
              {checkoutStep === 3 && (
                <div style={{ padding:'1.25rem 1.5rem' }}>
                  <p style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--text-faint)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'1rem' }}>
                    Review your order
                  </p>

                  {/* Delivery summary card */}
                  <div style={{ background:'var(--card-bg-2)', borderRadius:'12px', padding:'1rem', border:'1px solid var(--border)', marginBottom:'1rem' }}>
                    <p style={{ fontSize:'0.7rem', fontWeight:700, color:'var(--text-faint)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.65rem' }}>Delivery Details</p>
                    {[
                      ['Contact',  delivery.contact_name  || '—'],
                      ['Phone',    delivery.contact_phone || '—'],
                      ['Address',  delivery.address       || '—'],
                      ['Region',   delivery.region        || '—'],
                      ...(delivery.notes ? [['Notes', delivery.notes]] : []),
                    ].map(([label, value]) => (
                      <div key={label} style={{ display:'flex', gap:'0.5rem', marginBottom:'0.4rem', fontSize:'0.82rem' }}>
                        <span style={{ color:'var(--text-muted)', fontWeight:600, minWidth:70 }}>{label}:</span>
                        <span style={{ color:'var(--text)', fontWeight:500 }}>{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Order totals */}
                  <div style={{ background:'linear-gradient(135deg,#f0fdfa,#ecfeff)', borderRadius:'12px', padding:'1rem', border:'1px solid #99f6e4' }}>
                    <p style={{ fontSize:'0.7rem', fontWeight:700, color:'#0d9488', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.65rem' }}>Order Total</p>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.82rem', color:'var(--text-muted)', marginBottom:'0.3rem' }}>
                      <span>Items ({cartCount})</span><span>{fmt(cartHT)}</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.82rem', color:'var(--text-muted)', marginBottom:'0.5rem' }}>
                      <span>Tax (19%)</span><span>{fmt(cartTVA)}</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', paddingTop:'0.5rem', borderTop:'1px solid #99f6e4', fontWeight:900, fontSize:'1.1rem' }}>
                      <span style={{ color:'#0d9488' }}>Total</span>
                      <span style={{ color:'#0d9488' }}>{fmt(cartTTC)}</span>
                    </div>
                  </div>

                  {error && (
                    <div style={{ marginTop:'0.85rem', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'10px', padding:'0.65rem 0.85rem', color:'#991b1b', fontSize:'0.82rem' }}>
                      ⚠ {error}
                    </div>
                  )}

                  <p style={{ fontSize:'0.75rem', color:'var(--text-faint)', marginTop:'1rem', textAlign:'center', lineHeight:1.5 }}>
                    By confirming, your order will be sent to our team for review. You will receive a confirmation once it's approved.
                  </p>
                </div>
              )}
            </div>

            {/* ── Footer navigation ── */}
            <div style={{ padding:'1rem 1.5rem', borderTop:'1px solid var(--border)', display:'flex', gap:'0.75rem', background:'var(--card-bg)' }}>
              {checkoutStep > 1 && (
                <button
                  onClick={() => setCheckoutStep(s => s - 1)}
                  disabled={placing}
                  style={{ padding:'0.7rem 1.25rem', border:'1.5px solid var(--border)', borderRadius:'10px', background:'var(--card-bg)', cursor:'pointer', fontSize:'0.875rem', fontWeight:600, color:'var(--text-muted)' }}
                >
                  ← Back
                </button>
              )}

              {checkoutStep < 3 ? (
                <button
                  onClick={() => {
                    if (checkoutStep === 2) {
                      if (!delivery.contact_name.trim()) { setError('Contact name is required'); return; }
                      if (!delivery.contact_phone.trim()) { setError('Phone is required'); return; }
                      if (!delivery.address.trim()) { setError('Delivery address is required'); return; }
                      if (!delivery.region) { setError('Region is required'); return; }
                      setError('');
                    }
                    setCheckoutStep(s => s + 1);
                  }}
                  style={{
                    flex:1, padding:'0.75rem',
                    background:'linear-gradient(135deg,#0d9488,#0891b2)',
                    color:'#fff', border:'none', borderRadius:'10px',
                    fontSize:'0.9rem', fontWeight:700, cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:'0.4rem',
                  }}
                >
                  Continue <LuChevronRight size={16} />
                </button>
              ) : (
                <button
                  onClick={handlePlaceOrder}
                  disabled={placing}
                  style={{
                    flex:1, padding:'0.75rem',
                    background: placing ? '#5eead4' : 'linear-gradient(135deg,#0d9488,#0891b2)',
                    color:'#fff', border:'none', borderRadius:'10px',
                    fontSize:'0.95rem', fontWeight:800, cursor: placing ? 'not-allowed' : 'pointer',
                    boxShadow:'0 4px 16px rgba(13,148,136,0.35)',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem',
                  }}
                >
                  {placing ? 'Placing order...' : <><LuCheck size={16} /> Confirm & Place Order</>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Responsive styles for checkout modal step pills */}
      <style>{`
        @keyframes checkout-slide-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 480px) {
          .checkout-step-label { display: none; }
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        @media (max-width: 640px) {
          .cp-header { padding: 0 0.75rem !important; }
          .cp-header-btn-label { display: none; }
          .cp-header-btn { padding: 0.5rem 0.65rem !important; }
        }
        @media (max-width: 480px) {
          .cp-header-divider, .cp-header-company { display: none; }
        }
      `}</style>

      {/* Product characteristics modal */}
      {productModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 350,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setProductModal(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 620,
              background: 'var(--card-bg)',
              borderRadius: 16,
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                background: 'var(--card-bg)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: 'var(--text)' }}>
                  {productModal.name}
                </h2>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {productModal.reference ? `Ref: ${productModal.reference}` : ''}
                  {productModal.category_name ? ` · ${productModal.category_name}` : ''}
                </div>
              </div>

              <button
                onClick={() => setProductModal(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  color: 'var(--text-muted)',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', maxHeight: '75vh', overflowY: 'auto' }}>
              {/* Product image in modal */}
              {productModal.image && (
                <div style={{
                  width: '100%', height: 200, background: 'var(--card-bg-2)',
                  borderRadius: '10px', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', overflow: 'hidden',
                  border: '1px solid var(--border)', marginBottom: '1rem',
                }}>
                  <img
                    src={productModal.image}
                    alt={productModal.name}
                    onError={e => { e.currentTarget.parentElement.style.display = 'none'; }}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                </div>
              )}

              {/* Variant selector */}
              {productModal.has_variants && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.6rem' }}>
                    Choose an option
                  </p>
                  {modalVariants.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-faint)' }}>Loading options...</p>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {modalVariants.map(v => (
                        <button
                          key={v.id}
                          onClick={() => setSelectedVariantId(v.id)}
                          disabled={v.stock <= 0}
                          style={{
                            padding: '0.5rem 0.85rem', borderRadius: '10px',
                            border: selectedVariantId === v.id ? '2px solid #0d9488' : '1.5px solid var(--border)',
                            background: selectedVariantId === v.id ? '#f0fdfa' : 'var(--card-bg)',
                            cursor: v.stock <= 0 ? 'not-allowed' : 'pointer',
                            opacity: v.stock <= 0 ? 0.5 : 1,
                            textAlign: 'left',
                          }}
                        >
                          <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)' }}>{v.name}</p>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: '#0d9488', fontWeight: 700 }}>{fmt(v.unit_price)}</p>
                          <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--text-faint)' }}>{v.stock > 0 ? `${v.stock} in stock` : 'Out of stock'}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'baseline' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 800, letterSpacing: '0.03em' }}>
                    Specifications
                  </div>
                  {/* Keep modal focused on product specs */}
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-faint)', fontWeight: 700 }}>
                    {productModal.reference ? `Ref: ${productModal.reference}` : ''}
                  </div>
                </div>

                <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '0.9rem 1rem', background: 'var(--card-bg)', marginTop: '0.75rem' }}>

                  {(() => {
                    const desc = (productModal.description ?? '').toString().trim();
                    if (!desc) {
                      return (
                        <p style={{ margin: 0, color: 'var(--text-faint)', fontSize: '0.9rem' }}>
                          No specifications available.
                        </p>
                      );
                    }

                    // Heuristics: support common formats (bullet lists, dash/semicolon separated specs, multiline text).
                    // 1) Newlines -> paragraphs
                    const hasNewlines = /\n/.test(desc);

                    if (hasNewlines) {
                      const parts = desc
                        .split(/\r?\n/)
                        .map(s => s.trim())
                        .filter(Boolean);

                      // If looks like bullets, render bullets
                      const bulletLike = parts.length >= 3 && parts.some(p => /^[-•*]/.test(p));
                      if (bulletLike) {
                        return (
                          <ul style={{ margin: 0, paddingLeft: '1.1rem', color: 'var(--text-muted)', lineHeight: 1.7, fontSize: '0.9rem' }}>
                            {parts.map((p, idx) => (
                              <li key={idx} style={{ marginBottom: idx === parts.length - 1 ? 0 : '0.35rem' }}>
                                {p.replace(/^[-•*]+\s*/, '')}
                              </li>
                            ))}
                          </ul>
                        );
                      }

                      return (
                        <div style={{ color: 'var(--text-muted)', lineHeight: 1.7, fontSize: '0.9rem' }}>
                          {parts.map((p, idx) => (
                            <p key={idx} style={{ margin: idx === parts.length - 1 ? 0 : '0 0 0.6rem' }}>
                              {p}
                            </p>
                          ))}
                        </div>
                      );
                    }

                    // 2) Single-line but with separators
                    const sepParts = desc
                      .split(/\s*[;|•]\s*|\s*\|\s*|\s{2,}\s*/)
                      .map(s => s.trim())
                      .filter(Boolean);

                    if (sepParts.length >= 3) {
                      return (
                        <ul style={{ margin: 0, paddingLeft: '1.1rem', color: 'var(--text-muted)', lineHeight: 1.7, fontSize: '0.9rem' }}>
                          {sepParts.map((p, idx) => (
                            <li key={idx} style={{ marginBottom: idx === sepParts.length - 1 ? 0 : '0.35rem' }}>{p}</li>
                          ))}
                        </ul>
                      );
                    }

                    // 3) Fallback
                    return (
                      <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.7, fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>
                        {desc}
                      </p>
                    );
                  })()}
                </div>

              </div>

              {/* ── Related products ── */}
              {relatedProducts.length > 0 && (
                <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                  <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                    🔗 Related products — {productModal.category_name}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.65rem' }}>
                    {relatedProducts.map(rp => {
                      const inCart = cart[cartKey(rp.id)]?.quantity || 0;
                      return (
                        <div
                          key={rp.id}
                          style={{
                            background: inCart > 0 ? '#f0fdfa' : 'var(--card-bg-2)',
                            border: inCart > 0 ? '1.5px solid #0d9488' : '1px solid var(--border)',
                            borderRadius: 10, padding: '0.65rem',
                            display: 'flex', flexDirection: 'column', gap: '0.4rem',
                            cursor: 'pointer', transition: 'all 0.15s',
                          }}
                          onClick={() => setProductModal(rp)}
                        >
                          {/* Thumbnail */}
                          <div style={{ width: '100%', height: 64, background: 'var(--card-bg)', borderRadius: 7, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
                            {rp.image
                              ? <img src={rp.image} alt={rp.name} onError={e => { e.currentTarget.style.display = 'none'; }} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                              : <span style={{ fontSize: '1.4rem' }}>📦</span>
                            }
                          </div>
                          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text)', margin: 0, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {rp.name}
                          </p>
                          <p style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0d9488', margin: 0 }}>
                            {rp.has_variants ? 'From ' : ''}{fmt(rp.unit_price)}
                          </p>
                          <button
                            onClick={e => { e.stopPropagation(); rp.has_variants ? setProductModal(rp) : addToCart(rp); }}
                            style={{
                              width: '100%', padding: '0.3rem', borderRadius: 6, border: 'none',
                              background: inCart > 0 ? '#0d9488' : 'linear-gradient(135deg,#0d9488,#0891b2)',
                              color: '#fff', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                            }}
                          >
                            {rp.has_variants ? 'Options' : inCart > 0 ? `+1 (${inCart})` : '+ Add'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', marginTop: '1.25rem', alignItems: 'center' }}>
                {/* Add to cart from modal */}
                <button
                  onClick={() => {
                    const variant = productModal.has_variants ? modalVariants.find(v => v.id === selectedVariantId) : null;
                    if (productModal.has_variants && !variant) return;
                    addToCart(productModal, variant);
                  }}
                  disabled={productModal.has_variants && (!selectedVariantId || modalVariants.find(v => v.id === selectedVariantId)?.stock <= 0)}
                  style={{
                    flex: 1, padding: '0.65rem 1rem',
                    background: 'linear-gradient(135deg,#0d9488,#0891b2)',
                    color: '#fff', border: 'none', borderRadius: 10,
                    fontSize: '0.875rem', fontWeight: 700,
                    cursor: (productModal.has_variants && !selectedVariantId) ? 'not-allowed' : 'pointer',
                    opacity: (productModal.has_variants && !selectedVariantId) ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                  }}
                >
                  <LuPlus size={14} /> Add to Cart
                </button>
                <button
                  style={{
                    padding: '0.65rem 1rem',
                    border: '1.5px solid var(--border)',
                    borderRadius: 10,
                    background: 'var(--card-bg)',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    color: 'var(--text-muted)',
                  }}
                  onClick={() => setProductModal(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✨ Order success modal */}
      <OrderSuccessModal
        isOpen={!!successOrder}
        orderId={successOrder?.id}
        orderNumber={successOrder?.number}
        totalAmount={successOrder?.totalAmount}
        onViewOrder={() => {
          setSuccessOrder(null);
          navigate('/client/orders');
        }}
        onContinueShopping={() => setSuccessOrder(null)}
      />

      {/* 💬 AI Chatbot */}
      <ClientChatBot />
    </div>
  );
}
