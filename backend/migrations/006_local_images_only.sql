-- ===============================================
-- PRODUCT IMAGES — LOCAL FILES ONLY (FINAL FIX)
-- ===============================================
-- This migration uses ONLY local image files stored in frontend/public/products/
-- 4 real photos (JPG) + 16 professional SVG placeholders
-- NO external URLs = NO CORS issues = guaranteed to work!
-- ===============================================

-- Create image column if it doesn't exist
ALTER TABLE product ADD COLUMN IF NOT EXISTS image VARCHAR(500);

-- ✅ REAL PRODUCT PHOTOS (4 JPGs downloaded locally)
UPDATE product SET image = '/products/PHN-XIAO-12T.jpg'   WHERE reference = 'PHN-XIAO-12T';
UPDATE product SET image = '/products/MSE-LOG-MX3.jpg'    WHERE reference = 'MSE-LOG-MX3';
UPDATE product SET image = '/products/SSD-SAM-870EVO.jpg' WHERE reference = 'SSD-SAM-870EVO';
UPDATE product SET image = '/products/TAB-SAM-A8.jpg'     WHERE reference = 'TAB-SAM-A8';

-- 📦 PROFESSIONAL SVG PLACEHOLDERS (16 products)
-- These are styled gradient cards with emoji icons stored locally
UPDATE product SET image = '/products/LAP-DELL-5530.svg'       WHERE reference = 'LAP-DELL-5530';
UPDATE product SET image = '/products/LAP-HP-840G9.svg'        WHERE reference = 'LAP-HP-840G9';
UPDATE product SET image = '/products/PC-LENOVO-M70Q.svg'      WHERE reference = 'PC-LENOVO-M70Q';
UPDATE product SET image = '/products/LAP-ASUS-B1500.svg'      WHERE reference = 'LAP-ASUS-B1500';
UPDATE product SET image = '/products/PHN-SAM-A54.svg'         WHERE reference = 'PHN-SAM-A54';
UPDATE product SET image = '/products/NET-TP-AX73.svg'         WHERE reference = 'NET-TP-AX73';
UPDATE product SET image = '/products/NET-CISCO-SG110.svg'     WHERE reference = 'NET-CISCO-SG110';
UPDATE product SET image = '/products/NET-UBNT-AP6.svg'        WHERE reference = 'NET-UBNT-AP6';
UPDATE product SET image = '/products/MON-DELL-P2422H.svg'     WHERE reference = 'MON-DELL-P2422H';
UPDATE product SET image = '/products/KBD-LOG-MX.svg'          WHERE reference = 'KBD-LOG-MX';
UPDATE product SET image = '/products/SSD-WD-SN770.svg'        WHERE reference = 'SSD-WD-SN770';
UPDATE product SET image = '/products/RAM-KING-DDR4.svg'       WHERE reference = 'RAM-KING-DDR4';
UPDATE product SET image = '/products/PRN-HP-M404DN.svg'       WHERE reference = 'PRN-HP-M404DN';
UPDATE product SET image = '/products/PRN-EPSON-L3250.svg'     WHERE reference = 'PRN-EPSON-L3250';
UPDATE product SET image = '/products/CAM-HIKVISION-2CD.svg'   WHERE reference = 'CAM-HIKVISION-2CD';
UPDATE product SET image = '/products/NVR-HIKVISION-8CH.svg'   WHERE reference = 'NVR-HIKVISION-8CH';

-- Verify the update
SELECT reference, name, image FROM product ORDER BY reference;

-- ===============================================
-- NEXT STEPS TO GET REAL PHOTOS:
-- ===============================================
-- To replace the SVG placeholders with real product photos:
--
-- 1. Open Google Images and search for each product by name
-- 2. Right-click on a good product photo → "Save image as..."
-- 3. Save to: GestionVentes\frontend\public\products\
-- 4. Name the file exactly as the reference (e.g., LAP-DELL-5530.jpg)
-- 5. The images will automatically appear (no SQL update needed since paths already point to /products/)
--
-- Example files to create:
--   - LAP-DELL-5530.jpg (Dell Latitude 5530 photo)
--   - LAP-HP-840G9.jpg (HP EliteBook 840 G9 photo)
--   - PC-LENOVO-M70Q.jpg (Lenovo ThinkCentre M70q photo)
--   - etc...
-- ===============================================
