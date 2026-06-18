-- ===============================================
-- SEED REALISTIC ORDERS — fills the dashboard
-- Run in pgAdmin on the salespfe database
-- ===============================================

-- We'll use existing clients and the 20 real products.
-- Get client IDs and product IDs dynamically so this
-- works regardless of exact IDs in your database.

DO $$
DECLARE
  c1 INT; c2 INT; c3 INT; c4 INT; c5 INT;
  u1 INT;
  p_lap_dell INT; p_lap_hp INT; p_lap_asus INT; p_pc_lenovo INT;
  p_phn_sam INT; p_phn_xiao INT; p_tab_sam INT;
  p_net_tp INT; p_net_cisco INT; p_net_ubnt INT;
  p_mon_dell INT; p_kbd_log INT; p_mse_log INT;
  p_ssd_sam INT; p_ssd_wd INT; p_ram_king INT;
  p_prn_hp INT; p_prn_epson INT;
  p_cam INT; p_nvr INT;
  oid INT;
  ht NUMERIC; tva NUMERIC; ttc NUMERIC;
BEGIN
  -- Get first admin user
  SELECT id INTO u1 FROM app_user LIMIT 1;

  -- Get up to 5 clients
  SELECT id INTO c1 FROM client WHERE status = 'active' LIMIT 1 OFFSET 0;
  SELECT id INTO c2 FROM client WHERE status = 'active' LIMIT 1 OFFSET 1;
  SELECT id INTO c3 FROM client WHERE status = 'active' LIMIT 1 OFFSET 2;
  SELECT id INTO c4 FROM client WHERE status = 'active' LIMIT 1 OFFSET 3;
  SELECT id INTO c5 FROM client WHERE status = 'active' LIMIT 1 OFFSET 4;

  -- Fallback: if fewer than 5 clients, reuse c1
  IF c2 IS NULL THEN c2 := c1; END IF;
  IF c3 IS NULL THEN c3 := c1; END IF;
  IF c4 IS NULL THEN c4 := c1; END IF;
  IF c5 IS NULL THEN c5 := c1; END IF;

  -- Get product IDs
  SELECT id INTO p_lap_dell   FROM product WHERE reference = 'LAP-DELL-5530';
  SELECT id INTO p_lap_hp     FROM product WHERE reference = 'LAP-HP-840G9';
  SELECT id INTO p_lap_asus   FROM product WHERE reference = 'LAP-ASUS-B1500';
  SELECT id INTO p_pc_lenovo  FROM product WHERE reference = 'PC-LENOVO-M70Q';
  SELECT id INTO p_phn_sam    FROM product WHERE reference = 'PHN-SAM-A54';
  SELECT id INTO p_phn_xiao   FROM product WHERE reference = 'PHN-XIAO-12T';
  SELECT id INTO p_tab_sam    FROM product WHERE reference = 'TAB-SAM-A8';
  SELECT id INTO p_net_tp     FROM product WHERE reference = 'NET-TP-AX73';
  SELECT id INTO p_net_cisco  FROM product WHERE reference = 'NET-CISCO-SG110';
  SELECT id INTO p_net_ubnt   FROM product WHERE reference = 'NET-UBNT-AP6';
  SELECT id INTO p_mon_dell   FROM product WHERE reference = 'MON-DELL-P2422H';
  SELECT id INTO p_kbd_log    FROM product WHERE reference = 'KBD-LOG-MX';
  SELECT id INTO p_mse_log    FROM product WHERE reference = 'MSE-LOG-MX3';
  SELECT id INTO p_ssd_sam    FROM product WHERE reference = 'SSD-SAM-870EVO';
  SELECT id INTO p_ssd_wd     FROM product WHERE reference = 'SSD-WD-SN770';
  SELECT id INTO p_ram_king   FROM product WHERE reference = 'RAM-KING-DDR4';
  SELECT id INTO p_prn_hp     FROM product WHERE reference = 'PRN-HP-M404DN';
  SELECT id INTO p_prn_epson  FROM product WHERE reference = 'PRN-EPSON-L3250';
  SELECT id INTO p_cam        FROM product WHERE reference = 'CAM-HIKVISION-2CD';
  SELECT id INTO p_nvr        FROM product WHERE reference = 'NVR-HIKVISION-8CH';

  -- ═══════════════════════════════════════════
  -- ORDER 1 — January — delivered — laptops
  -- ═══════════════════════════════════════════
  ht  := (2850.000 * 2) + (2450.000 * 1);
  tva := ht * 0.19;
  ttc := ht + tva;
  INSERT INTO sales_order (order_date, status, amount_ht, tva, amount_ttc, client_id, user_id)
  VALUES ('2026-01-10', 'delivered', ht, tva, ttc, c1, u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id, product_id, quantity, unit_price, subtotal) VALUES
    (oid, p_lap_dell, 2, 2850.000, 5700.000),
    (oid, p_lap_hp,   1, 2450.000, 2450.000);
  INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by) VALUES
    (oid, NULL, 'pending', u1), (oid, 'pending', 'confirmed', u1),
    (oid, 'confirmed', 'shipped', u1), (oid, 'shipped', 'delivered', u1);

  -- ═══════════════════════════════════════════
  -- ORDER 2 — January — delivered — networking
  -- ═══════════════════════════════════════════
  ht  := (620.000 * 3) + (750.000 * 2);
  tva := ht * 0.19;
  ttc := ht + tva;
  INSERT INTO sales_order (order_date, status, amount_ht, tva, amount_ttc, client_id, user_id)
  VALUES ('2026-01-18', 'delivered', ht, tva, ttc, c2, u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id, product_id, quantity, unit_price, subtotal) VALUES
    (oid, p_net_cisco, 3, 620.000, 1860.000),
    (oid, p_net_ubnt,  2, 750.000, 1500.000);
  INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by) VALUES
    (oid, NULL, 'pending', u1), (oid, 'pending', 'confirmed', u1),
    (oid, 'confirmed', 'shipped', u1), (oid, 'shipped', 'delivered', u1);

  -- ═══════════════════════════════════════════
  -- ORDER 3 — February — delivered — phones + tablets
  -- ═══════════════════════════════════════════
  ht  := (1250.000 * 5) + (1680.000 * 2) + (890.000 * 3);
  tva := ht * 0.19;
  ttc := ht + tva;
  INSERT INTO sales_order (order_date, status, amount_ht, tva, amount_ttc, client_id, user_id)
  VALUES ('2026-02-05', 'delivered', ht, tva, ttc, c3, u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id, product_id, quantity, unit_price, subtotal) VALUES
    (oid, p_phn_sam,  5, 1250.000, 6250.000),
    (oid, p_phn_xiao, 2, 1680.000, 3360.000),
    (oid, p_tab_sam,  3,  890.000, 2670.000);
  INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by) VALUES
    (oid, NULL, 'pending', u1), (oid, 'pending', 'confirmed', u1),
    (oid, 'confirmed', 'shipped', u1), (oid, 'shipped', 'delivered', u1);

  -- ═══════════════════════════════════════════
  -- ORDER 4 — February — delivered — peripherals + storage
  -- ═══════════════════════════════════════════
  ht  := (895.000 * 4) + (385.000 * 6) + (320.000 * 6) + (420.000 * 10);
  tva := ht * 0.19;
  ttc := ht + tva;
  INSERT INTO sales_order (order_date, status, amount_ht, tva, amount_ttc, client_id, user_id)
  VALUES ('2026-02-20', 'delivered', ht, tva, ttc, c1, u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id, product_id, quantity, unit_price, subtotal) VALUES
    (oid, p_mon_dell, 4,  895.000, 3580.000),
    (oid, p_kbd_log,  6,  385.000, 2310.000),
    (oid, p_mse_log,  6,  320.000, 1920.000),
    (oid, p_ssd_sam, 10,  420.000, 4200.000);
  INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by) VALUES
    (oid, NULL, 'pending', u1), (oid, 'pending', 'confirmed', u1),
    (oid, 'confirmed', 'shipped', u1), (oid, 'shipped', 'delivered', u1);

  -- ═══════════════════════════════════════════
  -- ORDER 5 — March — delivered — security
  -- ═══════════════════════════════════════════
  ht  := (485.000 * 8) + (1250.000 * 2);
  tva := ht * 0.19;
  ttc := ht + tva;
  INSERT INTO sales_order (order_date, status, amount_ht, tva, amount_ttc, client_id, user_id)
  VALUES ('2026-03-08', 'delivered', ht, tva, ttc, c4, u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id, product_id, quantity, unit_price, subtotal) VALUES
    (oid, p_cam, 8, 485.000, 3880.000),
    (oid, p_nvr, 2, 1250.000, 2500.000);
  INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by) VALUES
    (oid, NULL, 'pending', u1), (oid, 'pending', 'confirmed', u1),
    (oid, 'confirmed', 'shipped', u1), (oid, 'shipped', 'delivered', u1);

  -- ═══════════════════════════════════════════
  -- ORDER 6 — March — delivered — full office setup
  -- ═══════════════════════════════════════════
  ht  := (1890.000 * 3) + (1650.000 * 2) + (1450.000 * 1) + (680.000 * 2);
  tva := ht * 0.19;
  ttc := ht + tva;
  INSERT INTO sales_order (order_date, status, amount_ht, tva, amount_ttc, client_id, user_id)
  VALUES ('2026-03-22', 'delivered', ht, tva, ttc, c2, u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id, product_id, quantity, unit_price, subtotal) VALUES
    (oid, p_lap_asus,  3, 1890.000, 5670.000),
    (oid, p_pc_lenovo, 2, 1650.000, 3300.000),
    (oid, p_prn_hp,    1, 1450.000, 1450.000),
    (oid, p_prn_epson, 2,  680.000, 1360.000);
  INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by) VALUES
    (oid, NULL, 'pending', u1), (oid, 'pending', 'confirmed', u1),
    (oid, 'confirmed', 'shipped', u1), (oid, 'shipped', 'delivered', u1);

  -- ═══════════════════════════════════════════
  -- ORDER 7 — April — delivered — laptops bulk
  -- ═══════════════════════════════════════════
  ht  := (2850.000 * 3) + (1890.000 * 4);
  tva := ht * 0.19;
  ttc := ht + tva;
  INSERT INTO sales_order (order_date, status, amount_ht, tva, amount_ttc, client_id, user_id)
  VALUES ('2026-04-05', 'delivered', ht, tva, ttc, c5, u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id, product_id, quantity, unit_price, subtotal) VALUES
    (oid, p_lap_dell, 3, 2850.000, 8550.000),
    (oid, p_lap_asus, 4, 1890.000, 7560.000);
  INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by) VALUES
    (oid, NULL, 'pending', u1), (oid, 'pending', 'confirmed', u1),
    (oid, 'confirmed', 'shipped', u1), (oid, 'shipped', 'delivered', u1);

  -- ═══════════════════════════════════════════
  -- ORDER 8 — April — delivered — networking + storage
  -- ═══════════════════════════════════════════
  ht  := (485.000 * 5) + (620.000 * 2) + (285.000 * 20) + (195.000 * 15);
  tva := ht * 0.19;
  ttc := ht + tva;
  INSERT INTO sales_order (order_date, status, amount_ht, tva, amount_ttc, client_id, user_id)
  VALUES ('2026-04-18', 'delivered', ht, tva, ttc, c3, u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id, product_id, quantity, unit_price, subtotal) VALUES
    (oid, p_net_tp,   5,  485.000, 2425.000),
    (oid, p_net_cisco,2,  620.000, 1240.000),
    (oid, p_ssd_wd,  20,  285.000, 5700.000),
    (oid, p_ram_king,15,  195.000, 2925.000);
  INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by) VALUES
    (oid, NULL, 'pending', u1), (oid, 'pending', 'confirmed', u1),
    (oid, 'confirmed', 'shipped', u1), (oid, 'shipped', 'delivered', u1);

  -- ═══════════════════════════════════════════
  -- ORDER 9 — May — delivered — phones
  -- ═══════════════════════════════════════════
  ht  := (1250.000 * 8) + (890.000 * 5);
  tva := ht * 0.19;
  ttc := ht + tva;
  INSERT INTO sales_order (order_date, status, amount_ht, tva, amount_ttc, client_id, user_id)
  VALUES ('2026-05-10', 'delivered', ht, tva, ttc, c4, u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id, product_id, quantity, unit_price, subtotal) VALUES
    (oid, p_phn_sam, 8, 1250.000, 10000.000),
    (oid, p_tab_sam, 5,  890.000,  4450.000);
  INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by) VALUES
    (oid, NULL, 'pending', u1), (oid, 'pending', 'confirmed', u1),
    (oid, 'confirmed', 'shipped', u1), (oid, 'shipped', 'delivered', u1);

  -- ═══════════════════════════════════════════
  -- ORDER 10 — May — shipped (in transit)
  -- ═══════════════════════════════════════════
  ht  := (2450.000 * 2) + (895.000 * 3) + (385.000 * 5);
  tva := ht * 0.19;
  ttc := ht + tva;
  INSERT INTO sales_order (order_date, status, amount_ht, tva, amount_ttc, client_id, user_id,
    tracking_number, delivery_company, estimated_delivery)
  VALUES ('2026-05-28', 'shipped', ht, tva, ttc, c1, u1,
    'DYN-487392', 'Dynamic Delivery', '2026-06-08') RETURNING id INTO oid;
  INSERT INTO order_line (order_id, product_id, quantity, unit_price, subtotal) VALUES
    (oid, p_lap_hp,   2, 2450.000, 4900.000),
    (oid, p_mon_dell, 3,  895.000, 2685.000),
    (oid, p_kbd_log,  5,  385.000, 1925.000);
  INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by) VALUES
    (oid, NULL, 'pending', u1), (oid, 'pending', 'confirmed', u1),
    (oid, 'confirmed', 'shipped', u1);

  -- ═══════════════════════════════════════════
  -- ORDER 11 — June — confirmed (processing)
  -- ═══════════════════════════════════════════
  ht  := (1450.000 * 2) + (680.000 * 3) + (750.000 * 4);
  tva := ht * 0.19;
  ttc := ht + tva;
  INSERT INTO sales_order (order_date, status, amount_ht, tva, amount_ttc, client_id, user_id)
  VALUES ('2026-06-02', 'confirmed', ht, tva, ttc, c2, u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id, product_id, quantity, unit_price, subtotal) VALUES
    (oid, p_prn_hp,    2, 1450.000, 2900.000),
    (oid, p_prn_epson, 3,  680.000, 2040.000),
    (oid, p_net_ubnt,  4,  750.000, 3000.000);
  INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by) VALUES
    (oid, NULL, 'pending', u1), (oid, 'pending', 'confirmed', u1);

  -- ═══════════════════════════════════════════
  -- ORDER 12 — June — pending (just placed by client)
  -- ═══════════════════════════════════════════
  ht  := (485.000 * 4) + (1250.000 * 1);
  tva := ht * 0.19;
  ttc := ht + tva;
  INSERT INTO sales_order (order_date, status, amount_ht, tva, amount_ttc, client_id, user_id)
  VALUES ('2026-06-05', 'pending', ht, tva, ttc, c5, u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id, product_id, quantity, unit_price, subtotal) VALUES
    (oid, p_cam, 4,  485.000, 1940.000),
    (oid, p_nvr, 1, 1250.000, 1250.000);
  INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by) VALUES
    (oid, NULL, 'pending', u1);

  RAISE NOTICE 'Done — 12 orders seeded successfully!';
END $$;

-- Verify
SELECT
  COUNT(*) AS total_orders,
  SUM(amount_ttc) AS total_revenue_ttc,
  COUNT(CASE WHEN status = 'delivered' THEN 1 END) AS delivered,
  COUNT(CASE WHEN status = 'shipped'   THEN 1 END) AS shipped,
  COUNT(CASE WHEN status = 'confirmed' THEN 1 END) AS confirmed,
  COUNT(CASE WHEN status = 'pending'   THEN 1 END) AS pending
FROM sales_order;
