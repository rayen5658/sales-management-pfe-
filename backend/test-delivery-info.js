async function testOrderCreation() {
  try {
    // First get the client token
    const loginRes = await fetch('http://localhost:5000/api/client-auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@client.com', password: 'client123' })
    });

    const loginData = await loginRes.json();
    console.log('Login response:', loginData);
    
    if (!loginData.token) {
      throw new Error('No token in response');
    }
    
    const token = loginData.token;
    console.log('✅ Client logged in');

    // Create an order with delivery information
    const orderRes = await fetch('http://localhost:5000/api/client-portal/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        items: [{ product_id: 32, quantity: 1 }],
        notes: 'Contact: John Doe | Phone: +216 71 234 567 | Address: 456 Rue de la Paix | Region: Sfax | Notes: Test delivery info'
      })
    });

    const orderData = await orderRes.json();
    console.log('Order response:', orderData);
    
    if (!orderData.order) {
      throw new Error('No order in response');
    }
    
    console.log('✅ Order created:', orderData.order.id);

    // Check the database to verify notes were saved
    const pool = require('./db');
    const result = await pool.query(
      'SELECT id, notes FROM sales_order WHERE id = $1',
      [orderData.order.id]
    );

    console.log('\n📋 Order details in database:');
    console.log(JSON.stringify(result.rows[0], null, 2));
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testOrderCreation();
