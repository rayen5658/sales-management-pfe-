-- ===============================================
-- PRODUCT IMAGES — FINAL VERSION
-- Real photos where available (4 products)
-- Professional SVG placeholders for the rest (16 products)
-- ===============================================

ALTER TABLE product ADD COLUMN IF NOT EXISTS image VARCHAR(500);

-- ✅ REAL PHOTOS (4 products with working URLs)
UPDATE product SET image = 'https://fdn2.gsmarena.com/vv/bigpic/xiaomi-12t-pro.jpg'
  WHERE reference = 'PHN-XIAO-12T';

UPDATE product SET image = 'https://resource.logitech.com/w_600,c_limit,q_auto,f_auto/d_transparent.gif/content/dam/logitech/en/products/mice/mx-master-3s/gallery/mx-master-3s-mouse-top-view-graphite.png'
  WHERE reference = 'MSE-LOG-MX3';

UPDATE product SET image = 'https://m.media-amazon.com/images/I/81+jNVOUsJL._AC_SL1500_.jpg'
  WHERE reference = 'SSD-SAM-870EVO';

UPDATE product SET image = 'https://fdn2.gsmarena.com/vv/bigpic/samsung-galaxy-tab-a8-2021.jpg'
  WHERE reference = 'TAB-SAM-A8';

-- 📦 STYLED SVG PLACEHOLDERS (16 products)
-- These are professional gradient cards with icons stored locally
UPDATE product SET image = '/products/LAP-DELL-5530.svg'    WHERE reference = 'LAP-DELL-5530';
UPDATE product SET image = '/products/LAP-HP-840G9.svg'     WHERE reference = 'LAP-HP-840G9';
UPDATE product SET image = '/products/PC-LENOVO-M70Q.svg'   WHERE reference = 'PC-LENOVO-M70Q';
UPDATE product SET image = '/products/LAP-ASUS-B1500.svg'   WHERE reference = 'LAP-ASUS-B1500';
UPDATE product SET image = '/products/PHN-SAM-A54.svg'      WHERE reference = 'PHN-SAM-A54';
UPDATE product SET image = '/products/NET-TP-AX73.svg'      WHERE reference = 'NET-TP-AX73';
UPDATE product SET image = '/products/NET-CISCO-SG110.svg'  WHERE reference = 'NET-CISCO-SG110';
UPDATE product SET image = '/products/NET-UBNT-AP6.svg'     WHERE reference = 'NET-UBNT-AP6';
UPDATE product SET image = '/products/MON-DELL-P2422H.svg'  WHERE reference = 'MON-DELL-P2422H';
UPDATE product SET image = '/products/KBD-LOG-MX.svg'       WHERE reference = 'KBD-LOG-MX';
UPDATE product SET image = '/products/SSD-WD-SN770.svg'     WHERE reference = 'SSD-WD-SN770';
UPDATE product SET image = '/products/RAM-KING-DDR4.svg'    WHERE reference = 'RAM-KING-DDR4';
UPDATE product SET image = '/products/PRN-HP-M404DN.svg'    WHERE reference = 'PRN-HP-M404DN';
UPDATE product SET image = '/products/PRN-EPSON-L3250.svg'  WHERE reference = 'PRN-EPSON-L3250';
UPDATE product SET image = '/products/CAM-HIKVISION-2CD.svg' WHERE reference = 'CAM-HIKVISION-2CD';
UPDATE product SET image = '/products/NVR-HIKVISION-8CH.svg' WHERE reference = 'NVR-HIKVISION-8CH';

-- Verify:
-- SELECT reference, name, image FROM product ORDER BY reference;
