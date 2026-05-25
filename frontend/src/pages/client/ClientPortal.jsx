import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiShoppingCart, FiPlus, FiMinus, FiTrash2, FiLogOut, FiClock, FiSearch } from 'react-icons/fi';
import { useClientAuthStore } from '../../stores/clientAuthStore';
import { clientPortalService } from '../../services/clientApi';

const fmt = v => parseFloat(v || 0).toFixed(2) + ' TND';

export default function ClientPortal() {
  const navigate = useNavigate();
  const { client, logout } = useClientAuthStore();

  const [products, setProducts]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filterCat, setFilterCat]   = useState('');

  // Cart: { [product_id]: { product, quantity } }
  const [cart, setCart] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [notes, setNotes] = useState('');

  const [placing, setPlacing]   = useState(false);
  const [success, setSuccess]   = useState('');
  const [error, setError]       = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      clientPortalService.getProducts(),
      clientPortalService.getCategories(),
    ]).then(([p, c]) => {
      setProducts(p.data);
      setCategories(c.data);
    }).catch(() => setError('Error loading products'))
      .finally(() => setLoading(false));
  }, []);

  // Re-fetch products when search/category changes
  useEffect(() => {
    const params = {};
    if (search)    params.search = search;
    if (filterCat) params.category_id = filterCat;
    clientPortalService.getProducts(params)
      .then(r => setProducts(r.data))
      .catch(() => {});
  }, [search, filterCat]);

  const addToCart = (product) => {
    setCart(prev => ({
      ...prev,
      [product.id]: {
        product,
        quantity: (prev[product.id]?.quantity || 0) + 1,
      },
    }));
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
    setCart(prev => {
      const next = { ...prev };
      delete next[product_id];
      return next;
    });
  };

  const cartItems = Object.values(cart);
  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);
  const cartHT    = cartItems.reduce((s, i) => s + parseFloat(i.product.unit_price) * i.quantity, 0);
  const cartTVA   = cartHT * 0.19;
  const cartTTC   = cartHT + cartTVA;

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) return;
    setPlacing(true);
    setError('');
    try {
      await clientPortalService.placeOrder({
        items: cartItems.map(i => ({ product_id: i.product.id, quantity: i.quantity })),
        notes,
      });
      setCart({});
      setNotes('');
      setCartOpen(false);
      setConfirmOpen(false);
      setSuccess('Order placed successfully! It is now pending confirmation from our team.');
      setTimeout(() => setSuccess(''), 6000);
    } catch (err) {
      setError(err.response?.data?.message || 'Error placing order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  const handleLogout = () => { logout(); navigate('/client/login'); };

  const filtered = products; // already filtered server-side

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Top bar ── */}
      <header style={{
        background: '#fff', borderBottom: '1px solid #e2e8f0',
        padding: '0 1.5rem', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1rem',
          }}>🏢</div>
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
              padding: '0.4rem 0.85rem', border: '1.5px solid #e2e8f0',
              borderRadius: '8px', background: '#fff', cursor: 'pointer',
              fontSize: '0.8rem', fontWeight: 600, color: '#374151',
            }}
          >
            <FiClock size={14} /> My Orders
          </button>

          {/* Cart button */}
          <button
            onClick={() => setCartOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.4rem 0.85rem',
              background: cartCount > 0 ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : '#f1f5f9',
              color: cartCount > 0 ? '#fff' : '#374151',
              border: 'none', borderRadius: '8px', cursor: 'pointer',
              fontSize: '0.8rem', fontWeight: 700,
              boxShadow: cartCount > 0 ? '0 4px 12px rgba(79,70,229,0.3)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            <FiShoppingCart size={14} />
            Cart {cartCount > 0 && `(${cartCount})`}
          </button>

          <button
            onClick={handleLogout}
            title="Logout"
            style={{
              padding: '0.4rem 0.6rem', border: '1.5px solid #e2e8f0',
              borderRadius: '8px', background: '#fff', cursor: 'pointer', color: '#6b7280',
            }}
          >
            <FiLogOut size={14} />
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem' }}>

        {success && (
          <div style={{
            background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px',
            padding: '0.85rem 1.25rem', marginBottom: '1rem',
            color: '#166534', fontSize: '0.875rem', fontWeight: 500,
          }}>
            ✅ {success}
          </div>
        )}
        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px',
            padding: '0.85rem 1.25rem', marginBottom: '1rem',
            color: '#991b1b', fontSize: '0.875rem',
          }}>
            ⚠ {error}
          </div>
        )}

        {/* Search + filter */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <FiSearch size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products..."
              style={{
                width: '100%', padding: '0.6rem 0.75rem 0.6rem 2.25rem',
                border: '1.5px solid #e2e8f0', borderRadius: '8px',
                fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            style={{
              padding: '0.6rem 0.9rem', border: '1.5px solid #e2e8f0',
              borderRadius: '8px', fontSize: '0.875rem', background: '#fff', outline: 'none',
            }}
          >
            <option value="">All categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Product grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>Loading products...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>No products found</div>
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
                          padding: '0.45rem 0.85rem',
                          background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                          color: '#fff', border: 'none', borderRadius: '8px',
                          fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        <FiPlus size={13} /> Add
                      </button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button
                          onClick={() => updateQty(product.id, inCart - 1)}
                          style={{
                            width: 28, height: 28, borderRadius: '6px',
                            border: '1.5px solid #e2e8f0', background: '#fff',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        ><FiMinus size={12} /></button>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', minWidth: 20, textAlign: 'center' }}>{inCart}</span>
                        <button
                          onClick={() => updateQty(product.id, inCart + 1)}
                          disabled={inCart >= product.stock}
                          style={{
                            width: 28, height: 28, borderRadius: '6px',
                            border: '1.5px solid #4f46e5', background: '#4f46e5',
                            cursor: inCart >= product.stock ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                            opacity: inCart >= product.stock ? 0.5 : 1,
                          }}
                        ><FiPlus size={12} /></button>
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
                      <button onClick={() => updateQty(product.id, quantity - 1)} style={{ width: 26, height: 26, borderRadius: '6px', border: '1.5px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FiMinus size={11} /></button>
                      <span style={{ fontWeight: 700, fontSize: '0.875rem', minWidth: 18, textAlign: 'center' }}>{quantity}</span>
                      <button onClick={() => updateQty(product.id, quantity + 1)} disabled={quantity >= product.stock} style={{ width: 26, height: 26, borderRadius: '6px', border: '1.5px solid #4f46e5', background: '#4f46e5', cursor: quantity >= product.stock ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', opacity: quantity >= product.stock ? 0.5 : 1 }}><FiPlus size={11} /></button>
                      <button onClick={() => removeFromCart(product.id)} style={{ width: 26, height: 26, borderRadius: '6px', border: '1.5px solid #fee2e2', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', marginLeft: '0.2rem' }}><FiTrash2 size={11} /></button>
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
                    Notes (optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Delivery instructions, special requests..."
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
                  onClick={() => { setError(''); setConfirmOpen(true); }}
                  disabled={placing}
                  style={{
                    width: '100%', padding: '0.85rem',
                    background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                    color: '#fff', border: 'none', borderRadius: '10px',
                    fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(79,70,229,0.35)',
                  }}
                >
                  Review & Place Order →
                </button>
                <p style={{ textAlign: 'center', fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.5rem' }}>
                  Order will be confirmed by our team
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      {/* ── Order Confirmation Modal ── */}
      {confirmOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => !placing && setConfirmOpen(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: 480, boxShadow: '0 24px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1e1b4b' }}>📋 Order Summary</h2>
              <button onClick={() => setConfirmOpen(false)} disabled={placing} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#6b7280' }}>✕</button>
            </div>

            {/* Items list */}
            <div style={{ padding: '1rem 1.5rem', maxHeight: 280, overflowY: 'auto' }}>
              {cartItems.map(({ product, quantity }) => (
                <div key={product.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid #f8fafc' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem', color: '#1e1b4b' }}>{product.name}</p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>{fmt(product.unit_price)} × {quantity}</p>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#4f46e5' }}>{fmt(parseFloat(product.unit_price) * quantity)}</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
              {[
                ['Subtotal (ex. tax)', fmt(cartHT)],
                ['Tax (19%)',          fmt(cartTVA)],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.35rem' }}>
                  <span>{label}</span><span>{value}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0', fontWeight: 800, fontSize: '1.05rem', color: '#1e1b4b' }}>
                <span>Total (inc. tax)</span>
                <span style={{ color: '#4f46e5' }}>{fmt(cartTTC)}</span>
              </div>
              {notes && (
                <p style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: '#6b7280', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.5rem 0.75rem' }}>
                  📝 {notes}
                </p>
              )}
            </div>

            {error && (
              <div style={{ margin: '0 1.5rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.6rem 0.85rem', color: '#991b1b', fontSize: '0.8rem' }}>
                ⚠ {error}
              </div>
            )}

            {/* Actions */}
            <div style={{ padding: '1rem 1.5rem', display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={placing}
                style={{
                  flex: 1, padding: '0.75rem', border: '1.5px solid #e2e8f0',
                  borderRadius: '10px', background: '#fff', cursor: 'pointer',
                  fontSize: '0.9rem', fontWeight: 600, color: '#374151',
                }}
              >
                ← Edit Cart
              </button>
              <button
                onClick={handlePlaceOrder}
                disabled={placing}
                style={{
                  flex: 2, padding: '0.75rem',
                  background: placing ? '#a5b4fc' : 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                  color: '#fff', border: 'none', borderRadius: '10px',
                  fontSize: '0.95rem', fontWeight: 700, cursor: placing ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 16px rgba(79,70,229,0.3)',
                }}
              >
                {placing ? 'Placing order...' : '✓ Confirm Order'}
              </button>
            </div>
            <p style={{ textAlign: 'center', fontSize: '0.72rem', color: '#9ca3af', paddingBottom: '1rem', margin: 0 }}>
              Order will be reviewed and confirmed by our team
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
