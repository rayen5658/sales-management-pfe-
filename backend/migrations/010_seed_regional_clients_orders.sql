-- ===============================================
-- SEED: Regional clients across Tunisia + their orders
-- Covers all 24 governorates on the map
-- ===============================================

DO $$
DECLARE
  u1 INT;
  -- New client IDs
  c_tunis INT; c_sfax INT; c_sousse INT; c_nabeul INT;
  c_monastir INT; c_ariana INT; c_gabes INT; c_kairouan INT;
  c_gafsa INT; c_medenine INT; c_jendouba INT; c_beja INT;
  c_mahdia INT; c_sidi_bouzid INT; c_siliana INT; c_zaghouan INT;
  c_ben_arous INT; c_manouba INT; c_tozeur INT; c_kebili INT;
  c_tataouine INT; c_kasserine INT; c_kef INT;
  -- Product IDs
  p_lap_dell INT; p_lap_hp INT; p_lap_asus INT; p_pc_lenovo INT;
  p_phn_sam INT; p_phn_xiao INT; p_tab_sam INT;
  p_net_tp INT; p_net_cisco INT; p_net_ubnt INT;
  p_mon_dell INT; p_kbd_log INT; p_mse_log INT;
  p_ssd_sam INT; p_ssd_wd INT; p_ram_king INT;
  p_prn_hp INT; p_prn_epson INT; p_cam INT; p_nvr INT;
  oid INT; ht NUMERIC; tva NUMERIC; ttc NUMERIC;
BEGIN
  SELECT id INTO u1 FROM app_user LIMIT 1;

  -- Product IDs
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
  -- INSERT NEW CLIENTS (one per region)
  -- ═══════════════════════════════════════════
  INSERT INTO client (company_name, address, region, email, phone, segment, status) VALUES
    ('TechPro Tunis',        '12 Avenue Habib Bourguiba, Tunis',       'Tunis',        'contact@techpro-tunis.tn',     '+216 71 234 567', 'Enterprise', 'active')
    RETURNING id INTO c_tunis;

  INSERT INTO client (company_name, address, region, email, phone, segment, status) VALUES
    ('Sfax IT Solutions',    '45 Rue Farhat Hached, Sfax',             'Sfax',         'info@sfax-it.tn',              '+216 74 345 678', 'SMB',        'active')
    RETURNING id INTO c_sfax;

  INSERT INTO client (company_name, address, region, email, phone, segment, status) VALUES
    ('Sousse Digital Hub',   '8 Boulevard de la Corniche, Sousse',     'Sousse',       'hello@sousse-digital.tn',      '+216 73 456 789', 'Enterprise', 'active')
    RETURNING id INTO c_sousse;

  INSERT INTO client (company_name, address, region, email, phone, segment, status) VALUES
    ('Nabeul Tech Store',    '23 Avenue Ali Belhouane, Nabeul',        'Nabeul',       'sales@nabeul-tech.tn',         '+216 72 567 890', 'SMB',        'active')
    RETURNING id INTO c_nabeul;

  INSERT INTO client (company_name, address, region, email, phone, segment, status) VALUES
    ('Monastir InfoSys',     '5 Rue de l''Indépendance, Monastir',     'Monastir',     'contact@monastir-info.tn',     '+216 73 678 901', 'SMB',        'active')
    RETURNING id INTO c_monastir;

  INSERT INTO client (company_name, address, region, email, phone, segment, status) VALUES
    ('Ariana Systems',       '17 Avenue de la République, Ariana',     'Ariana',       'info@ariana-systems.tn',       '+216 71 789 012', 'Enterprise', 'active')
    RETURNING id INTO c_ariana;

  INSERT INTO client (company_name, address, region, email, phone, segment, status) VALUES
    ('Gabès Tech Services',  '31 Avenue Habib Thameur, Gabès',         'Gabès',        'contact@gabes-tech.tn',        '+216 75 890 123', 'SMB',        'active')
    RETURNING id INTO c_gabes;

  INSERT INTO client (company_name, address, region, email, phone, segment, status) VALUES
    ('Kairouan Networks',    '9 Rue Okba Ibn Nafaa, Kairouan',         'Kairouan',     'sales@kairouan-net.tn',        '+216 77 901 234', 'SMB',        'active')
    RETURNING id INTO c_kairouan;

  INSERT INTO client (company_name, address, region, email, phone, segment, status) VALUES
    ('Gafsa Informatique',   '14 Avenue du 7 Novembre, Gafsa',         'Gafsa',        'info@gafsa-info.tn',           '+216 76 012 345', 'Retail',     'active')
    RETURNING id INTO c_gafsa;

  INSERT INTO client (company_name, address, region, email, phone, segment, status) VALUES
    ('Medenine Digital',     '6 Rue de la Liberté, Medenine',          'Médenine',     'contact@medenine-digital.tn',  '+216 75 123 456', 'Retail',     'active')
    RETURNING id INTO c_medenine;

  INSERT INTO client (company_name, address, region, email, phone, segment, status) VALUES
    ('Jendouba Tech',        '22 Avenue Bourguiba, Jendouba',          'Jendouba',     'sales@jendouba-tech.tn',       '+216 78 234 567', 'SMB',        'active')
    RETURNING id INTO c_jendouba;

  INSERT INTO client (company_name, address, region, email, phone, segment, status) VALUES
    ('Béja IT Center',       '11 Rue 18 Janvier, Béja',                'Béja',         'info@beja-it.tn',              '+216 78 345 678', 'Retail',     'active')
    RETURNING id INTO c_beja;

  INSERT INTO client (company_name, address, region, email, phone, segment, status) VALUES
    ('Mahdia Solutions',     '3 Avenue Farhat Hached, Mahdia',         'Mahdia',       'contact@mahdia-solutions.tn',  '+216 73 456 789', 'SMB',        'active')
    RETURNING id INTO c_mahdia;

  INSERT INTO client (company_name, address, region, email, phone, segment, status) VALUES
    ('Sidi Bouzid Network',  '7 Avenue de l''Environnement, Sidi Bouzid', 'Sidi Bouzid', 'info@sidi-bouzid-net.tn',   '+216 76 567 890', 'Retail',     'active')
    RETURNING id INTO c_sidi_bouzid;

  INSERT INTO client (company_name, address, region, email, phone, segment, status) VALUES
    ('Siliana Computers',    '15 Rue de Tunis, Siliana',               'Siliana',      'sales@siliana-comp.tn',        '+216 78 678 901', 'Retail',     'active')
    RETURNING id INTO c_siliana;

  INSERT INTO client (company_name, address, region, email, phone, segment, status) VALUES
    ('Zaghouan Systems',     '4 Avenue de la Jeunesse, Zaghouan',      'Zaghouan',     'contact@zaghouan-sys.tn',      '+216 72 789 012', 'Retail',     'active')
    RETURNING id INTO c_zaghouan;

  INSERT INTO client (company_name, address, region, email, phone, segment, status) VALUES
    ('Ben Arous Tech',       '28 Route de Sfax, Ben Arous',            'Ben Arous',    'info@benarous-tech.tn',        '+216 71 890 123', 'Enterprise', 'active')
    RETURNING id INTO c_ben_arous;

  INSERT INTO client (company_name, address, region, email, phone, segment, status) VALUES
    ('Manouba InfoPro',      '19 Avenue de la Liberté, Manouba',       'Manouba',      'sales@manouba-info.tn',        '+216 71 901 234', 'SMB',        'active')
    RETURNING id INTO c_manouba;

  INSERT INTO client (company_name, address, region, email, phone, segment, status) VALUES
    ('Tozeur Desert Tech',   '2 Avenue Abou El Kacem Chebbi, Tozeur',  'Tozeur',       'contact@tozeur-tech.tn',       '+216 76 012 345', 'Retail',     'active')
    RETURNING id INTO c_tozeur;

  INSERT INTO client (company_name, address, region, email, phone, segment, status) VALUES
    ('Kébili Networks',      '8 Rue de la République, Kébili',         'Kébili',       'info@kebili-net.tn',           '+216 75 123 456', 'Retail',     'active')
    RETURNING id INTO c_kebili;

  INSERT INTO client (company_name, address, region, email, phone, segment, status) VALUES
    ('Tataouine Security',   '12 Avenue Habib Bourguiba, Tataouine',   'Tataouine',    'sales@tataouine-sec.tn',       '+216 75 234 567', 'SMB',        'active')
    RETURNING id INTO c_tataouine;

  INSERT INTO client (company_name, address, region, email, phone, segment, status) VALUES
    ('Kasserine IT Pro',     '6 Rue Farhat Hached, Kasserine',         'Kasserine',    'contact@kasserine-it.tn',      '+216 77 345 678', 'Retail',     'active')
    RETURNING id INTO c_kasserine;

  INSERT INTO client (company_name, address, region, email, phone, segment, status) VALUES
    ('Le Kef Systems',       '9 Avenue de l''AIN, Le Kef',             'Le Kef',       'info@lekef-sys.tn',            '+216 78 456 789', 'Retail',     'active')
    RETURNING id INTO c_kef;

  -- ═══════════════════════════════════════════
  -- ORDERS per region (spread across months)
  -- ═══════════════════════════════════════════

  -- Tunis — Enterprise — big order
  ht := (2850.000*3)+(2450.000*2)+(895.000*5)+(385.000*8);
  tva := ht*0.19; ttc := ht+tva;
  INSERT INTO sales_order (order_date,status,amount_ht,tva,amount_ttc,client_id,user_id)
  VALUES ('2026-01-15','delivered',ht,tva,ttc,c_tunis,u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id,product_id,quantity,unit_price,subtotal) VALUES
    (oid,p_lap_dell,3,2850.000,8550.000),(oid,p_lap_hp,2,2450.000,4900.000),
    (oid,p_mon_dell,5,895.000,4475.000),(oid,p_kbd_log,8,385.000,3080.000);
  INSERT INTO order_status_history(order_id,previous_status,new_status,changed_by) VALUES
    (oid,NULL,'pending',u1),(oid,'pending','confirmed',u1),(oid,'confirmed','shipped',u1),(oid,'shipped','delivered',u1);

  -- Sfax — SMB — networking
  ht := (620.000*4)+(750.000*3)+(485.000*6);
  tva := ht*0.19; ttc := ht+tva;
  INSERT INTO sales_order (order_date,status,amount_ht,tva,amount_ttc,client_id,user_id)
  VALUES ('2026-01-28','delivered',ht,tva,ttc,c_sfax,u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id,product_id,quantity,unit_price,subtotal) VALUES
    (oid,p_net_cisco,4,620.000,2480.000),(oid,p_net_ubnt,3,750.000,2250.000),(oid,p_net_tp,6,485.000,2910.000);
  INSERT INTO order_status_history(order_id,previous_status,new_status,changed_by) VALUES
    (oid,NULL,'pending',u1),(oid,'pending','confirmed',u1),(oid,'confirmed','shipped',u1),(oid,'shipped','delivered',u1);

  -- Sousse — Enterprise — phones + laptops
  ht := (1250.000*6)+(1680.000*3)+(1890.000*2);
  tva := ht*0.19; ttc := ht+tva;
  INSERT INTO sales_order (order_date,status,amount_ht,tva,amount_ttc,client_id,user_id)
  VALUES ('2026-02-10','delivered',ht,tva,ttc,c_sousse,u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id,product_id,quantity,unit_price,subtotal) VALUES
    (oid,p_phn_sam,6,1250.000,7500.000),(oid,p_phn_xiao,3,1680.000,5040.000),(oid,p_lap_asus,2,1890.000,3780.000);
  INSERT INTO order_status_history(order_id,previous_status,new_status,changed_by) VALUES
    (oid,NULL,'pending',u1),(oid,'pending','confirmed',u1),(oid,'confirmed','shipped',u1),(oid,'shipped','delivered',u1);

  -- Nabeul — SMB — storage + peripherals
  ht := (420.000*15)+(285.000*20)+(195.000*25)+(320.000*10);
  tva := ht*0.19; ttc := ht+tva;
  INSERT INTO sales_order (order_date,status,amount_ht,tva,amount_ttc,client_id,user_id)
  VALUES ('2026-02-22','delivered',ht,tva,ttc,c_nabeul,u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id,product_id,quantity,unit_price,subtotal) VALUES
    (oid,p_ssd_sam,15,420.000,6300.000),(oid,p_ssd_wd,20,285.000,5700.000),
    (oid,p_ram_king,25,195.000,4875.000),(oid,p_mse_log,10,320.000,3200.000);
  INSERT INTO order_status_history(order_id,previous_status,new_status,changed_by) VALUES
    (oid,NULL,'pending',u1),(oid,'pending','confirmed',u1),(oid,'confirmed','shipped',u1),(oid,'shipped','delivered',u1);

  -- Monastir — SMB — printers + security
  ht := (1450.000*2)+(680.000*3)+(485.000*5)+(1250.000*1);
  tva := ht*0.19; ttc := ht+tva;
  INSERT INTO sales_order (order_date,status,amount_ht,tva,amount_ttc,client_id,user_id)
  VALUES ('2026-03-05','delivered',ht,tva,ttc,c_monastir,u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id,product_id,quantity,unit_price,subtotal) VALUES
    (oid,p_prn_hp,2,1450.000,2900.000),(oid,p_prn_epson,3,680.000,2040.000),
    (oid,p_cam,5,485.000,2425.000),(oid,p_nvr,1,1250.000,1250.000);
  INSERT INTO order_status_history(order_id,previous_status,new_status,changed_by) VALUES
    (oid,NULL,'pending',u1),(oid,'pending','confirmed',u1),(oid,'confirmed','shipped',u1),(oid,'shipped','delivered',u1);

  -- Ariana — Enterprise — full office
  ht := (1650.000*5)+(2850.000*2)+(895.000*6)+(385.000*10)+(320.000*10);
  tva := ht*0.19; ttc := ht+tva;
  INSERT INTO sales_order (order_date,status,amount_ht,tva,amount_ttc,client_id,user_id)
  VALUES ('2026-03-18','delivered',ht,tva,ttc,c_ariana,u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id,product_id,quantity,unit_price,subtotal) VALUES
    (oid,p_pc_lenovo,5,1650.000,8250.000),(oid,p_lap_dell,2,2850.000,5700.000),
    (oid,p_mon_dell,6,895.000,5370.000),(oid,p_kbd_log,10,385.000,3850.000),(oid,p_mse_log,10,320.000,3200.000);
  INSERT INTO order_status_history(order_id,previous_status,new_status,changed_by) VALUES
    (oid,NULL,'pending',u1),(oid,'pending','confirmed',u1),(oid,'confirmed','shipped',u1),(oid,'shipped','delivered',u1);

  -- Gabès — SMB — tablets + phones
  ht := (890.000*4)+(1250.000*3);
  tva := ht*0.19; ttc := ht+tva;
  INSERT INTO sales_order (order_date,status,amount_ht,tva,amount_ttc,client_id,user_id)
  VALUES ('2026-03-28','delivered',ht,tva,ttc,c_gabes,u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id,product_id,quantity,unit_price,subtotal) VALUES
    (oid,p_tab_sam,4,890.000,3560.000),(oid,p_phn_sam,3,1250.000,3750.000);
  INSERT INTO order_status_history(order_id,previous_status,new_status,changed_by) VALUES
    (oid,NULL,'pending',u1),(oid,'pending','confirmed',u1),(oid,'confirmed','shipped',u1),(oid,'shipped','delivered',u1);

  -- Kairouan — SMB — networking
  ht := (485.000*4)+(620.000*2)+(750.000*2);
  tva := ht*0.19; ttc := ht+tva;
  INSERT INTO sales_order (order_date,status,amount_ht,tva,amount_ttc,client_id,user_id)
  VALUES ('2026-04-08','delivered',ht,tva,ttc,c_kairouan,u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id,product_id,quantity,unit_price,subtotal) VALUES
    (oid,p_net_tp,4,485.000,1940.000),(oid,p_net_cisco,2,620.000,1240.000),(oid,p_net_ubnt,2,750.000,1500.000);
  INSERT INTO order_status_history(order_id,previous_status,new_status,changed_by) VALUES
    (oid,NULL,'pending',u1),(oid,'pending','confirmed',u1),(oid,'confirmed','shipped',u1),(oid,'shipped','delivered',u1);

  -- Gafsa — Retail — small order
  ht := (1890.000*1)+(420.000*3)+(195.000*5);
  tva := ht*0.19; ttc := ht+tva;
  INSERT INTO sales_order (order_date,status,amount_ht,tva,amount_ttc,client_id,user_id)
  VALUES ('2026-04-15','delivered',ht,tva,ttc,c_gafsa,u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id,product_id,quantity,unit_price,subtotal) VALUES
    (oid,p_lap_asus,1,1890.000,1890.000),(oid,p_ssd_sam,3,420.000,1260.000),(oid,p_ram_king,5,195.000,975.000);
  INSERT INTO order_status_history(order_id,previous_status,new_status,changed_by) VALUES
    (oid,NULL,'pending',u1),(oid,'pending','confirmed',u1),(oid,'confirmed','shipped',u1),(oid,'shipped','delivered',u1);

  -- Médenine — Retail — security cameras
  ht := (485.000*6)+(1250.000*2);
  tva := ht*0.19; ttc := ht+tva;
  INSERT INTO sales_order (order_date,status,amount_ht,tva,amount_ttc,client_id,user_id)
  VALUES ('2026-04-25','delivered',ht,tva,ttc,c_medenine,u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id,product_id,quantity,unit_price,subtotal) VALUES
    (oid,p_cam,6,485.000,2910.000),(oid,p_nvr,2,1250.000,2500.000);
  INSERT INTO order_status_history(order_id,previous_status,new_status,changed_by) VALUES
    (oid,NULL,'pending',u1),(oid,'pending','confirmed',u1),(oid,'confirmed','shipped',u1),(oid,'shipped','delivered',u1);

  -- Jendouba — SMB
  ht := (2450.000*1)+(680.000*2)+(320.000*4);
  tva := ht*0.19; ttc := ht+tva;
  INSERT INTO sales_order (order_date,status,amount_ht,tva,amount_ttc,client_id,user_id)
  VALUES ('2026-05-03','delivered',ht,tva,ttc,c_jendouba,u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id,product_id,quantity,unit_price,subtotal) VALUES
    (oid,p_lap_hp,1,2450.000,2450.000),(oid,p_prn_epson,2,680.000,1360.000),(oid,p_mse_log,4,320.000,1280.000);
  INSERT INTO order_status_history(order_id,previous_status,new_status,changed_by) VALUES
    (oid,NULL,'pending',u1),(oid,'pending','confirmed',u1),(oid,'confirmed','shipped',u1),(oid,'shipped','delivered',u1);

  -- Béja — Retail
  ht := (1650.000*1)+(195.000*8)+(285.000*5);
  tva := ht*0.19; ttc := ht+tva;
  INSERT INTO sales_order (order_date,status,amount_ht,tva,amount_ttc,client_id,user_id)
  VALUES ('2026-05-12','delivered',ht,tva,ttc,c_beja,u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id,product_id,quantity,unit_price,subtotal) VALUES
    (oid,p_pc_lenovo,1,1650.000,1650.000),(oid,p_ram_king,8,195.000,1560.000),(oid,p_ssd_wd,5,285.000,1425.000);
  INSERT INTO order_status_history(order_id,previous_status,new_status,changed_by) VALUES
    (oid,NULL,'pending',u1),(oid,'pending','confirmed',u1),(oid,'confirmed','shipped',u1),(oid,'shipped','delivered',u1);

  -- Mahdia — SMB
  ht := (890.000*3)+(1250.000*2)+(385.000*5);
  tva := ht*0.19; ttc := ht+tva;
  INSERT INTO sales_order (order_date,status,amount_ht,tva,amount_ttc,client_id,user_id)
  VALUES ('2026-05-20','delivered',ht,tva,ttc,c_mahdia,u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id,product_id,quantity,unit_price,subtotal) VALUES
    (oid,p_tab_sam,3,890.000,2670.000),(oid,p_phn_sam,2,1250.000,2500.000),(oid,p_kbd_log,5,385.000,1925.000);
  INSERT INTO order_status_history(order_id,previous_status,new_status,changed_by) VALUES
    (oid,NULL,'pending',u1),(oid,'pending','confirmed',u1),(oid,'confirmed','shipped',u1),(oid,'shipped','delivered',u1);

  -- Sidi Bouzid — Retail
  ht := (485.000*3)+(420.000*4);
  tva := ht*0.19; ttc := ht+tva;
  INSERT INTO sales_order (order_date,status,amount_ht,tva,amount_ttc,client_id,user_id)
  VALUES ('2026-05-28','delivered',ht,tva,ttc,c_sidi_bouzid,u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id,product_id,quantity,unit_price,subtotal) VALUES
    (oid,p_net_tp,3,485.000,1455.000),(oid,p_ssd_sam,4,420.000,1680.000);
  INSERT INTO order_status_history(order_id,previous_status,new_status,changed_by) VALUES
    (oid,NULL,'pending',u1),(oid,'pending','confirmed',u1),(oid,'confirmed','shipped',u1),(oid,'shipped','delivered',u1);

  -- Siliana — Retail
  ht := (1890.000*1)+(895.000*1)+(320.000*2);
  tva := ht*0.19; ttc := ht+tva;
  INSERT INTO sales_order (order_date,status,amount_ht,tva,amount_ttc,client_id,user_id)
  VALUES ('2026-06-01','confirmed',ht,tva,ttc,c_siliana,u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id,product_id,quantity,unit_price,subtotal) VALUES
    (oid,p_lap_asus,1,1890.000,1890.000),(oid,p_mon_dell,1,895.000,895.000),(oid,p_mse_log,2,320.000,640.000);
  INSERT INTO order_status_history(order_id,previous_status,new_status,changed_by) VALUES
    (oid,NULL,'pending',u1),(oid,'pending','confirmed',u1);

  -- Zaghouan — Retail
  ht := (1650.000*1)+(285.000*6);
  tva := ht*0.19; ttc := ht+tva;
  INSERT INTO sales_order (order_date,status,amount_ht,tva,amount_ttc,client_id,user_id)
  VALUES ('2026-06-02','confirmed',ht,tva,ttc,c_zaghouan,u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id,product_id,quantity,unit_price,subtotal) VALUES
    (oid,p_pc_lenovo,1,1650.000,1650.000),(oid,p_ssd_wd,6,285.000,1710.000);
  INSERT INTO order_status_history(order_id,previous_status,new_status,changed_by) VALUES
    (oid,NULL,'pending',u1),(oid,'pending','confirmed',u1);

  -- Ben Arous — Enterprise
  ht := (2850.000*4)+(1650.000*3)+(895.000*4)+(485.000*8);
  tva := ht*0.19; ttc := ht+tva;
  INSERT INTO sales_order (order_date,status,amount_ht,tva,amount_ttc,client_id,user_id)
  VALUES ('2026-06-03','shipped',ht,tva,ttc,c_ben_arous,u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id,product_id,quantity,unit_price,subtotal) VALUES
    (oid,p_lap_dell,4,2850.000,11400.000),(oid,p_pc_lenovo,3,1650.000,4950.000),
    (oid,p_mon_dell,4,895.000,3580.000),(oid,p_net_tp,8,485.000,3880.000);
  INSERT INTO order_status_history(order_id,previous_status,new_status,changed_by) VALUES
    (oid,NULL,'pending',u1),(oid,'pending','confirmed',u1),(oid,'confirmed','shipped',u1);

  -- Manouba — SMB
  ht := (1250.000*4)+(750.000*2)+(385.000*6);
  tva := ht*0.19; ttc := ht+tva;
  INSERT INTO sales_order (order_date,status,amount_ht,tva,amount_ttc,client_id,user_id)
  VALUES ('2026-06-04','pending',ht,tva,ttc,c_manouba,u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id,product_id,quantity,unit_price,subtotal) VALUES
    (oid,p_phn_sam,4,1250.000,5000.000),(oid,p_net_ubnt,2,750.000,1500.000),(oid,p_kbd_log,6,385.000,2310.000);
  INSERT INTO order_status_history(order_id,previous_status,new_status,changed_by) VALUES
    (oid,NULL,'pending',u1);

  -- Tozeur — Retail
  ht := (485.000*2)+(680.000*1);
  tva := ht*0.19; ttc := ht+tva;
  INSERT INTO sales_order (order_date,status,amount_ht,tva,amount_ttc,client_id,user_id)
  VALUES ('2026-06-04','pending',ht,tva,ttc,c_tozeur,u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id,product_id,quantity,unit_price,subtotal) VALUES
    (oid,p_net_tp,2,485.000,970.000),(oid,p_prn_epson,1,680.000,680.000);
  INSERT INTO order_status_history(order_id,previous_status,new_status,changed_by) VALUES
    (oid,NULL,'pending',u1);

  -- Kébili — Retail
  ht := (1450.000*1)+(320.000*3);
  tva := ht*0.19; ttc := ht+tva;
  INSERT INTO sales_order (order_date,status,amount_ht,tva,amount_ttc,client_id,user_id)
  VALUES ('2026-06-05','pending',ht,tva,ttc,c_kebili,u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id,product_id,quantity,unit_price,subtotal) VALUES
    (oid,p_prn_hp,1,1450.000,1450.000),(oid,p_mse_log,3,320.000,960.000);
  INSERT INTO order_status_history(order_id,previous_status,new_status,changed_by) VALUES
    (oid,NULL,'pending',u1);

  -- Tataouine — SMB — security
  ht := (485.000*4)+(1250.000*1);
  tva := ht*0.19; ttc := ht+tva;
  INSERT INTO sales_order (order_date,status,amount_ht,tva,amount_ttc,client_id,user_id)
  VALUES ('2026-06-05','confirmed',ht,tva,ttc,c_tataouine,u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id,product_id,quantity,unit_price,subtotal) VALUES
    (oid,p_cam,4,485.000,1940.000),(oid,p_nvr,1,1250.000,1250.000);
  INSERT INTO order_status_history(order_id,previous_status,new_status,changed_by) VALUES
    (oid,NULL,'pending',u1),(oid,'pending','confirmed',u1);

  -- Kasserine — Retail
  ht := (890.000*2)+(195.000*6);
  tva := ht*0.19; ttc := ht+tva;
  INSERT INTO sales_order (order_date,status,amount_ht,tva,amount_ttc,client_id,user_id)
  VALUES ('2026-06-06','pending',ht,tva,ttc,c_kasserine,u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id,product_id,quantity,unit_price,subtotal) VALUES
    (oid,p_tab_sam,2,890.000,1780.000),(oid,p_ram_king,6,195.000,1170.000);
  INSERT INTO order_status_history(order_id,previous_status,new_status,changed_by) VALUES
    (oid,NULL,'pending',u1);

  -- Le Kef — Retail
  ht := (1680.000*1)+(420.000*2);
  tva := ht*0.19; ttc := ht+tva;
  INSERT INTO sales_order (order_date,status,amount_ht,tva,amount_ttc,client_id,user_id)
  VALUES ('2026-06-06','pending',ht,tva,ttc,c_kef,u1) RETURNING id INTO oid;
  INSERT INTO order_line (order_id,product_id,quantity,unit_price,subtotal) VALUES
    (oid,p_phn_xiao,1,1680.000,1680.000),(oid,p_ssd_sam,2,420.000,840.000);
  INSERT INTO order_status_history(order_id,previous_status,new_status,changed_by) VALUES
    (oid,NULL,'pending',u1);

  RAISE NOTICE 'Done! 23 new clients + 23 orders across all Tunisian regions.';
END $$;

-- Verify regions coverage
SELECT c.region, COUNT(so.id) as orders, SUM(so.amount_ttc) as revenue
FROM client c
LEFT JOIN sales_order so ON so.client_id = c.id
GROUP BY c.region
ORDER BY revenue DESC NULLS LAST;
