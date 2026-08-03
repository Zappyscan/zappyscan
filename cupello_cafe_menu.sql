-- ============================================================
-- Cupello Cafe - Full Menu Import
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

DO $$
DECLARE
  v_rid UUID;
  c_starters      UUID;
  c_momos         UUID;
  c_pan_momos     UUID;
  c_popcorn       UUID;
  c_strips        UUID;
  c_wings         UUID;
  c_lollipop      UUID;
  c_sandwich      UUID;
  c_fc_burger     UUID;
  c_ck_burger     UUID;
  c_veg_burger    UUID;
  c_maggi         UUID;
  c_pizza         UUID;
  c_pasta         UUID;
  c_wrap          UUID;
  c_ice_cream     UUID;
  c_waffle        UUID;
  c_iced_tea      UUID;
  c_tea           UUID;
  c_coffee        UUID;
  c_choc_bev      UUID;
  c_thickshake    UUID;
  c_mojito        UUID;
  c_fresh_juice   UUID;
  c_combos        UUID;
BEGIN
  -- Find Cupello Cafe
  SELECT id INTO v_rid FROM restaurants WHERE name ILIKE '%cupello%' LIMIT 1;
  IF v_rid IS NULL THEN
    RAISE EXCEPTION 'Cupello Cafe not found in restaurants table';
  END IF;

  -- Clear existing menu for Cupello Cafe
  DELETE FROM menu_items WHERE restaurant_id = v_rid;
  DELETE FROM categories  WHERE restaurant_id = v_rid;

  -- ── Create categories ──────────────────────────────────────
  INSERT INTO categories (restaurant_id, name, display_order, is_active) VALUES (v_rid, 'Starters',            1,  true) RETURNING id INTO c_starters;
  INSERT INTO categories (restaurant_id, name, display_order, is_active) VALUES (v_rid, 'Momos',               2,  true) RETURNING id INTO c_momos;
  INSERT INTO categories (restaurant_id, name, display_order, is_active) VALUES (v_rid, 'Pan Fry Momos',       3,  true) RETURNING id INTO c_pan_momos;
  INSERT INTO categories (restaurant_id, name, display_order, is_active) VALUES (v_rid, 'Fried Chicken - Popcorn', 4, true) RETURNING id INTO c_popcorn;
  INSERT INTO categories (restaurant_id, name, display_order, is_active) VALUES (v_rid, 'Fried Chicken - Strips',  5, true) RETURNING id INTO c_strips;
  INSERT INTO categories (restaurant_id, name, display_order, is_active) VALUES (v_rid, 'Fried Chicken - Wings',   6, true) RETURNING id INTO c_wings;
  INSERT INTO categories (restaurant_id, name, display_order, is_active) VALUES (v_rid, 'Fried Chicken - Lollipop',7, true) RETURNING id INTO c_lollipop;
  INSERT INTO categories (restaurant_id, name, display_order, is_active) VALUES (v_rid, 'Sandwich',            8,  true) RETURNING id INTO c_sandwich;
  INSERT INTO categories (restaurant_id, name, display_order, is_active) VALUES (v_rid, 'Fried Chicken Burger',9,  true) RETURNING id INTO c_fc_burger;
  INSERT INTO categories (restaurant_id, name, display_order, is_active) VALUES (v_rid, 'Chicken Burger',      10, true) RETURNING id INTO c_ck_burger;
  INSERT INTO categories (restaurant_id, name, display_order, is_active) VALUES (v_rid, 'Veg Burger',          11, true) RETURNING id INTO c_veg_burger;
  INSERT INTO categories (restaurant_id, name, display_order, is_active) VALUES (v_rid, 'Maggi',               12, true) RETURNING id INTO c_maggi;
  INSERT INTO categories (restaurant_id, name, display_order, is_active) VALUES (v_rid, 'Pizza',               13, true) RETURNING id INTO c_pizza;
  INSERT INTO categories (restaurant_id, name, display_order, is_active) VALUES (v_rid, 'Pasta',               14, true) RETURNING id INTO c_pasta;
  INSERT INTO categories (restaurant_id, name, display_order, is_active) VALUES (v_rid, 'Wrap',                15, true) RETURNING id INTO c_wrap;
  INSERT INTO categories (restaurant_id, name, display_order, is_active) VALUES (v_rid, 'Ice Creams',          16, true) RETURNING id INTO c_ice_cream;
  INSERT INTO categories (restaurant_id, name, display_order, is_active) VALUES (v_rid, 'Waffle',              17, true) RETURNING id INTO c_waffle;
  INSERT INTO categories (restaurant_id, name, display_order, is_active) VALUES (v_rid, 'Iced Tea',            18, true) RETURNING id INTO c_iced_tea;
  INSERT INTO categories (restaurant_id, name, display_order, is_active) VALUES (v_rid, 'Tea',                 19, true) RETURNING id INTO c_tea;
  INSERT INTO categories (restaurant_id, name, display_order, is_active) VALUES (v_rid, 'Coffee',              20, true) RETURNING id INTO c_coffee;
  INSERT INTO categories (restaurant_id, name, display_order, is_active) VALUES (v_rid, 'Chocolate Beverages', 21, true) RETURNING id INTO c_choc_bev;
  INSERT INTO categories (restaurant_id, name, display_order, is_active) VALUES (v_rid, 'Thickshakes',         22, true) RETURNING id INTO c_thickshake;
  INSERT INTO categories (restaurant_id, name, display_order, is_active) VALUES (v_rid, 'Mojito',              23, true) RETURNING id INTO c_mojito;
  INSERT INTO categories (restaurant_id, name, display_order, is_active) VALUES (v_rid, 'Fresh Juice',         24, true) RETURNING id INTO c_fresh_juice;
  INSERT INTO categories (restaurant_id, name, display_order, is_active) VALUES (v_rid, 'Combos',              25, true) RETURNING id INTO c_combos;

  -- ── STARTERS ─────────────────────────────────────────────
  INSERT INTO menu_items (restaurant_id, category_id, name, price, is_vegetarian, is_available, display_order) VALUES
    (v_rid, c_starters, 'Jalapeno Cheese Pops (7)',  119, true,  true, 1),
    (v_rid, c_starters, 'Chicken Nuggets (7)',        109, false, true, 2),
    (v_rid, c_starters, 'Chicken Loaded Fries',       189, false, true, 3),
    (v_rid, c_starters, 'Peri Peri Fries',            119, true,  true, 4),
    (v_rid, c_starters, 'Lemon Chilli Fries',         119, true,  true, 5),
    (v_rid, c_starters, 'Classic Salted Fries',        99, true,  true, 6),
    (v_rid, c_starters, 'Cheesy Fries',               129, true,  true, 7),
    (v_rid, c_starters, 'Paneer Loaded Fries',        149, true,  true, 8),
    (v_rid, c_starters, 'Paneer Pops (7)',            129, true,  true, 9);

  -- ── MOMOS (Fried / Steamed) ───────────────────────────────
  INSERT INTO menu_items (restaurant_id, category_id, name, price, description, is_vegetarian, is_available, display_order) VALUES
    (v_rid, c_momos, 'Chicken Momos (Steamed)',       119, 'Soft steamed momos with chicken filling',        false, true, 1),
    (v_rid, c_momos, 'Chicken Momos (Fried)',         139, 'Crispy fried momos with chicken filling',        false, true, 2),
    (v_rid, c_momos, 'Chicken Cheese Momos (Steamed)',139, 'Steamed momos with chicken and cheese',          false, true, 3),
    (v_rid, c_momos, 'Chicken Cheese Momos (Fried)',  149, 'Fried momos with chicken and cheese',            false, true, 4),
    (v_rid, c_momos, 'Paneer Tikka Momos (Steamed)',  129, 'Steamed momos with paneer tikka filling',        true,  true, 5),
    (v_rid, c_momos, 'Paneer Tikka Momos (Fried)',    149, 'Fried momos with paneer tikka filling',          true,  true, 6),
    (v_rid, c_momos, 'Mushroom Momos (Steamed)',      129, 'Steamed momos with mushroom filling',            true,  true, 7),
    (v_rid, c_momos, 'Mushroom Momos (Fried)',        149, 'Fried momos with mushroom filling',              true,  true, 8);

  -- ── PAN FRY MOMOS ────────────────────────────────────────
  INSERT INTO menu_items (restaurant_id, category_id, name, price, description, is_vegetarian, is_available, display_order) VALUES
    (v_rid, c_pan_momos, 'Schezwan Chicken Momos (Steamed)',    139, 'Pan-fried steamed momos in schezwan sauce',      false, true, 1),
    (v_rid, c_pan_momos, 'Schezwan Chicken Momos (Fried)',      159, 'Pan-fried crispy momos in schezwan sauce',       false, true, 2),
    (v_rid, c_pan_momos, 'Chicken Chilli Garlic Momos (Steamed)',139,'Pan-fried steamed momos with chilli garlic',     false, true, 3),
    (v_rid, c_pan_momos, 'Chicken Chilli Garlic Momos (Fried)', 159, 'Pan-fried crispy momos with chilli garlic',     false, true, 4),
    (v_rid, c_pan_momos, 'Tandoori Chicken Momos (Steamed)',    139, 'Tandoori-spiced steamed chicken momos',          false, true, 5),
    (v_rid, c_pan_momos, 'Tandoori Chicken Momos (Fried)',      159, 'Tandoori-spiced fried chicken momos',            false, true, 6),
    (v_rid, c_pan_momos, 'Creamy Chicken Momos (Steamed)',      149, 'Steamed momos in creamy chicken sauce',          false, true, 7),
    (v_rid, c_pan_momos, 'Creamy Chicken Momos (Fried)',        169, 'Fried momos in creamy chicken sauce',            false, true, 8),
    (v_rid, c_pan_momos, 'Creamy Mushroom Momos (Steamed)',     149, 'Steamed momos in creamy mushroom sauce',         true,  true, 9),
    (v_rid, c_pan_momos, 'Creamy Mushroom Momos (Fried)',       169, 'Fried momos in creamy mushroom sauce',           true,  true, 10),
    (v_rid, c_pan_momos, 'Chilli Garlic Paneer Momos (Steamed)',149,'Steamed paneer momos with chilli garlic',        true,  true, 11),
    (v_rid, c_pan_momos, 'Chilli Garlic Paneer Momos (Fried)',  169, 'Fried paneer momos with chilli garlic',         true,  true, 12);

  -- ── FRIED CHICKEN - POPCORN ───────────────────────────────
  INSERT INTO menu_items (restaurant_id, category_id, name, price, description, is_vegetarian, is_popular, is_available, display_order) VALUES
    (v_rid, c_popcorn, 'Crispy Chicken Popcorn (9 Pcs)',  139, 'Fresh crispy chicken popcorn - small',                false, false, true, 1),
    (v_rid, c_popcorn, 'Crispy Chicken Popcorn (20 Pcs)', 259, 'Fresh crispy chicken popcorn - large',               false, false, true, 2),
    (v_rid, c_popcorn, 'Korean Pops',                     179, 'Honey dew touch - Korean-style chicken popcorn',     false, true,  true, 3),
    (v_rid, c_popcorn, 'BBQ Popcorn',                     169, 'Fried popcorn sautéed in BBQ sauce',                 false, false, true, 4);

  -- ── FRIED CHICKEN - STRIPS ────────────────────────────────
  INSERT INTO menu_items (restaurant_id, category_id, name, price, description, is_vegetarian, is_available, display_order) VALUES
    (v_rid, c_strips, 'Chicken Strips (5 Pcs)',  149, 'Crispy chicken strips - 5 pieces',    false, true, 1),
    (v_rid, c_strips, 'Chicken Strips (8 Pcs)',  210, 'Crispy chicken strips - 8 pieces',    false, true, 2),
    (v_rid, c_strips, 'Dynamite Strips',         199, 'Spicy dynamite-glazed chicken strips',false, true, 3),
    (v_rid, c_strips, 'Schezwan Strips',         189, 'Schezwan-sauced chicken strips',      false, true, 4);

  -- ── FRIED CHICKEN - WINGS ────────────────────────────────
  INSERT INTO menu_items (restaurant_id, category_id, name, price, description, is_vegetarian, is_available, display_order) VALUES
    (v_rid, c_wings, 'Crispy Chicken Wings (2 Pcs)', 149, 'Crispy fried chicken wings - 2 pieces',   false, true, 1),
    (v_rid, c_wings, 'Crispy Chicken Wings (4 Pcs)', 279, 'Crispy fried chicken wings - 4 pieces',   false, true, 2),
    (v_rid, c_wings, 'Crispy Chicken Wings (6 Pcs)', 359, 'Crispy fried chicken wings - 6 pieces',   false, true, 3),
    (v_rid, c_wings, 'Honey Chilli Wings',            179, 'Wings glazed with honey chilli sauce',    false, true, 4),
    (v_rid, c_wings, 'BBQ Wings',                     189, 'Wings glazed with smoky BBQ sauce',       false, true, 5);

  -- ── FRIED CHICKEN - LOLLIPOP ─────────────────────────────
  INSERT INTO menu_items (restaurant_id, category_id, name, price, description, is_vegetarian, is_available, display_order) VALUES
    (v_rid, c_lollipop, 'Chicken Lollipop (3 Pcs)',  169, 'Classic chicken lollipop - 3 pieces',         false, true, 1),
    (v_rid, c_lollipop, 'Chicken Lollipop (5 Pcs)',  279, 'Classic chicken lollipop - 5 pieces',         false, true, 2),
    (v_rid, c_lollipop, 'Drums of Heaven (3)',        199, 'Honey dew touch chicken lollipop - 3 pieces', false, true, 3),
    (v_rid, c_lollipop, 'Schezwan Lollipop (3)',      179, 'Schezwan-spiced chicken lollipop - 3 pieces', false, true, 4);

  -- ── SANDWICH ─────────────────────────────────────────────
  INSERT INTO menu_items (restaurant_id, category_id, name, price, description, is_vegetarian, is_popular, is_available, display_order) VALUES
    (v_rid, c_sandwich, 'Chilli Cheese Sandwich',            119, 'Green Chilli + Cheese + Cucumber + Bt Mayo',                            true,  true,  true, 1),
    (v_rid, c_sandwich, 'Cheesy Classic Sandwich',           119, 'Lettuce + Onion + Cucumber + Cheese + Tomato + Bt Mayo',                true,  false, true, 2),
    (v_rid, c_sandwich, 'Classic Sandwich',                  109, 'Lettuce + Onion + Cucumber + Tomato + Bt Mayo',                         true,  false, true, 3),
    (v_rid, c_sandwich, 'Peri Peri Classic Sandwich',        119, 'Lettuce + Onion + Cucumber + Tomato + Bt Peri Peri Mayo',               true,  false, true, 4),
    (v_rid, c_sandwich, 'Paneer Sandwich',                   129, 'Lettuce + Onion + Paneer cubes + Tomato + Bt Mayo',                     true,  false, true, 5),
    (v_rid, c_sandwich, 'Peri Peri Paneer Sandwich',         139, 'Lettuce + Onion + Paneer cubes + Tomato + Bt Peri Peri Mayo',           true,  true,  true, 6),
    (v_rid, c_sandwich, 'Corn Cheese Capsicum Sandwich',     139, 'Lettuce + Onion + Corn + Cheese slice + Capsicum + Bt Mayo',            true,  false, true, 7),
    (v_rid, c_sandwich, 'Egg Capsicum Sandwich',             139, 'Lettuce + Onion + Egg + Capsicum + Bt Mayo',                            false, true,  true, 8),
    (v_rid, c_sandwich, 'Crispy Chicken Sandwich',           139, 'Lettuce + Onion + Fried Chicken + Tomato + Bt Mayo',                    false, false, true, 9),
    (v_rid, c_sandwich, 'Crispy Chicken Cheese Sandwich',    149, 'Lettuce + Onion + Fried Chicken + Cheese slice + Tomato + Bt Mayo',     false, true,  true, 10),
    (v_rid, c_sandwich, 'Chilli Chicken Cheese Sandwich',    159, 'Lettuce + Onion + Green Chilli smeared Fried Chicken + Cheese + Bt Mayo',false,false, true, 11),
    (v_rid, c_sandwich, 'Peri Peri Crispy Chicken Sandwich', 159, 'Lettuce + Onion + Fried Chicken + Cheese + Tomato + Bt Peri Peri Mayo', false, true,  true, 12),
    (v_rid, c_sandwich, 'BBQ Crispy Chicken Sandwich',       169, 'Lettuce + Onion + Saucy Fried Chicken + Cheese + Tomato + Bt Mayo',     false, false, true, 13),
    (v_rid, c_sandwich, 'Tandoori Crispy Chicken Sandwich',  169, 'Lettuce + Onion + Saucy Fried Chicken + Cheese + Tomato + Bt Mayo',     false, false, true, 14),
    (v_rid, c_sandwich, 'Schezwan Crispy Chicken Sandwich',  169, 'Lettuce + Onion + Saucy Fried Chicken + Cheese + Tomato + Bt Mayo',     false, false, true, 15);

  -- ── FRIED CHICKEN BURGER ─────────────────────────────────
  INSERT INTO menu_items (restaurant_id, category_id, name, price, description, is_vegetarian, is_popular, is_available, display_order) VALUES
    (v_rid, c_fc_burger, 'Fried Crispy Chicken Burger',          159, 'Fried Crispy Chicken + Cheese slice + Veggies + Bt Cupello Mayo',         false, false, true, 1),
    (v_rid, c_fc_burger, 'Double Cheesy Chicken Burger',         179, 'Fried Crispy Chicken + Two Cheese slices + Veggies + Bt Cupello Mayo',    false, true,  true, 2),
    (v_rid, c_fc_burger, 'Peri Peri Crispy Chicken Burger',      179, 'Fried Crispy Chicken + Cheese slice + Veggies + Bt Peri Peri Cupello Mayo',false,false, true, 3),
    (v_rid, c_fc_burger, 'BBQ Crispy Chicken Burger',            179, 'Fried Crispy Chicken + Cheese slice + Veggies + Bt Peri Peri Cupello Mayo',false,false, true, 4),
    (v_rid, c_fc_burger, 'Tandoori Crispy Chicken Burger',       179, 'Fried Crispy Chicken + Cheese slice + Veggies + Bt Cupello Mayo',         false, false, true, 5),
    (v_rid, c_fc_burger, 'Schezwan Crispy Chicken Burger',       179, 'Fried Crispy Chicken + Cheese slice + Veggies + Bt Cupello Mayo',         false, true,  true, 6),
    (v_rid, c_fc_burger, 'Honey Dew Crispy Chicken Burger',      179, 'Fried Crispy Chicken + Cheese slice + Veggies + Bt Cupello Mayo',         false, false, true, 7);

  -- ── CHICKEN BURGER ───────────────────────────────────────
  INSERT INTO menu_items (restaurant_id, category_id, name, price, description, is_vegetarian, is_popular, is_available, display_order) VALUES
    (v_rid, c_ck_burger, 'Chicken Burger',                  139, 'Chicken Patty + Veggies + Bt Cupello Mayo',                          false, false, true, 1),
    (v_rid, c_ck_burger, 'Cheesy Chicken Burger',           159, 'Chicken Patty + Cheese slice + Veggies + Bt Cupello Mayo',           false, false, true, 2),
    (v_rid, c_ck_burger, 'Zumbo Chicken Burger',            169, 'Double Chicken Patty + Cheese slice + Veggies + Bt Cupello Mayo',    false, false, true, 3),
    (v_rid, c_ck_burger, 'Peri Peri Chicken Burger',        159, 'Chicken Patty + Veggies + Bt Cupello Peri Peri Mayo',                false, false, true, 4),
    (v_rid, c_ck_burger, 'BBQ Chicken Burger',              169, 'Saucy Chicken Patty + Cheese slice + Veggies + Bt Cupello Mayo',     false, false, true, 5),
    (v_rid, c_ck_burger, 'Tandoori Chicken Burger',         169, 'Saucy Chicken Patty + Cheese slice + Veggies + Bt Cupello Mayo',     false, false, true, 6),
    (v_rid, c_ck_burger, 'Schezwan Chicken Burger',         169, 'Saucy Chicken Patty + Cheese slice + Veggies + Bt Cupello Mayo',     false, false, true, 7);

  -- ── VEG BURGER ───────────────────────────────────────────
  INSERT INTO menu_items (restaurant_id, category_id, name, price, description, is_vegetarian, is_popular, is_available, display_order) VALUES
    (v_rid, c_veg_burger, 'Regular Veg Burger',                119, 'One Veg patty + Veggies + Bt Cupello Mayo',                               true, false, true, 1),
    (v_rid, c_veg_burger, 'Cheesy Veg Burger',                 139, 'One Veg patty + Cheese slice + Veggies + Bt Cupello Mayo',                true, true,  true, 2),
    (v_rid, c_veg_burger, 'Zumbo Veg Burger',                  149, 'Two Veg patty + Cheese slice + Veggies + Bt Cupello Mayo',                true, false, true, 3),
    (v_rid, c_veg_burger, 'BBQ Paneer Burger',                 159, 'Two Veg patty + Cheese slice + Veggies + Bt Cupello Mayo + BBQ sauce',    true, false, true, 4),
    (v_rid, c_veg_burger, 'Schezwan Paneer Burger',            159, 'Two Veg patty + Cheese slice + Veggies + Bt Cupello Mayo + Schezwan',     true, false, true, 5),
    (v_rid, c_veg_burger, 'Honey Dew Paneer Burger',           159, 'Two Veg patty + Cheese slice + Veggies + Bt Cupello Mayo + Honey Dew',    true, false, true, 6);

  -- ── MAGGI ─────────────────────────────────────────────────
  INSERT INTO menu_items (restaurant_id, category_id, name, price, description, is_vegetarian, is_popular, is_available, display_order) VALUES
    (v_rid, c_maggi, 'Classic Maggi',             79,  'Classic maggi added with capsicum',                              true,  false, true, 1),
    (v_rid, c_maggi, 'Butter Garlic Maggi',       109, 'Sautéed with garlic and topped with butter',                     true,  false, true, 2),
    (v_rid, c_maggi, 'Cheesy Paneer Maggi',       109, 'Added with cheese, paneer and capsicum',                         true,  false, true, 3),
    (v_rid, c_maggi, 'Schezwan Maggi',             89, 'Classic maggi added with schezwan sauce',                        true,  false, true, 4),
    (v_rid, c_maggi, 'Tandoori Maggi',             89, 'Classic maggi added with tandoori sauce',                        true,  false, true, 5),
    (v_rid, c_maggi, 'Cheesy Garlic Maggi',       109, 'Added with cheese and green chilli',                             true,  true,  true, 6),
    (v_rid, c_maggi, 'Corn Maggi',                 99, 'Added with corn and capsicum',                                   true,  false, true, 7),
    (v_rid, c_maggi, 'Cheesy Corn Chilli Maggi',  109, 'Added with cheese, green chilli and corn',                       true,  true,  true, 8),
    (v_rid, c_maggi, 'Cheesy Peri Peri Maggi',    109, 'Added with cheese, peri peri and capsicum',                      true,  false, true, 9),
    (v_rid, c_maggi, 'Egg Chilli Maggi',           99, 'Added with green chilli and sautéed egg',                        false, true,  true, 10),
    (v_rid, c_maggi, 'Cheesy Maggi',               99, 'Added with cheese and capsicum',                                 true,  false, true, 11),
    (v_rid, c_maggi, 'Capsicum Maggi',             99, 'Added with capsicum',                                            true,  true,  true, 12),
    (v_rid, c_maggi, 'Chicken Tandoori Maggi',    129, 'Added with fried crispy chicken with spicy tandoori sauce',      false, false, true, 13),
    (v_rid, c_maggi, 'Chicken Maggi',             119, 'Added with fried crispy chicken with smoky tangy BBQ sauce',     false, false, true, 14),
    (v_rid, c_maggi, 'Chicken Peri Peri Maggi',   129, 'Added with fried crispy chicken with peri peri touch',           false, false, true, 15),
    (v_rid, c_maggi, 'Chicken Cheesy Maggi',      139, 'Added with fried crispy chicken with cheesy juicy touch',        false, true,  true, 16),
    (v_rid, c_maggi, 'Chicken BBQ Maggi',         129, 'Added with fried crispy chicken with smoky tangy BBQ sauce',     false, false, true, 17),
    (v_rid, c_maggi, 'Chicken Paneer Maggi',      159, 'Added with fried crispy chicken with smoky tangy BBQ sauce',     false, true,  true, 18),
    (v_rid, c_maggi, 'Chicken Schezwan Maggi',    129, 'Added with fried crispy chicken with tangy schezwan sauce',      false, true,  true, 19);

  -- ── PIZZA ─────────────────────────────────────────────────
  INSERT INTO menu_items (restaurant_id, category_id, name, price, description, is_vegetarian, is_popular, is_available, display_order) VALUES
    (v_rid, c_pizza, 'Fiery Chicken Pizza',   169, 'Spicy fiery chicken pizza',    false, true,  true, 1),
    (v_rid, c_pizza, 'Spicy Paneer Pizza',    159, 'Spicy paneer topping pizza',   true,  false, true, 2),
    (v_rid, c_pizza, 'Corn & Cheese Pizza',   149, 'Classic corn and cheese pizza',true,  false, true, 3),
    (v_rid, c_pizza, 'Veg Supreme Pizza',     159, 'Loaded veg supreme pizza',     true,  true,  true, 4);

  -- ── PASTA (Plain / Chicken) ───────────────────────────────
  INSERT INTO menu_items (restaurant_id, category_id, name, price, description, is_vegetarian, is_popular, is_available, display_order) VALUES
    (v_rid, c_pasta, 'White Sauce Pasta',           129, 'Available plain or with chicken',                      true,  false, true, 1),
    (v_rid, c_pasta, 'Peri Peri Sauce Pasta',       139, 'Peri peri flavoured pasta, plain or with chicken',    true,  false, true, 2),
    (v_rid, c_pasta, 'Creamy Chilli Garlic Pasta',  149, 'Creamy chilli garlic pasta, plain or with chicken',   true,  true,  true, 3);

  -- ── WRAP ──────────────────────────────────────────────────
  INSERT INTO menu_items (restaurant_id, category_id, name, price, description, is_vegetarian, is_popular, is_available, display_order) VALUES
    (v_rid, c_wrap, 'Mexican Chicken Wrap', 139, 'Flavourful Mexican-style chicken wrap',    false, true,  true, 1),
    (v_rid, c_wrap, 'Cheesy Paneer Wrap',   129, 'Cheesy paneer filled wrap',                true,  false, true, 2),
    (v_rid, c_wrap, 'BBQ Chicken Wrap',     139, 'BBQ-sauced chicken wrap',                  false, false, true, 3);

  -- ── ICE CREAMS ────────────────────────────────────────────
  INSERT INTO menu_items (restaurant_id, category_id, name, price, is_vegetarian, is_available, display_order) VALUES
    (v_rid, c_ice_cream, 'Coffee Ice Cream',    129, true, true, 1),
    (v_rid, c_ice_cream, 'Chocolate Ice Cream', 109, true, true, 2),
    (v_rid, c_ice_cream, 'Vanilla Ice Cream',    99, true, true, 3),
    (v_rid, c_ice_cream, 'Royal Falooda',        179, true, true, 4);

  -- ── WAFFLE ────────────────────────────────────────────────
  INSERT INTO menu_items (restaurant_id, category_id, name, price, is_vegetarian, is_popular, is_available, display_order) VALUES
    (v_rid, c_waffle, 'Waffle with Hot Chocolate',    149, true, true,  true, 1),
    (v_rid, c_waffle, 'Cookies and Cream Waffle',     129, true, true,  true, 2),
    (v_rid, c_waffle, 'Dark Chocolate Waffle',        119, true, false, true, 3),
    (v_rid, c_waffle, 'Milk Chocolate Waffle',        109, true, false, true, 4),
    (v_rid, c_waffle, 'White Chocolate Waffle',       109, true, false, true, 5),
    (v_rid, c_waffle, 'Dark + Milk Chocolate Waffle', 129, true, false, true, 6),
    (v_rid, c_waffle, 'Dark + White Chocolate Waffle',129, true, false, true, 7),
    (v_rid, c_waffle, 'Milk + White Chocolate Waffle',129, true, false, true, 8),
    (v_rid, c_waffle, 'Hazelnut Waffle',              159, true, false, true, 9),
    (v_rid, c_waffle, 'White Chocolate + Biscoff Waffle',149, true, true, true, 10),
    (v_rid, c_waffle, 'Biscoff Loaded Waffle',        159, true, false, true, 11),
    (v_rid, c_waffle, 'Milk Chocolate + Biscoff Waffle',139, true, false, true, 12),
    (v_rid, c_waffle, 'Dark Chocolate + Biscoff Waffle',139, true, true, true, 13),
    (v_rid, c_waffle, 'Kitkat Loaded Waffle',         149, true, false, true, 14);

  -- ── ICED TEA ──────────────────────────────────────────────
  INSERT INTO menu_items (restaurant_id, category_id, name, price, description, is_vegetarian, is_available, display_order) VALUES
    (v_rid, c_iced_tea, 'Lemon Iced Tea',        99,  'Iced espresso with creamy lemon flavour', true, true, 1),
    (v_rid, c_iced_tea, 'Mint Lime Iced Tea',    99,  'Iced espresso with mint lime flavour',    true, true, 2),
    (v_rid, c_iced_tea, 'Peach Iced Tea',        109, 'Iced espresso with peach flavour',        true, true, 3),
    (v_rid, c_iced_tea, 'Butterfly Pea Iced Tea',119, 'Iced espresso with butterfly pea',        true, true, 4);

  -- ── TEA ───────────────────────────────────────────────────
  INSERT INTO menu_items (restaurant_id, category_id, name, price, description, is_vegetarian, is_available, display_order) VALUES
    (v_rid, c_tea, 'Black Tea',    25, 'Tea extract with hot water and brown sugar',              true, true, 1),
    (v_rid, c_tea, 'Classic Tea',  30, 'Tea extract with steamed milk',                           true, true, 2),
    (v_rid, c_tea, 'Ginger Tea',   40, 'Tea extract with steamed milk and a cardamom touch',      true, true, 3),
    (v_rid, c_tea, 'Lemon Tea',    45, 'Tea extract with hot water, squeezed lemon and honey',    true, true, 4);

  -- ── COFFEE ────────────────────────────────────────────────
  INSERT INTO menu_items (restaurant_id, category_id, name, price, description, is_vegetarian, is_popular, is_available, display_order) VALUES
    (v_rid, c_coffee, 'Cortado / Coffee', 69, 'Espresso with steamed milk',                                     true, false, true, 1),
    (v_rid, c_coffee, 'Americano / Black',49, 'Espresso with hot water for a smooth full-bodied flavor',        true, false, true, 2),
    (v_rid, c_coffee, 'Cappuccino',       99, 'Espresso with steamed milk and a light foam',                    true, false, true, 3),
    (v_rid, c_coffee, 'Mocha',            79, 'Espresso with rich chocolate and steamed milk',                  true, false, true, 4),
    (v_rid, c_coffee, 'Biscoff Coffee',   99, 'Espresso with steamed milk and Biscoff spread',                  true, false, true, 5);

  -- ── CHOCOLATE BEVERAGES ───────────────────────────────────
  INSERT INTO menu_items (restaurant_id, category_id, name, price, description, is_vegetarian, is_available, display_order) VALUES
    (v_rid, c_choc_bev, 'Nutella Hot Chocolate',          129, 'Creamy milk with rich chocolates and generous Nutella and pure cocoa', true, true, 1),
    (v_rid, c_choc_bev, 'Hot Chocolate',                  109, 'Creamy milk with rich chocolates and pure cocoa',                     true, true, 2),
    (v_rid, c_choc_bev, 'Biscoff Hot Chocolate',          139, 'Creamy milk with rich chocolates and generous Biscoff and pure cocoa',true, true, 3),
    (v_rid, c_choc_bev, 'Biscoff Hot Chocolate (White Choc)',149,'Creamy milk with rich white chocolates, Biscoff and pure cocoa',   true, true, 4);

  -- ── THICKSHAKES ───────────────────────────────────────────
  INSERT INTO menu_items (restaurant_id, category_id, name, price, description, is_vegetarian, is_popular, is_available, display_order) VALUES
    (v_rid, c_thickshake, 'Berry Blast Shake (Regular)',    139, 'Creamy milk blended with berry flavour',       true, true,  true, 1),
    (v_rid, c_thickshake, 'Berry Blast Shake (Large)',      159, 'Creamy milk blended with berry flavour',       true, false, true, 2),
    (v_rid, c_thickshake, 'Gulkand Shake (Regular)',        119, 'Creamy milk blended with gulkand',             true, true,  true, 3),
    (v_rid, c_thickshake, 'Gulkand Shake (Large)',          139, 'Creamy milk blended with gulkand',             true, false, true, 4),
    (v_rid, c_thickshake, 'Kiwi Shake (Regular)',           119, 'Creamy milk blended with kiwi',                true, false, true, 5),
    (v_rid, c_thickshake, 'Kiwi Shake (Large)',             139, 'Creamy milk blended with kiwi',                true, false, true, 6),
    (v_rid, c_thickshake, 'Litchi Shake (Regular)',         109, 'Creamy milk blended with litchi',              true, false, true, 7),
    (v_rid, c_thickshake, 'Litchi Shake (Large)',           129, 'Creamy milk blended with litchi',              true, false, true, 8),
    (v_rid, c_thickshake, 'Boost Shake (Regular)',           99, 'Creamy milk blended with boost',               true, false, true, 9),
    (v_rid, c_thickshake, 'Boost Shake (Large)',            119, 'Creamy milk blended with boost',               true, false, true, 10),
    (v_rid, c_thickshake, 'Vanilla Shake (Regular)',        119, 'Creamy milk blended with vanilla',             true, false, true, 11),
    (v_rid, c_thickshake, 'Vanilla Shake (Large)',          139, 'Creamy milk blended with vanilla',             true, false, true, 12),
    (v_rid, c_thickshake, 'Chocolate Shake (Regular)',      129, 'Creamy milk blended with chocolate',           true, false, true, 13),
    (v_rid, c_thickshake, 'Chocolate Shake (Large)',        149, 'Creamy milk blended with chocolate',           true, false, true, 14),
    (v_rid, c_thickshake, 'Oreo Shake (Regular)',           119, 'Creamy milk blended with Oreo',                true, false, true, 15),
    (v_rid, c_thickshake, 'Oreo Shake (Large)',             139, 'Creamy milk blended with Oreo',                true, false, true, 16),
    (v_rid, c_thickshake, 'Kitkat Shake (Regular)',         129, 'Creamy milk blended with Kitkat',              true, false, true, 17),
    (v_rid, c_thickshake, 'Kitkat Shake (Large)',           149, 'Creamy milk blended with Kitkat',              true, false, true, 18),
    (v_rid, c_thickshake, 'Strawberry Shake (Regular)',     139, 'Creamy milk blended with strawberry',          true, false, true, 19),
    (v_rid, c_thickshake, 'Strawberry Shake (Large)',       149, 'Creamy milk blended with strawberry',          true, false, true, 20),
    (v_rid, c_thickshake, 'Oreo Vanilla Shake (Regular)',   129, 'Creamy milk blended with Oreo and vanilla',    true, true,  true, 21),
    (v_rid, c_thickshake, 'Oreo Vanilla Shake (Large)',     149, 'Creamy milk blended with Oreo and vanilla',    true, false, true, 22),
    (v_rid, c_thickshake, 'Oreo Strawberry Shake (Regular)',129, 'Creamy milk blended with Oreo and strawberry', true, false, true, 23),
    (v_rid, c_thickshake, 'Oreo Strawberry Shake (Large)',  149, 'Creamy milk blended with Oreo and strawberry', true, false, true, 24),
    (v_rid, c_thickshake, 'Oreo Hazelnut Shake (Regular)',  139, 'Creamy milk blended with Oreo and hazelnut',   true, true,  true, 25),
    (v_rid, c_thickshake, 'Oreo Hazelnut Shake (Large)',    159, 'Creamy milk blended with Oreo and hazelnut',   true, false, true, 26),
    (v_rid, c_thickshake, 'Brownie Shake (Regular)',        129, 'Creamy milk blended with brownie',             true, false, true, 27),
    (v_rid, c_thickshake, 'Brownie Shake (Large)',          149, 'Creamy milk blended with brownie',             true, false, true, 28),
    (v_rid, c_thickshake, 'Brownie Hazelnut Shake (Regular)',149,'Creamy milk blended with brownie and hazelnut',true, true,  true, 29),
    (v_rid, c_thickshake, 'Brownie Hazelnut Shake (Large)', 169, 'Creamy milk blended with brownie and hazelnut',true, false, true, 30),
    (v_rid, c_thickshake, 'Hazelnut Shake (Regular)',       149, 'Creamy milk blended with hazelnut',            true, false, true, 31),
    (v_rid, c_thickshake, 'Hazelnut Shake (Large)',         169, 'Creamy milk blended with hazelnut',            true, false, true, 32),
    (v_rid, c_thickshake, 'Watermelon Shake (Regular)',     129, 'Creamy milk blended with watermelon',          true, false, true, 33),
    (v_rid, c_thickshake, 'Watermelon Shake (Large)',       149, 'Creamy milk blended with watermelon',          true, false, true, 34),
    (v_rid, c_thickshake, 'Lotus Biscoff Shake (Regular)',  149, 'Creamy milk blended with Lotus Biscoff',       true, false, true, 35),
    (v_rid, c_thickshake, 'Lotus Biscoff Shake (Large)',    169, 'Creamy milk blended with Lotus Biscoff',       true, false, true, 36),
    (v_rid, c_thickshake, 'Biscoff Brownie Shake (Regular)',149, 'Creamy milk blended with Biscoff and brownie', true, true,  true, 37),
    (v_rid, c_thickshake, 'Biscoff Brownie Shake (Large)',  169, 'Creamy milk blended with Biscoff and brownie', true, false, true, 38),
    (v_rid, c_thickshake, 'Cold Coffee Shake (Regular)',    119, 'Creamy cold coffee shake',                      true, true,  true, 39),
    (v_rid, c_thickshake, 'Cold Coffee Shake (Large)',      139, 'Creamy cold coffee shake',                      true, false, true, 40),
    (v_rid, c_thickshake, 'Coffee Chocolate Shake (Regular)',129,'Creamy coffee chocolate blend',                 true, true,  true, 41),
    (v_rid, c_thickshake, 'Coffee Chocolate Shake (Large)', 149, 'Creamy coffee chocolate blend',                 true, false, true, 42),
    (v_rid, c_thickshake, 'Caramel Biscoff Shake (Regular)',139, 'Creamy caramel Biscoff shake',                  true, false, true, 43),
    (v_rid, c_thickshake, 'Caramel Biscoff Shake (Large)',  159, 'Creamy caramel Biscoff shake',                  true, false, true, 44),
    (v_rid, c_thickshake, 'Blueberry Shake (Regular)',      129, 'Creamy milk blended with blueberry',            true, false, true, 45),
    (v_rid, c_thickshake, 'Blueberry Shake (Large)',        149, 'Creamy milk blended with blueberry',            true, false, true, 46),
    (v_rid, c_thickshake, 'White Chocolate Biscoff (Regular)',139,'Creamy white chocolate Biscoff shake',         true, false, true, 47),
    (v_rid, c_thickshake, 'White Chocolate Biscoff (Large)', 159, 'Creamy white chocolate Biscoff shake',         true, false, true, 48);

  -- ── MOJITO ────────────────────────────────────────────────
  INSERT INTO menu_items (restaurant_id, category_id, name, price, description, is_vegetarian, is_available, display_order) VALUES
    (v_rid, c_mojito, 'Blue Curacao Mojito', 109, 'Sparkling and refreshing ice drink',   true, true, 1),
    (v_rid, c_mojito, 'Watermelon Mojito',   109, 'Sparkling and refreshing ice drink',   true, true, 2),
    (v_rid, c_mojito, 'Mint Lemon Mojito',    99, 'Sparkling and refreshing ice drink',   true, true, 3),
    (v_rid, c_mojito, 'Lemon Soda',           49, 'Classic lemon soda',                   true, true, 4),
    (v_rid, c_mojito, 'Blueberry Mojito',    109, 'Sparkling and refreshing ice drink',   true, true, 5),
    (v_rid, c_mojito, 'Green Apple Mojito',  109, 'Sparkling and refreshing ice drink',   true, true, 6),
    (v_rid, c_mojito, 'Litchi Love',         149, 'Sparkling and refreshing litchi drink', true, true, 7);

  -- ── FRESH JUICE ───────────────────────────────────────────
  INSERT INTO menu_items (restaurant_id, category_id, name, price, description, is_vegetarian, is_available, display_order) VALUES
    (v_rid, c_fresh_juice, 'Watermelon Juice',              45,  'Blended fresh fruit juice',         true, true, 1),
    (v_rid, c_fresh_juice, 'Lemon Juice',                   35,  'Fresh lemon juice',                 true, true, 2),
    (v_rid, c_fresh_juice, 'Apple Juice',                   69,  'Fresh apple juice',                 true, true, 3),
    (v_rid, c_fresh_juice, 'Pomegranate Juice',             89,  'Fresh pomegranate juice',           true, true, 4),
    (v_rid, c_fresh_juice, 'Pineapple Juice',               45,  'Fresh pineapple juice',             true, true, 5),
    (v_rid, c_fresh_juice, 'Papaya Juice',                  45,  'Fresh papaya juice',                true, true, 6),
    (v_rid, c_fresh_juice, 'Guava Juice',                   45,  'Fresh guava juice',                 true, true, 7),
    (v_rid, c_fresh_juice, 'Banana Juice',                  45,  'Fresh banana juice',                true, true, 8),
    (v_rid, c_fresh_juice, 'Muskmelon Juice',               49,  'Fresh muskmelon juice',             true, true, 9),
    (v_rid, c_fresh_juice, 'Orange Juice',                  59,  'Fresh orange juice',                true, true, 10),
    (v_rid, c_fresh_juice, 'Mint Lime Juice',               40,  'Fresh mint lime juice',             true, true, 11),
    (v_rid, c_fresh_juice, 'Ginger Mint Lime Juice',        45,  'Fresh ginger mint lime blend',      true, true, 12),
    (v_rid, c_fresh_juice, 'Mint Watermelon Juice',         45,  'Fresh mint watermelon blend',       true, true, 13),
    (v_rid, c_fresh_juice, 'Pineapple Mint Juice',          50,  'Fresh pineapple mint blend',        true, true, 14),
    (v_rid, c_fresh_juice, 'Pineapple Ginger Mint Juice',   55,  'Fresh pineapple ginger mint blend', true, true, 15),
    (v_rid, c_fresh_juice, 'Pineapple Lemon Juice',         55,  'Fresh pineapple lemon blend',       true, true, 16),
    (v_rid, c_fresh_juice, 'Pineapple Mint Lemon Juice',    55,  'Fresh pineapple mint lemon blend',  true, true, 17),
    (v_rid, c_fresh_juice, 'Pineapple Mint Lemon Ginger',   55,  'Full tropical blend',               true, true, 18),
    (v_rid, c_fresh_juice, 'Amla Mint Juice',               40,  'Fresh amla with mint',              true, true, 19),
    (v_rid, c_fresh_juice, 'Amla Ginger Mint Juice',        40,  'Fresh amla ginger mint blend',      true, true, 20),
    (v_rid, c_fresh_juice, 'Ginger Orange Juice',           65,  'Fresh ginger orange blend',         true, true, 21),
    (v_rid, c_fresh_juice, 'Strawberry Orange Juice',       89,  'Fresh strawberry orange blend',     true, true, 22),
    (v_rid, c_fresh_juice, 'Apple Watermelon Juice',        89,  'Fresh apple watermelon blend',      true, true, 23),
    (v_rid, c_fresh_juice, 'Pomegranate Watermelon Juice',  89,  'Fresh pomegranate watermelon blend',true, true, 24),
    (v_rid, c_fresh_juice, 'Carrot Juice',                  59,  'Fresh carrot juice',                true, true, 25),
    (v_rid, c_fresh_juice, 'Ginger Beetroot Juice',         59,  'Fresh ginger beetroot blend',       true, true, 26),
    (v_rid, c_fresh_juice, 'ABC Juice',                     79,  'Apple Beetroot Carrot blend',       true, true, 27),
    (v_rid, c_fresh_juice, 'Ginger Carrot Juice',           50,  'Fresh ginger carrot blend',         true, true, 28),
    (v_rid, c_fresh_juice, 'Amla Beetroot Carrot Juice',    59,  'Fresh amla beetroot carrot blend',  true, true, 29),
    (v_rid, c_fresh_juice, 'Banana Dates Juice',            69,  'Fresh banana dates blend',          true, true, 30),
    (v_rid, c_fresh_juice, 'Fig Dates Juice',               79,  'Fresh fig dates blend',             true, true, 31),
    (v_rid, c_fresh_juice, 'Nuts Dates Juice',              89,  'Fresh nuts dates blend',            true, true, 32),
    (v_rid, c_fresh_juice, 'Apple Nuts Dates Juice',        99,  'Fresh apple nuts dates blend',      true, true, 33),
    (v_rid, c_fresh_juice, 'Apple Banana Dates Juice',      89,  'Fresh apple banana dates blend',    true, true, 34),
    (v_rid, c_fresh_juice, 'Dates Juice',                   50,  'Pure dates juice',                  true, true, 35),
    (v_rid, c_fresh_juice, 'Avocado Juice',                 120, 'Fresh avocado juice',               true, true, 36),
    (v_rid, c_fresh_juice, 'Avocado Banana Juice',          120, 'Fresh avocado banana blend',        true, true, 37),
    (v_rid, c_fresh_juice, 'Strawberry Juice',              99,  'Fresh strawberry juice',            true, true, 38),
    (v_rid, c_fresh_juice, 'Dragon Fruit Juice',            79,  'Fresh dragon fruit juice',          true, true, 39),
    (v_rid, c_fresh_juice, 'Kiwi Juice',                    89,  'Fresh kiwi juice',                  true, true, 40);

  -- ── COMBOS ────────────────────────────────────────────────
  INSERT INTO menu_items (restaurant_id, category_id, name, price, description, is_vegetarian, is_available, display_order) VALUES
    (v_rid, c_combos, 'Burger Singles Combo',      299, 'Chicken Burger + Peri Peri Fries + Milkshake',                                    false, true, 1),
    (v_rid, c_combos, 'Burger Couple Combo',        349, '2 Burgers (Veg & Chicken) + 1 Loaded Fries + 2 Coke',                            false, true, 2),
    (v_rid, c_combos, 'Burger Family Combo',        449, 'Fried Chicken Burger + Loaded Fries + Nuggets + Coke',                           false, true, 3),
    (v_rid, c_combos, 'Fried Chicken Combo',        309, 'Popcorn (5pcs) + Strips (2pcs) + Lollipop (2pcs) + Wings (1pc) + Lemon Soda',   false, true, 4),
    (v_rid, c_combos, 'Maggi + Dark Choc Waffle + Brownie Bites',    199, 'Maggi + Dark Chocolate Waffle + Brownie Bites',               true,  true, 5),
    (v_rid, c_combos, 'Maggi + White Choc Waffle + Brownie Bites',   210, 'Maggi + White Chocolate Waffle + Brownie Bites',              true,  true, 6),
    (v_rid, c_combos, 'Maggi + Milk Choc Waffle + Brownie Bites',    210, 'Maggi + Milk Chocolate Waffle + Brownie Bites',               true,  true, 7),
    (v_rid, c_combos, 'Maggi + Triple Choc Waffle + Brownie Bites',  249, 'Maggi + Triple Chocolate Waffle + Brownie Bites',             true,  true, 8),
    (v_rid, c_combos, 'Chicken Combo',             289, 'Fried Chicken Burger + Salted Fries + Mojito of Choice',                          false, true, 9),
    (v_rid, c_combos, 'Veg Combo',                 279, 'Veg Burger + Jalapeno Pops (5) + Mojito of Choice',                              true,  true, 10),
    (v_rid, c_combos, 'Student Combo',             229, 'Classic Sandwich 2 pcs + Fries + Milkshake (Chocolate/Oreo/Vanilla/Boost)',       true,  true, 11),
    (v_rid, c_combos, 'Couple Combo',              399, 'Chicken Burger + Veg Burger + Fries + Milkshake (Chocolate/Oreo/Vanilla/Boost)',   false, true, 12);

  RAISE NOTICE 'Cupello Cafe menu imported successfully! Restaurant ID: %', v_rid;
END $$;
