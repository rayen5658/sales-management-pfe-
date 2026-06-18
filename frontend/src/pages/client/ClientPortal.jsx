import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuShoppingCart, LuPlus, LuMinus, LuTrash2, LuLogOut, LuClock, LuSearch, LuMapPin, LuPhone, LuUser, LuFileText, LuChevronRight, LuCheck, LuTriangleAlert } from 'react-icons/lu';
import { useClientAuthStore } from '../../stores/clientAuthStore';
import { clientPortalService } from '../../services/clientApi';
import { ConfirmDialog, OrderSuccessModal, notifySuccess, notifyError, setupToasterGlobal } from '../../utils/uxHelpers';
import ClientChatBot from '../../components/ClientChatBot';
import AppLogo from '../../components/common/AppLogo';

import { CART_STORAGE_KEY } from '../../utils/constants';
const REGIONS = ['Tunis','Ariana','Ben Arous','Manouba','Nabeul','Zaghouan','Bizerte','Béja','Jendouba','Le Kef','Siliana','Sousse','Monastir','Mahdia','Sfax','Kairouan','Kasserine','Sidi Bouzid','Gabès','Medenine','Tataouine','Gafsa','Tozeur','Kebili'];

const fmt = v => parseFloat(v || 0).toFixed(2) + ' TND';

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

  // ✨ Cart persisté dans localStorage
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

  // ✨ Modal de succès commande
  const [successOrder, setSuccessOrder] = useState(null);
  const [productModal, setProductModal] = useState(null);

  // Load related products when modal opens
  useEffect(() => {
    if (!productModal) { setRelatedProducts([]); return; }
    clientPortalService.getRelated(productModal.id)
      .then(r => setRelatedProducts(r.data))
      .catch(() => setRelatedProducts([]));
  }, [productModal]);


  // ✨ Persister panier dans localStorage à chaque modification
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

  const addToCart = (product) => {
    setCart(prev => ({
      ...prev,
      [product.id]: {
        product,
        quantity: (prev[product.id]?.quantity || 0) + 1,
      },
    }));
    // ✨ Toast notification
    notifySuccess(`✨ "${product.name}" ajouté au panier!`);
  };

  const updateQty = (product_id, qty) => {
    if (qty <= 0) {
      removeFromCart(product_id);
      return;
    }
    setCart(prev => ({
      ...prev,
      [product_id]: { ...prev[product_id], quantity: qty },
    }));
  };

  const removeFromCart = (product_id) => {
    const prodName = cart[product_id]?.product?.name || 'Produit';
    setCart(prev => {
      const next = { ...prev };
      delete next[product_id];
      return next;
    });
    notifySuccess(`"${prodName}" supprimé du panier`);
  };

  const cartItems = Object.values(cart);
  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);
  const cartHT    = cartItems.reduce((s, i) => s + parseFloat(i.product.unit_price) * i.quantity, 0);
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
        items: cartItems.map(i => ({ product_id: i.product.id, quantity: i.quantity })),
        notes: deliveryNote,
      });
      
      // ✨ Afficher la modal de succès avec le numéro de commande
      setSuccessOrder({
        id: response.data?.order?.id,
        number: response.data?.order?.id || 'N/A',
        totalAmount: cartTTC,
      });

      // Vider le panier et fermer les modales
      setCart({});
      setNotes('');
      setCartOpen(false);
      setConfirmOpen(false);
      setCheckoutOpen(false);
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Erreur lors de la création de la commande.';
      setError(errMsg);
      notifyError(errMsg);
    } finally {
      setPlacing(false);
    }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const filtered = products; // already filtered server-side

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* ✨ Setup toaster global */}
      {setupToasterGlobal()}

      {/* ── Top bar ── */}
      <header style={{
        background: '#fff', borderBottom: '1px solid #e2e8f0',
        padding: '0 1.5rem', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AppLogo size={30} showText={true} />
          <div style={{ width: 1, height: 28, background: '#e2e8f0', margin: '0 0.25rem' }} />
          <div>
            <p style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e1b4b', margin: 0 }}>
              {client?.company_name}
            </p>
            <p style={{ fontSize: '0.72rem', color: '#6b7280', margin: 0 }}>Client Portal</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => navigate('/client/orders')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 0.9rem', border: '1.5px solid #e2e8f0',
              borderRadius: '8px', background: '#fff', cursor: 'pointer',
              fontSize: '0.8rem', fontWeight: 600, color: '#374151',
              minHeight: '36px',
            }}
          >
            <LuClock size={14} /> Mes Commandes
          </button>

          {/* Cart button */}
          <button
            onClick={() => setCartOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 0.9rem',
              background: cartCount > 0 ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : '#f1f5f9',
              color: cartCount > 0 ? '#fff' : '#374151',
              border: 'none', borderRadius: '8px', cursor: 'pointer',
              fontSize: '0.8rem', fontWeight: 700,
              boxShadow: cartCount > 0 ? '0 4px 12px rgba(79,70,229,0.3)' : 'none',
              transition: 'all 0.2s',
              minHeight: '36px',
            }}
          >
            <LuShoppingCart size={14} />
            Panier {cartCount > 0 && `(${cartCount})`}
          </button>

          <button
            onClick={handleLogout}
            title="Se déconnecter"
            style={{
              padding: '0.5rem 0.6rem', border: '1.5px solid #e2e8f0',
              borderRadius: '8px', background: '#fff', cursor: 'pointer', color: '#6b7280',
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
              <LuSearch size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search products..."
                style={{
                  width: '100%', padding: '0.6rem 0.75rem 0.6rem 2.25rem',
                  border: '1.5px solid #e2e8f0', borderRadius: '8px',
                  fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box',
                  background: '#fff',
                }}
              />
            </div>

            {/* Price range inputs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '8px', padding: '0 0.75rem' }}>
              <span style={{ fontSize: '0.78rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>💰 Price</span>
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
              <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>TND</span>
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
            <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600, marginRight: '0.25rem' }}>Category:</span>
            <button
              onClick={() => setFilterCat('')}
              style={{
                padding: '0.3rem 0.85rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                border: filterCat === '' ? '2px solid #4f46e5' : '1.5px solid #e2e8f0',
                background: filterCat === '' ? '#4f46e5' : '#fff',
                color: filterCat === '' ? '#fff' : '#374151',
                transition: 'all 0.15s',
              }}
            >All</button>
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setFilterCat(filterCat === String(c.id) ? '' : String(c.id))}
                style={{
                  padding: '0.3rem 0.85rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                  border: filterCat === String(c.id) ? '2px solid #4f46e5' : '1.5px solid #e2e8f0',
                  background: filterCat === String(c.id) ? '#4f46e5' : '#fff',
                  color: filterCat === String(c.id) ? '#fff' : '#374151',
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
              <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>Active:</span>
              <span style={{ fontSize: '0.75rem', background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', borderRadius: '999px', padding: '0.15rem 0.65rem', fontWeight: 600 }}>
                💰 {minPrice || '0'} – {maxPrice || '∞'} TND
              </span>
            </div>
          )}
        </div>

        {/* Product grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>Loading products...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
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
              const inCart = cart[product.id]?.quantity || 0;
              return (
                <div key={product.id} style={{
                  background: '#fff', borderRadius: '12px',
                  border: inCart > 0 ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                  padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem',
                  boxShadow: inCart > 0 ? '0 4px 16px rgba(79,70,229,0.12)' : '0 1px 4px rgba(0,0,0,0.04)',
                  transition: 'all 0.2s',
                }}>
                  {/* Product image */}
                  <div style={{
                    width: '100%', height: 140,
                    background: '#f8fafc', borderRadius: '8px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', border: '1px solid #f1f5f9',
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
                      <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e1b4b', margin: 0, lineHeight: 1.3 }}>
                        {product.name}
                      </h3>
                      {inCart > 0 && (
                        <span style={{
                          background: '#4f46e5', color: '#fff',
                          borderRadius: '999px', padding: '0.1rem 0.5rem',
                          fontSize: '0.7rem', fontWeight: 700, flexShrink: 0, marginLeft: '0.5rem',
                        }}>
                          {inCart} in cart
                        </span>
                      )}
                    </div>
                    {product.reference && (
                      <code style={{ fontSize: '0.72rem', color: '#6b7280', background: '#f1f5f9', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                        {product.reference}
                      </code>
                    )}
                    {product.category_name && (
                      <p style={{ fontSize: '0.72rem', color: '#6b7280', margin: '0.3rem 0 0' }}>{product.category_name}</p>
                    )}
                  </div>

                    {product.description && (
                    <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
                      {product.description.length > 80 ? product.description.slice(0, 80) + '…' : product.description}
                    </p>
                  )}

                  <button
                    onClick={() => setProductModal(product)}
                    style={{
                      marginTop: '0.25rem',
                      background: '#fff',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '0.45rem 0.65rem',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: '#374151',
                    }}
                    title='Voir les caractéristiques'
                  >
                    Voir caractéristiques
                  </button>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                    <div>
                      <p style={{ fontSize: '1.05rem', fontWeight: 800, color: '#4f46e5', margin: 0 }}>
                        {fmt(product.unit_price)}
                      </p>
                      <p style={{ fontSize: '0.7rem', color: '#9ca3af', margin: 0 }}>
                        Stock: {product.stock} units
                      </p>
                    </div>

                    {inCart === 0 ? (
                      <button
                        onClick={() => addToCart(product)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.3rem',
                          padding: '0.5rem 0.9rem',
                          background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                          color: '#fff', border: 'none', borderRadius: '8px',
                          fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                          minHeight: '32px',
                        }}
                      >
                        <LuPlus size={13} /> Ajouter
                      </button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button
                          onClick={() => updateQty(product.id, inCart - 1)}
                          style={{
                            width: 32, height: 32, borderRadius: '6px',
                            border: '1.5px solid #e2e8f0', background: '#fff',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        ><LuMinus size={13} /></button>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', minWidth: 24, textAlign: 'center' }}>{inCart}</span>
                        <button
                          onClick={() => updateQty(product.id, inCart + 1)}
                          disabled={inCart >= product.stock}
                          style={{
                            width: 32, height: 32, borderRadius: '6px',
                            border: '1.5px solid #4f46e5', background: '#4f46e5',
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
              background: '#fff', display: 'flex', flexDirection: 'column',
              boxShadow: '-8px 0 40px rgba(0,0,0,0.15)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div style={{
              padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1e1b4b' }}>
                🛒 Your Cart {cartCount > 0 && <span style={{ color: '#4f46e5' }}>({cartCount})</span>}
              </h2>
              <button onClick={() => setCartOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#6b7280' }}>✕</button>
            </div>

            {/* Cart items */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
              {cartItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: '#9ca3af' }}>
                  <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🛒</p>
                  <p>Your cart is empty</p>
                </div>
              ) : (
                cartItems.map(({ product, quantity }) => (
                  <div key={product.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.85rem 0', borderBottom: '1px solid #f1f5f9',
                  }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: 0, color: '#1e1b4b' }}>{product.name}</p>
                      <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: '0.15rem 0 0' }}>
                        {fmt(product.unit_price)} × {quantity} = <strong style={{ color: '#4f46e5' }}>{fmt(parseFloat(product.unit_price) * quantity)}</strong>
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <button onClick={() => updateQty(product.id, quantity - 1)} style={{ width: 26, height: 26, borderRadius: '6px', border: '1.5px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LuMinus size={11} /></button>
                      <span style={{ fontWeight: 700, fontSize: '0.875rem', minWidth: 18, textAlign: 'center' }}>{quantity}</span>
                      <button onClick={() => updateQty(product.id, quantity + 1)} disabled={quantity >= product.stock} style={{ width: 26, height: 26, borderRadius: '6px', border: '1.5px solid #4f46e5', background: '#4f46e5', cursor: quantity >= product.stock ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', opacity: quantity >= product.stock ? 0.5 : 1 }}><LuPlus size={11} /></button>
                      <button onClick={() => removeFromCart(product.id)} style={{ width: 26, height: 26, borderRadius: '6px', border: '1.5px solid #fee2e2', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', marginLeft: '0.2rem' }}><LuTrash2 size={11} /></button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Order summary + place order */}
            {cartItems.length > 0 && (
              <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #f1f5f9' }}>
                <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
                  {[
                    ['Subtotal (ex. tax)', fmt(cartHT)],
                    ['Tax (19%)',          fmt(cartTVA)],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem', color: '#6b7280' }}>
                      <span>{label}</span><span>{value}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0', fontWeight: 800, fontSize: '1rem', color: '#1e1b4b' }}>
                    <span>Total (inc. tax)</span>
                    <span style={{ color: '#4f46e5' }}>{fmt(cartTTC)}</span>
                  </div>
                </div>

                <div style={{ marginBottom: '0.85rem' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                    Notes de livraison (optionnel)
                  </label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Instructions spéciales, demandes particulières..."
                    rows={2}
                    style={{
                      width: '100%', padding: '0.6rem 0.75rem', border: '1.5px solid #e2e8f0',
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
                    background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                    color: '#fff', border: 'none', borderRadius: '10px',
                    fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(79,70,229,0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  }}
                >
                  Checkout <LuChevronRight size={16} />
                </button>
                <p style={{ textAlign: 'center', fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.5rem' }}>
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
          <div style={{ background:'#fff', borderRadius:'20px', width:'100%', maxWidth:520, boxShadow:'0 32px 80px rgba(0,0,0,0.22)', overflow:'hidden', maxHeight:'90vh', display:'flex', flexDirection:'column' }}
            onClick={e => e.stopPropagation()}>

            {/* ── Header with step indicator ── */}
            <div style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)', padding:'1.25rem 1.5rem' }}>
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
                        color: checkoutStep > n ? '#4f46e5' : checkoutStep === n ? '#4f46e5' : 'rgba(255,255,255,0.7)',
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
                  <p style={{ fontSize:'0.72rem', fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.75rem' }}>
                    {cartItems.length} item{cartItems.length > 1 ? 's' : ''} in your order
                  </p>

                  {/* Stock warnings */}
                  {cartItems.some(({product, quantity}) => quantity > product.stock) && (
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
                    {cartItems.map(({product, quantity}) => {
                      const stockOk = quantity <= product.stock;
                      const effectiveQty = Math.min(quantity, product.stock);
                      return (
                        <div key={product.id} style={{
                          display:'flex', alignItems:'center', gap:'0.75rem',
                          background: stockOk ? '#f8fafc' : '#fffbeb',
                          borderRadius:'10px', padding:'0.65rem 0.85rem',
                          border: stockOk ? '1px solid #e2e8f0' : '1.5px solid #fcd34d',
                        }}>
                          <div style={{ width:40, height:40, borderRadius:'8px', background:'#fff', border:'1px solid #e2e8f0', flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
                            {product.image
                              ? <img src={product.image} alt={product.name} style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }} onError={e => { e.currentTarget.style.display='none'; }} />
                              : <LuFileText size={16} style={{ color:'#cbd5e1' }} />}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <p style={{ margin:0, fontWeight:700, fontSize:'0.85rem', color:'#1e293b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{product.name}</p>
                            <p style={{ margin:0, fontSize:'0.75rem', color: stockOk ? '#64748b' : '#b45309' }}>
                              {fmt(product.unit_price)} × {effectiveQty}
                              {!stockOk && <span style={{ marginLeft:'0.4rem', background:'#fef3c7', color:'#92400e', padding:'0.1rem 0.4rem', borderRadius:'4px', fontSize:'0.68rem', fontWeight:700 }}>
                                Max: {product.stock}
                              </span>}
                            </p>
                          </div>
                          <span style={{ fontWeight:800, color: stockOk ? '#4f46e5' : '#b45309', fontSize:'0.9rem', flexShrink:0 }}>
                            {fmt(parseFloat(product.unit_price) * effectiveQty)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Totals */}
                  <div style={{ background:'#f8fafc', borderRadius:'12px', padding:'0.85rem 1rem', border:'1px solid #e2e8f0' }}>
                    {[['Subtotal (ex. tax)', fmt(cartHT)],['Tax (19%)', fmt(cartTVA)]].map(([l,v]) => (
                      <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:'0.8rem', color:'#64748b', marginBottom:'0.35rem' }}>
                        <span>{l}</span><span>{v}</span>
                      </div>
                    ))}
                    <div style={{ display:'flex', justifyContent:'space-between', paddingTop:'0.5rem', borderTop:'1px solid #e2e8f0', fontWeight:800, fontSize:'1rem', color:'#1e293b' }}>
                      <span>Total (inc. tax)</span>
                      <span style={{ color:'#4f46e5' }}>{fmt(cartTTC)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2 — Delivery Info */}
              {checkoutStep === 2 && (
                <div style={{ padding:'1.25rem 1.5rem' }}>
                  <p style={{ fontSize:'0.72rem', fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'1rem' }}>
                    Delivery & Contact Information
                  </p>

                  {/* Contact name */}
                  <div style={{ marginBottom:'0.85rem' }}>
                    <label style={{ display:'flex', alignItems:'center', gap:'0.35rem', fontSize:'0.78rem', fontWeight:700, color:'#374151', marginBottom:'0.4rem' }}>
                      <LuUser size={13} /> Contact Name *
                    </label>
                    <input
                      value={delivery.contact_name}
                      onChange={e => setDelivery(d => ({...d, contact_name: e.target.value}))}
                      placeholder="Company or contact name"
                      style={{ width:'100%', padding:'0.65rem 0.85rem', border:'1.5px solid #e2e8f0', borderRadius:'10px', fontSize:'0.875rem', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }}
                      onFocus={e => e.target.style.borderColor='#4f46e5'}
                      onBlur={e => e.target.style.borderColor='#e2e8f0'}
                    />
                  </div>

                  {/* Phone */}
                  <div style={{ marginBottom:'0.85rem' }}>
                    <label style={{ display:'flex', alignItems:'center', gap:'0.35rem', fontSize:'0.78rem', fontWeight:700, color:'#374151', marginBottom:'0.4rem' }}>
                      <LuPhone size={13} /> Phone *
                    </label>
                    <input
                      value={delivery.contact_phone}
                      onChange={e => setDelivery(d => ({...d, contact_phone: e.target.value}))}
                      placeholder="+216 XX XXX XXX"
                      style={{ width:'100%', padding:'0.65rem 0.85rem', border:'1.5px solid #e2e8f0', borderRadius:'10px', fontSize:'0.875rem', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }}
                      onFocus={e => e.target.style.borderColor='#4f46e5'}
                      onBlur={e => e.target.style.borderColor='#e2e8f0'}
                    />
                  </div>

                  {/* Address */}
                  <div style={{ marginBottom:'0.85rem' }}>
                    <label style={{ display:'flex', alignItems:'center', gap:'0.35rem', fontSize:'0.78rem', fontWeight:700, color:'#374151', marginBottom:'0.4rem' }}>
                      <LuMapPin size={13} /> Delivery Address *
                    </label>
                    <input
                      value={delivery.address}
                      onChange={e => setDelivery(d => ({...d, address: e.target.value}))}
                      placeholder="Street, building, floor..."
                      style={{ width:'100%', padding:'0.65rem 0.85rem', border:'1.5px solid #e2e8f0', borderRadius:'10px', fontSize:'0.875rem', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }}
                      onFocus={e => e.target.style.borderColor='#4f46e5'}
                      onBlur={e => e.target.style.borderColor='#e2e8f0'}
                    />
                  </div>

                  {/* Region */}
                  <div style={{ marginBottom:'0.85rem' }}>
                    <label style={{ display:'flex', alignItems:'center', gap:'0.35rem', fontSize:'0.78rem', fontWeight:700, color:'#374151', marginBottom:'0.4rem' }}>
                      <LuMapPin size={13} /> Region *
                    </label>
                    <select
                      value={delivery.region}
                      onChange={e => setDelivery(d => ({...d, region: e.target.value}))}
                      style={{ width:'100%', padding:'0.65rem 0.85rem', border:'1.5px solid #e2e8f0', borderRadius:'10px', fontSize:'0.875rem', outline:'none', boxSizing:'border-box', fontFamily:'inherit', background:'#fff' }}
                    >
                      <option value="">-- Select region --</option>
                      {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>

                  {/* Notes */}
                  <div>
                    <label style={{ display:'flex', alignItems:'center', gap:'0.35rem', fontSize:'0.78rem', fontWeight:700, color:'#374151', marginBottom:'0.4rem' }}>
                      <LuFileText size={13} /> Order Notes (optional)
                    </label>
                    <textarea
                      value={delivery.notes}
                      onChange={e => setDelivery(d => ({...d, notes: e.target.value}))}
                      placeholder="Special instructions, delivery time preference..."
                      rows={3}
                      style={{ width:'100%', padding:'0.65rem 0.85rem', border:'1.5px solid #e2e8f0', borderRadius:'10px', fontSize:'0.875rem', outline:'none', resize:'vertical', boxSizing:'border-box', fontFamily:'inherit' }}
                      onFocus={e => e.target.style.borderColor='#4f46e5'}
                      onBlur={e => e.target.style.borderColor='#e2e8f0'}
                    />
                  </div>
                </div>
              )}

              {/* STEP 3 — Review & Confirm */}
              {checkoutStep === 3 && (
                <div style={{ padding:'1.25rem 1.5rem' }}>
                  <p style={{ fontSize:'0.72rem', fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'1rem' }}>
                    Review your order
                  </p>

                  {/* Delivery summary card */}
                  <div style={{ background:'#f8fafc', borderRadius:'12px', padding:'1rem', border:'1px solid #e2e8f0', marginBottom:'1rem' }}>
                    <p style={{ fontSize:'0.7rem', fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.65rem' }}>Delivery Details</p>
                    {[
                      ['Contact',  delivery.contact_name  || '—'],
                      ['Phone',    delivery.contact_phone || '—'],
                      ['Address',  delivery.address       || '—'],
                      ['Region',   delivery.region        || '—'],
                      ...(delivery.notes ? [['Notes', delivery.notes]] : []),
                    ].map(([label, value]) => (
                      <div key={label} style={{ display:'flex', gap:'0.5rem', marginBottom:'0.4rem', fontSize:'0.82rem' }}>
                        <span style={{ color:'#64748b', fontWeight:600, minWidth:70 }}>{label}:</span>
                        <span style={{ color:'#1e293b', fontWeight:500 }}>{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Order totals */}
                  <div style={{ background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', borderRadius:'12px', padding:'1rem', border:'1px solid #e0e7ff' }}>
                    <p style={{ fontSize:'0.7rem', fontWeight:700, color:'#6366f1', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.65rem' }}>Order Total</p>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.82rem', color:'#64748b', marginBottom:'0.3rem' }}>
                      <span>Items ({cartCount})</span><span>{fmt(cartHT)}</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.82rem', color:'#64748b', marginBottom:'0.5rem' }}>
                      <span>Tax (19%)</span><span>{fmt(cartTVA)}</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', paddingTop:'0.5rem', borderTop:'1px solid #c7d2fe', fontWeight:900, fontSize:'1.1rem' }}>
                      <span style={{ color:'#4f46e5' }}>Total</span>
                      <span style={{ color:'#4f46e5' }}>{fmt(cartTTC)}</span>
                    </div>
                  </div>

                  {error && (
                    <div style={{ marginTop:'0.85rem', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'10px', padding:'0.65rem 0.85rem', color:'#991b1b', fontSize:'0.82rem' }}>
                      ⚠ {error}
                    </div>
                  )}

                  <p style={{ fontSize:'0.75rem', color:'#94a3b8', marginTop:'1rem', textAlign:'center', lineHeight:1.5 }}>
                    By confirming, your order will be sent to our team for review. You will receive a confirmation once it's approved.
                  </p>
                </div>
              )}
            </div>

            {/* ── Footer navigation ── */}
            <div style={{ padding:'1rem 1.5rem', borderTop:'1px solid #f1f5f9', display:'flex', gap:'0.75rem', background:'#fff' }}>
              {checkoutStep > 1 && (
                <button
                  onClick={() => setCheckoutStep(s => s - 1)}
                  disabled={placing}
                  style={{ padding:'0.7rem 1.25rem', border:'1.5px solid #e2e8f0', borderRadius:'10px', background:'#fff', cursor:'pointer', fontSize:'0.875rem', fontWeight:600, color:'#374151' }}
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
                    background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
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
                    background: placing ? '#a5b4fc' : 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                    color:'#fff', border:'none', borderRadius:'10px',
                    fontSize:'0.95rem', fontWeight:800, cursor: placing ? 'not-allowed' : 'pointer',
                    boxShadow:'0 4px 16px rgba(79,70,229,0.35)',
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
              background: '#fff',
              borderRadius: 16,
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                background: '#fff',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#1e1b4b' }}>
                  {productModal.name}
                </h2>
                <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                  {productModal.reference ? `Réf: ${productModal.reference}` : ''}
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
                  color: '#6b7280',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', maxHeight: '75vh', overflowY: 'auto' }}>
              {/* Product image in modal */}
              {productModal.image && (
                <div style={{
                  width: '100%', height: 200, background: '#f8fafc',
                  borderRadius: '10px', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', overflow: 'hidden',
                  border: '1px solid #f1f5f9', marginBottom: '1rem',
                }}>
                  <img
                    src={productModal.image}
                    alt={productModal.name}
                    onError={e => { e.currentTarget.parentElement.style.display = 'none'; }}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                </div>
              )}
              <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'baseline' }}>
                  <div style={{ color: '#6b7280', fontSize: '0.82rem', fontWeight: 800, letterSpacing: '0.03em' }}>
                    Caractéristiques
                  </div>
                  {/* Keep modal focused on product specs */}
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700 }}>
                    {productModal.reference ? `Réf: ${productModal.reference}` : ''}
                  </div>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '0.9rem 1rem', background: '#fff', marginTop: '0.75rem' }}>

                  {(() => {
                    const desc = (productModal.description ?? '').toString().trim();
                    if (!desc) {
                      return (
                        <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.9rem' }}>
                          Aucune caractéristique disponible.
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
                          <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#374151', lineHeight: 1.7, fontSize: '0.9rem' }}>
                            {parts.map((p, idx) => (
                              <li key={idx} style={{ marginBottom: idx === parts.length - 1 ? 0 : '0.35rem' }}>
                                {p.replace(/^[-•*]+\s*/, '')}
                              </li>
                            ))}
                          </ul>
                        );
                      }

                      return (
                        <div style={{ color: '#374151', lineHeight: 1.7, fontSize: '0.9rem' }}>
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
                        <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#374151', lineHeight: 1.7, fontSize: '0.9rem' }}>
                          {sepParts.map((p, idx) => (
                            <li key={idx} style={{ marginBottom: idx === sepParts.length - 1 ? 0 : '0.35rem' }}>{p}</li>
                          ))}
                        </ul>
                      );
                    }

                    // 3) Fallback
                    return (
                      <p style={{ margin: 0, color: '#374151', lineHeight: 1.7, fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>
                        {desc}
                      </p>
                    );
                  })()}
                </div>

              </div>

              {/* ── Related products ── */}
              {relatedProducts.length > 0 && (
                <div style={{ marginTop: '1.25rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
                  <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                    🔗 Related products — {productModal.category_name}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.65rem' }}>
                    {relatedProducts.map(rp => {
                      const inCart = cart[rp.id]?.quantity || 0;
                      return (
                        <div
                          key={rp.id}
                          style={{
                            background: inCart > 0 ? '#eef2ff' : '#f8fafc',
                            border: inCart > 0 ? '1.5px solid #4f46e5' : '1px solid #e2e8f0',
                            borderRadius: 10, padding: '0.65rem',
                            display: 'flex', flexDirection: 'column', gap: '0.4rem',
                            cursor: 'pointer', transition: 'all 0.15s',
                          }}
                          onClick={() => setProductModal(rp)}
                        >
                          {/* Thumbnail */}
                          <div style={{ width: '100%', height: 64, background: '#fff', borderRadius: 7, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #f1f5f9' }}>
                            {rp.image
                              ? <img src={rp.image} alt={rp.name} onError={e => { e.currentTarget.style.display = 'none'; }} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                              : <span style={{ fontSize: '1.4rem' }}>📦</span>
                            }
                          </div>
                          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1e1b4b', margin: 0, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {rp.name}
                          </p>
                          <p style={{ fontSize: '0.78rem', fontWeight: 800, color: '#4f46e5', margin: 0 }}>
                            {fmt(rp.unit_price)}
                          </p>
                          <button
                            onClick={e => { e.stopPropagation(); addToCart(rp); }}
                            style={{
                              width: '100%', padding: '0.3rem', borderRadius: 6, border: 'none',
                              background: inCart > 0 ? '#4f46e5' : 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                              color: '#fff', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                            }}
                          >
                            {inCart > 0 ? `+1 (${inCart})` : '+ Add'}
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
                  onClick={() => { addToCart(productModal); }}
                  style={{
                    flex: 1, padding: '0.65rem 1rem',
                    background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                    color: '#fff', border: 'none', borderRadius: 10,
                    fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                  }}
                >
                  <LuPlus size={14} /> Add to Cart
                </button>
                <button
                  style={{
                    padding: '0.65rem 1rem',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: 10,
                    background: '#fff',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    color: '#374151',
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

      {/* ✨ Modal de succès commande */}
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
