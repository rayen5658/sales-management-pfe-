-- ===============================================
-- TECH PRODUCTS SEED DATA
-- Run this in pgAdmin to populate realistic demo products
-- ===============================================

-- First ensure categories exist
INSERT INTO category (name, description) VALUES
  ('Laptops & Computers',  'Portable and desktop computing solutions')
ON CONFLICT DO NOTHING;

INSERT INTO category (name, description) VALUES
  ('Smartphones & Tablets','Mobile devices and accessories')
ON CONFLICT DO NOTHING;

INSERT INTO category (name, description) VALUES
  ('Networking',           'Routers, switches, access points and cabling')
ON CONFLICT DO NOTHING;

INSERT INTO category (name, description) VALUES
  ('Peripherals',          'Monitors, keyboards, mice and input devices')
ON CONFLICT DO NOTHING;

INSERT INTO category (name, description) VALUES
  ('Storage & Memory',     'SSDs, HDDs, RAM and flash storage')
ON CONFLICT DO NOTHING;

INSERT INTO category (name, description) VALUES
  ('Printers & Scanners',  'Laser and inkjet printers, document scanners')
ON CONFLICT DO NOTHING;

INSERT INTO category (name, description) VALUES
  ('Security & Surveillance', 'IP cameras, NVRs and access control systems')
ON CONFLICT DO NOTHING;

-- ── LAPTOPS & COMPUTERS ──────────────────────────────────────────────────────
INSERT INTO product (reference, name, description, unit_price, stock, category_id) VALUES
(
  'LAP-DELL-5530',
  'Dell Latitude 5530 Business Laptop',
  'Intel Core i7-1265U (12th Gen) · 16 GB DDR4 RAM · 512 GB NVMe SSD · 15.6" Full HD IPS · Windows 11 Pro · MIL-STD-810H certified · Fingerprint reader · Backlit keyboard · 3-year ProSupport warranty. Ideal for enterprise deployments requiring reliability and security.',
  2850.000, 12,
  (SELECT id FROM category WHERE name = 'Laptops & Computers' LIMIT 1)
),
(
  'LAP-HP-840G9',
  'HP EliteBook 840 G9 Ultrabook',
  'Intel Core i5-1235U · 8 GB LPDDR5 · 256 GB SSD · 14" FHD IPS anti-glare · HP Sure Start BIOS protection · HP Wolf Security · USB-C Thunderbolt 4 · Wi-Fi 6E · 400-nit display. Slim business ultrabook with enterprise-grade security features.',
  2450.000, 8,
  (SELECT id FROM category WHERE name = 'Laptops & Computers' LIMIT 1)
),
(
  'PC-LENOVO-M70Q',
  'Lenovo ThinkCentre M70q Tiny Desktop',
  'Intel Core i5-12400T · 8 GB DDR4 · 256 GB SSD · Intel UHD 730 · 4x USB 3.2 · HDMI + DisplayPort · Wi-Fi 6 · Bluetooth 5.1 · Windows 11 Pro · Ultra-compact form factor (1L). Perfect for space-constrained office environments.',
  1650.000, 15,
  (SELECT id FROM category WHERE name = 'Laptops & Computers' LIMIT 1)
),
(
  'LAP-ASUS-B1500',
  'ASUS ExpertBook B1500 Business Laptop',
  'Intel Core i3-1115G4 · 8 GB DDR4 · 512 GB SSD · 15.6" FHD · Military-grade durability · TPM 2.0 · Kensington lock slot · 42 Wh battery (up to 10h) · Windows 11 Pro. Entry-level business laptop with solid build quality.',
  1890.000, 20,
  (SELECT id FROM category WHERE name = 'Laptops & Computers' LIMIT 1)
);

-- ── SMARTPHONES & TABLETS ────────────────────────────────────────────────────
INSERT INTO product (reference, name, description, unit_price, stock, category_id) VALUES
(
  'PHN-SAM-A54',
  'Samsung Galaxy A54 5G',
  '6.4" Super AMOLED 120Hz · Exynos 1380 octa-core · 8 GB RAM · 256 GB storage · 50 MP triple camera · 5000 mAh battery · IP67 water resistance · Android 13 · 5G connectivity. Reliable mid-range smartphone for business users.',
  1250.000, 25,
  (SELECT id FROM category WHERE name = 'Smartphones & Tablets' LIMIT 1)
),
(
  'TAB-SAM-A8',
  'Samsung Galaxy Tab A8 10.5"',
  '10.5" TFT LCD 1920×1200 · Unisoc T618 · 4 GB RAM · 128 GB storage · 7040 mAh battery · USB-C · Wi-Fi 5 · Android 11 · Slim metal design. Ideal for field workers, POS systems and digital signage.',
  890.000, 18,
  (SELECT id FROM category WHERE name = 'Smartphones & Tablets' LIMIT 1)
),
(
  'PHN-XIAO-12T',
  'Xiaomi 12T Pro Smartphone',
  '6.67" AMOLED 144Hz · Snapdragon 8+ Gen 1 · 12 GB RAM · 256 GB UFS 3.1 · 200 MP main camera · 120W HyperCharge (full charge in 19 min) · 5000 mAh · Android 12 · MIUI 13. Flagship performance at competitive price.',
  1680.000, 10,
  (SELECT id FROM category WHERE name = 'Smartphones & Tablets' LIMIT 1)
);

-- ── NETWORKING ───────────────────────────────────────────────────────────────
INSERT INTO product (reference, name, description, unit_price, stock, category_id) VALUES
(
  'NET-TP-AX73',
  'TP-Link Archer AX73 Wi-Fi 6 Router',
  'AX5400 dual-band Wi-Fi 6 · 4× Gigabit LAN · 1× Gigabit WAN · 6 high-gain antennas · OFDMA + MU-MIMO · OneMesh compatible · USB 3.0 port · Supports up to 80 devices simultaneously. Ideal for SMB offices with high device density.',
  485.000, 30,
  (SELECT id FROM category WHERE name = 'Networking' LIMIT 1)
),
(
  'NET-CISCO-SG110',
  'Cisco SG110-16 16-Port Gigabit Switch',
  '16× 10/100/1000 Mbps ports · Plug-and-play unmanaged · Fanless silent operation · Auto MDI/MDIX · IEEE 802.3az Energy Efficient Ethernet · Metal housing · Rack-mountable. Reliable layer-2 switching for small office networks.',
  620.000, 22,
  (SELECT id FROM category WHERE name = 'Networking' LIMIT 1)
),
(
  'NET-UBNT-AP6',
  'Ubiquiti UniFi AP U6 Lite Access Point',
  'Wi-Fi 6 (802.11ax) · 2.4 GHz + 5 GHz · Up to 300 Mbps + 1.5 Gbps · OFDMA · 4× spatial streams · PoE powered (802.3af) · Ceiling mount included · UniFi controller compatible · Ideal for high-density deployments.',
  750.000, 14,
  (SELECT id FROM category WHERE name = 'Networking' LIMIT 1)
);

-- ── PERIPHERALS ──────────────────────────────────────────────────────────────
INSERT INTO product (reference, name, description, unit_price, stock, category_id) VALUES
(
  'MON-DELL-P2422H',
  'Dell P2422H 24" Full HD Monitor',
  '24" IPS panel · 1920×1080 · 60 Hz · 5 ms response · 99% sRGB · HDMI + DisplayPort + VGA · USB 3.2 hub (4 ports) · Height/tilt/swivel/pivot adjustable · VESA 100×100 · Flicker-free · ComfortView low blue light. Professional-grade display for office workstations.',
  895.000, 20,
  (SELECT id FROM category WHERE name = 'Peripherals' LIMIT 1)
),
(
  'KBD-LOG-MX',
  'Logitech MX Keys Advanced Wireless Keyboard',
  'Full-size backlit keyboard · Smart illumination (auto-adjusts to ambient light) · Bluetooth + USB receiver · Multi-device (up to 3) · USB-C rechargeable · 10-day battery · Compatible Windows/macOS/Linux · Quiet tactile keys. Premium productivity keyboard.',
  385.000, 35,
  (SELECT id FROM category WHERE name = 'Peripherals' LIMIT 1)
),
(
  'MSE-LOG-MX3',
  'Logitech MX Master 3S Wireless Mouse',
  '8000 DPI MagSpeed electromagnetic scroll · Bluetooth + USB receiver · Multi-device (up to 3) · USB-C rechargeable · 70-day battery · 7 programmable buttons · Ergonomic design · Works on glass surfaces. The gold standard for productivity mice.',
  320.000, 40,
  (SELECT id FROM category WHERE name = 'Peripherals' LIMIT 1)
);

-- ── STORAGE & MEMORY ─────────────────────────────────────────────────────────
INSERT INTO product (reference, name, description, unit_price, stock, category_id) VALUES
(
  'SSD-SAM-870EVO',
  'Samsung 870 EVO 1TB SATA SSD',
  '1 TB capacity · SATA III 6 Gb/s · Sequential read 560 MB/s · Sequential write 530 MB/s · V-NAND 3-bit MLC · DRAM cache · 2.5" form factor · 5-year warranty · TBW: 600 TB. Industry-leading reliability for desktop and laptop upgrades.',
  420.000, 50,
  (SELECT id FROM category WHERE name = 'Storage & Memory' LIMIT 1)
),
(
  'SSD-WD-SN770',
  'WD Black SN770 500GB NVMe SSD',
  '500 GB · PCIe Gen4 NVMe M.2 2280 · Sequential read 5150 MB/s · Sequential write 4900 MB/s · No DRAM (HMB) · 5-year warranty · TBW: 300 TB. High-performance NVMe for gaming PCs and workstations.',
  285.000, 45,
  (SELECT id FROM category WHERE name = 'Storage & Memory' LIMIT 1)
),
(
  'RAM-KING-DDR4',
  'Kingston Fury Beast 16GB DDR4-3200',
  '16 GB (2×8 GB) kit · DDR4-3200 MHz · CL16 · XMP 2.0 · Low-profile heat spreader · Intel & AMD compatible · Plug-and-play at 2666 MHz without XMP · Lifetime warranty. Reliable RAM upgrade for desktops and workstations.',
  195.000, 60,
  (SELECT id FROM category WHERE name = 'Storage & Memory' LIMIT 1)
);

-- ── PRINTERS & SCANNERS ──────────────────────────────────────────────────────
INSERT INTO product (reference, name, description, unit_price, stock, category_id) VALUES
(
  'PRN-HP-M404DN',
  'HP LaserJet Pro M404dn Monochrome Printer',
  '38 ppm · 1200×1200 dpi · Automatic duplex · Gigabit Ethernet + USB · 256 MB RAM · 250-sheet tray · First page out: 6.4 sec · Monthly duty cycle: 80,000 pages · JetIntelligence toner. High-speed monochrome laser for busy offices.',
  1450.000, 8,
  (SELECT id FROM category WHERE name = 'Printers & Scanners' LIMIT 1)
),
(
  'PRN-EPSON-L3250',
  'Epson EcoTank L3250 Color Inkjet Printer',
  'Print/Scan/Copy · Wi-Fi + USB · 33 ppm black / 15 ppm color · 5760×1440 dpi · Borderless printing up to A4 · Ink tank system (no cartridges) · Up to 4500 black / 7500 color pages per fill · Mobile printing (Epson iPrint). Ultra-low running cost for high-volume color printing.',
  680.000, 15,
  (SELECT id FROM category WHERE name = 'Printers & Scanners' LIMIT 1)
);

-- ── SECURITY & SURVEILLANCE ──────────────────────────────────────────────────
INSERT INTO product (reference, name, description, unit_price, stock, category_id) VALUES
(
  'CAM-HIKVISION-2CD',
  'Hikvision DS-2CD2143G2-I 4MP IP Camera',
  '4 MP AcuSense · 2.8mm fixed lens · IR night vision 40m · H.265+ compression · IP67 weatherproof · IK10 vandal-resistant · PoE (802.3af) · Motion detection · MicroSD slot (up to 256 GB) · ONVIF compatible. Professional outdoor surveillance camera.',
  485.000, 20,
  (SELECT id FROM category WHERE name = 'Security & Surveillance' LIMIT 1)
),
(
  'NVR-HIKVISION-8CH',
  'Hikvision DS-7608NI-K2 8-Channel NVR',
  '8-channel IP NVR · Up to 8 MP recording · H.265+ · 2× SATA HDD bays (up to 10 TB each) · HDMI + VGA output · 4K decoding · Remote access via Hik-Connect · Motion detection · Smart search · Supports Hikvision & ONVIF cameras.',
  1250.000, 6,
  (SELECT id FROM category WHERE name = 'Security & Surveillance' LIMIT 1)
);

-- ===============================================
-- Verification
-- ===============================================
-- SELECT p.name, p.unit_price, p.stock, c.name AS category
-- FROM product p LEFT JOIN category c ON p.category_id = c.id
-- ORDER BY c.name, p.name;
