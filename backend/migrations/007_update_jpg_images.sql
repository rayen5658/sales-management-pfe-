-- Update products that now have real JPG photos
UPDATE product SET image = '/products/LAP-ASUS-B1500.jpg'   WHERE reference = 'LAP-ASUS-B1500';
UPDATE product SET image = '/products/LAP-DELL-5530.jpg'    WHERE reference = 'LAP-DELL-5530';
UPDATE product SET image = '/products/LAP-HP-840G9.jpg'     WHERE reference = 'LAP-HP-840G9';
UPDATE product SET image = '/products/MON-DELL-P2422H.jpg'  WHERE reference = 'MON-DELL-P2422H';
UPDATE product SET image = '/products/NET-CISCO-SG110.jpg'  WHERE reference = 'NET-CISCO-SG110';

-- Verify
SELECT reference, name, image FROM product ORDER BY reference;
