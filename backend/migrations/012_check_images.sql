-- ===============================================
-- DIAGNOSTIC QUERY — Check current image state
-- ===============================================
-- Run this in pgAdmin to see what images are currently stored

SELECT 
  reference, 
  name, 
  CASE 
    WHEN image IS NULL THEN '❌ NULL'
    WHEN image LIKE '/products/%' THEN '🎨 Local SVG'
    WHEN image LIKE 'http%' THEN '🌐 External URL'
    ELSE '❓ Unknown'
  END as image_type,
  LEFT(image, 50) as image_preview
FROM product 
ORDER BY reference;

-- Expected result: You should see 4 external URLs and 16 local SVG paths
-- If you see all NULL or old values, the migration didn't run successfully
