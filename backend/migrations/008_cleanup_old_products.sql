-- ===============================================
-- CLEANUP: Remove old/demo products, keep only
-- the 20 real tech products seeded in migration 004
-- ===============================================

-- These are the 20 references we want to KEEP
-- Everything else gets deleted (if not linked to orders)

-- Step 1: See what will be deleted (run this first to review)
SELECT id, reference, name, unit_price
FROM product
WHERE reference NOT IN (
  'LAP-DELL-5530', 'LAP-HP-840G9', 'PC-LENOVO-M70Q', 'LAP-ASUS-B1500',
  'PHN-SAM-A54',   'TAB-SAM-A8',   'PHN-XIAO-12T',
  'NET-TP-AX73',   'NET-CISCO-SG110', 'NET-UBNT-AP6',
  'MON-DELL-P2422H', 'KBD-LOG-MX',  'MSE-LOG-MX3',
  'SSD-SAM-870EVO', 'SSD-WD-SN770', 'RAM-KING-DDR4',
  'PRN-HP-M404DN', 'PRN-EPSON-L3250',
  'CAM-HIKVISION-2CD', 'NVR-HIKVISION-8CH'
)
ORDER BY id;

-- Step 2: Delete old products that are NOT linked to any order
-- (safe delete — won't break existing orders)
DELETE FROM product
WHERE reference NOT IN (
  'LAP-DELL-5530', 'LAP-HP-840G9', 'PC-LENOVO-M70Q', 'LAP-ASUS-B1500',
  'PHN-SAM-A54',   'TAB-SAM-A8',   'PHN-XIAO-12T',
  'NET-TP-AX73',   'NET-CISCO-SG110', 'NET-UBNT-AP6',
  'MON-DELL-P2422H', 'KBD-LOG-MX',  'MSE-LOG-MX3',
  'SSD-SAM-870EVO', 'SSD-WD-SN770', 'RAM-KING-DDR4',
  'PRN-HP-M404DN', 'PRN-EPSON-L3250',
  'CAM-HIKVISION-2CD', 'NVR-HIKVISION-8CH'
)
AND id NOT IN (
  -- Don't delete products that are referenced in existing orders
  SELECT DISTINCT product_id FROM order_line
);

-- Step 3: Verify — should show exactly 20 products
SELECT p.reference, p.name, p.unit_price, p.stock, p.image, c.name AS category
FROM product p
LEFT JOIN category c ON p.category_id = c.id
ORDER BY c.name, p.name;
