# 📦 Order Management System - Advanced Tracking

## 🎯 What's New

Your app now has a **complete order management system** with:
- ✅ **Client Order Placement** - Clients can create orders using a dedicated endpoint
- ✅ **Order Status Tracking** - Complete history of all status changes
- ✅ **Admin Order Review** - Admins can see pending orders and approve/reject them
- ✅ **Status History Logging** - Track who changed what and when

---

## 📋 Database Setup

Before using the new features, you need to create the order tracking table in PostgreSQL:

### **Step 1: Connect to PostgreSQL**
```bash
psql -U postgres -d salespfe
```

### **Step 2: Run This SQL**
```sql
-- Create order status history table
CREATE TABLE IF NOT EXISTS order_status_history (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES sales_order(id) ON DELETE CASCADE,
  previous_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  changed_by INTEGER REFERENCES app_user(id),
  changed_at TIMESTAMP DEFAULT NOW(),
  notes VARCHAR(500)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_changed_at ON order_status_history(changed_at);

-- Optional: Add updated_at column to sales_order if it doesn't exist
ALTER TABLE sales_order ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
```

### **Step 3: Verify**
```sql
\dt order_status_history
-- Should show the table is created
```

---

## 🔌 API Endpoints

### **1. CLIENT: Create Order** 
**POST** `/api/orders/client/create`

**Authentication**: Required (Client must be logged in)

**Request Body**:
```json
{
  "items": [
    { "product_id": 1, "quantity": 5 },
    { "product_id": 3, "quantity": 2 }
  ],
  "notes": "Please deliver on Monday"
}
```

**Response**:
```json
{
  "message": "Order created successfully. Awaiting admin confirmation.",
  "order": {
    "id": 42,
    "order_date": "2026-05-21T10:30:00Z",
    "status": "pending",
    "amount_ht": 1500,
    "tva": 285,
    "amount_ttc": 1785,
    "client_id": 5,
    "user_id": 1,
    "lines": [
      { "product_id": 1, "quantity": 5, "unit_price": 100, "subtotal": 500, "product_name": "Widget A" },
      { "product_id": 3, "quantity": 2, "unit_price": 500, "subtotal": 1000, "product_name": "Widget B" }
    ]
  },
  "status_message": "Your order is pending admin approval"
}
```

---

### **2. ADMIN: Get Pending Client Orders**
**GET** `/api/orders/pending/admin`

**Authentication**: Required (Admin/Manager only)

**Response**:
```json
[
  {
    "id": 42,
    "order_date": "2026-05-21T10:30:00Z",
    "status": "pending",
    "amount_ttc": 1785,
    "client_name": "ACME Corp",
    "client_email": "contact@acme.com",
    "created_by_firstname": "Mohamed",
    "created_by_lastname": "Ali"
  }
]
```

---

### **3. ADMIN: Update Order Status**
**PUT** `/api/orders/:id/status`

**Authentication**: Required (Admin/Manager only)

**Request Body**:
```json
{
  "status": "confirmed",
  "notes": "Approved by manager. Stock reserved."
}
```

**Valid Status Values**:
- `pending` - Initial status (client created the order)
- `confirmed` - Admin approved the order
- `shipped` - Order has been shipped
- `delivered` - Order delivered to client
- `cancelled` - Order cancelled

**Response**:
```json
{
  "message": "Order status updated successfully",
  "order": {
    "id": 42,
    "status": "confirmed",
    "updated_at": "2026-05-21T11:00:00Z"
  }
}
```

---

### **4. CLIENT/ADMIN: Get Order Status History**
**GET** `/api/orders/:id/tracking`

**Authentication**: Required

**Response**:
```json
{
  "order": {
    "id": 42,
    "status": "shipped",
    "amount_ttc": 1785,
    "client_name": "ACME Corp",
    "order_date": "2026-05-21T10:30:00Z"
  },
  "history": [
    {
      "id": 1,
      "order_id": 42,
      "previous_status": null,
      "new_status": "pending",
      "changed_by": null,
      "changed_at": "2026-05-21T10:30:00Z",
      "notes": "Order placed by client",
      "user_firstname": null,
      "user_lastname": null
    },
    {
      "id": 2,
      "order_id": 42,
      "previous_status": "pending",
      "new_status": "confirmed",
      "changed_by": 1,
      "changed_at": "2026-05-21T11:00:00Z",
      "notes": "Approved by manager. Stock reserved.",
      "user_firstname": "Mohamed",
      "user_lastname": "Ali"
    },
    {
      "id": 3,
      "order_id": 42,
      "previous_status": "confirmed",
      "new_status": "shipped",
      "changed_by": 1,
      "changed_at": "2026-05-21T14:30:00Z",
      "notes": "Shipped via DHL",
      "user_firstname": "Mohamed",
      "user_lastname": "Ali"
    }
  ],
  "lines": [
    { "id": 1, "product_id": 1, "product_name": "Widget A", "quantity": 5, "unit_price": 100 }
  ],
  "summary": {
    "total_changes": 3,
    "current_status": "shipped",
    "created_at": "2026-05-21T10:30:00Z"
  }
}
```

---

## 💻 Frontend Integration Examples

### **Client Order Form**
```javascript
async function createClientOrder(items, notes) {
  const response = await fetch(`${API_URL}/orders/client/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ items, notes })
  });
  return response.json();
}

// Usage
const result = await createClientOrder(
  [
    { product_id: 1, quantity: 5 },
    { product_id: 3, quantity: 2 }
  ],
  'Rush delivery needed'
);
```

### **Admin Dashboard - Pending Orders**
```javascript
async function getPendingOrders() {
  const response = await fetch(`${API_URL}/orders/pending/admin`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  return response.json();
}

// Display in table
getPendingOrders().then(orders => {
  orders.forEach(order => {
    console.log(`Order #${order.id}: ${order.client_name} - $${order.amount_ttc}`);
  });
});
```

### **Order Tracking Timeline**
```javascript
async function getOrderTracking(orderId) {
  const response = await fetch(`${API_URL}/orders/${orderId}/tracking`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
}

// Display timeline
getOrderTracking(42).then(data => {
  data.history.forEach(event => {
    console.log(`${event.changed_at}: ${event.previous_status} → ${event.new_status}`);
    if (event.user_firstname) {
      console.log(`  Changed by: ${event.user_firstname} ${event.user_lastname}`);
    }
  });
});
```

---

## 🔄 Order Workflow

```
┌─────────────────────────────────────────────────────────┐
│ CLIENT                                                  │
│ 1. Logs in                                              │
│ 2. Selects products & quantities                        │
│ 3. Submits order → POST /orders/client/create           │
│ 4. Order created with status = "pending"                │
│ 5. Awaits admin approval                                │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ ADMIN                                                   │
│ 1. Logs in                                              │
│ 2. Views pending orders → GET /orders/pending/admin     │
│ 3. Reviews order details                                │
│ 4. Approves/Rejects → PUT /orders/:id/status            │
│    - If approved: status = "confirmed"                  │
│    - If rejected: status = "cancelled"                  │
│ 5. System logs the change in order_status_history       │
│ 6. Updates status as order progresses:                  │
│    confirmed → shipped → delivered                      │
│ 7. Each status change is logged with timestamp & notes  │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ CLIENT                                                  │
│ 1. Tracks order status → GET /orders/:id/tracking       │
│ 2. Sees complete history of all changes                 │
│ 3. Knows who changed status and when                    │
└─────────────────────────────────────────────────────────┘
```

---

## 🧪 Testing with Postman/cURL

### **Test 1: Client Creates Order**
```bash
curl -X POST http://localhost:5000/api/orders/client/create \
  -H "Authorization: Bearer YOUR_CLIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"product_id": 1, "quantity": 2}
    ],
    "notes": "Please deliver soon"
  }'
```

### **Test 2: Admin Views Pending Orders**
```bash
curl http://localhost:5000/api/orders/pending/admin \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### **Test 3: Admin Updates Order Status**
```bash
curl -X PUT http://localhost:5000/api/orders/42/status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "confirmed",
    "notes": "Approved and ready to process"
  }'
```

### **Test 4: View Order Tracking History**
```bash
curl http://localhost:5000/api/orders/42/tracking \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📊 Database Schema

```sql
-- Existing table (modified)
sales_order (
  id SERIAL PRIMARY KEY,
  order_date TIMESTAMP,
  status VARCHAR(50),      -- "pending", "confirmed", "shipped", "delivered", "cancelled"
  amount_ht DECIMAL,
  tva DECIMAL,
  amount_ttc DECIMAL,
  cancel_reason VARCHAR(500),
  client_id INTEGER REFERENCES client(id),
  user_id INTEGER REFERENCES app_user(id),
  updated_at TIMESTAMP     -- NEW: tracks last update
);

-- New table for tracking
order_status_history (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES sales_order(id),
  previous_status VARCHAR(50),    -- What status it changed FROM
  new_status VARCHAR(50),          -- What status it changed TO
  changed_by INTEGER REFERENCES app_user(id),  -- Who made the change
  changed_at TIMESTAMP DEFAULT NOW(),
  notes VARCHAR(500)               -- Optional reason/comment
);
```

---

## ✨ Key Features

✅ **Client Autonomy**: Clients can place orders anytime without admin intervention initially
✅ **Admin Control**: Admins must review and approve orders before processing
✅ **Complete Audit Trail**: Every status change is logged with timestamp and user info
✅ **Stock Management**: System validates stock before creating order
✅ **Error Handling**: Clear error messages if stock unavailable
✅ **Professional Workflow**: Mimics real e-commerce platforms

---

## 🚀 Next Steps (Optional Enhancements)

- [ ] Add email notifications when order status changes
- [ ] Create frontend dashboard for clients to view their orders
- [ ] Add rejection reason when admin cancels an order
- [ ] Implement automatic status transitions (e.g., auto-confirm after 24h)
- [ ] Add order history page for each client
- [ ] Create admin order management dashboard
- [ ] Send SMS notifications for delivery updates

---

## ❓ Troubleshooting

**Q: "Order creation failed - database error"**
- A: Make sure you've run the SQL migration to create `order_status_history` table

**Q: "Order is pending but I want to see it in the list"**
- A: Use `GET /api/orders/pending/admin` - this only shows pending orders

**Q: "Can I change an order status back to pending?"**
- A: Not with this system - status only moves forward (pending → confirmed → shipped → delivered)

**Q: "Where can I see all the status changes?"**
- A: Use `GET /api/orders/:id/tracking` - shows complete history with who changed it and when

---

Enjoy your advanced order tracking system! 🎉
