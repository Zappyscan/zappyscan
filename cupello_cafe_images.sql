-- ============================================================
-- Cupello Cafe - Menu Item Images Update
-- Run this in Supabase SQL Editor AFTER running cupello_cafe_menu.sql
-- Uses free Unsplash food photos, one per category
-- ============================================================

DO $$
DECLARE
  v_rid UUID;
BEGIN
  SELECT id INTO v_rid FROM restaurants WHERE name ILIKE '%cupello%' LIMIT 1;
  IF v_rid IS NULL THEN RAISE EXCEPTION 'Cupello Cafe not found'; END IF;

  -- Update each category with a food-appropriate Unsplash photo
  UPDATE menu_items mi
  SET image_url = CASE c.name
    WHEN 'Starters'
      THEN 'https://images.unsplash.com/photo-1562059390-a761a084768e?w=400&h=300&fit=crop&q=80'
    WHEN 'Momos'
      THEN 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=400&h=300&fit=crop&q=80'
    WHEN 'Pan Fry Momos'
      THEN 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=400&h=300&fit=crop&q=80'
    WHEN 'Fried Chicken - Popcorn'
      THEN 'https://images.unsplash.com/photo-1569058019041-d1e56e7a0cca?w=400&h=300&fit=crop&q=80'
    WHEN 'Fried Chicken - Strips'
      THEN 'https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop&q=80'
    WHEN 'Fried Chicken - Wings'
      THEN 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=400&h=300&fit=crop&q=80'
    WHEN 'Fried Chicken - Lollipop'
      THEN 'https://images.unsplash.com/photo-1598514982901-3e7bc3aca308?w=400&h=300&fit=crop&q=80'
    WHEN 'Sandwich'
      THEN 'https://images.unsplash.com/photo-1528735884285-7dec29031cb3?w=400&h=300&fit=crop&q=80'
    WHEN 'Fried Chicken Burger'
      THEN 'https://images.unsplash.com/photo-1550547660-d9054522f9f7?w=400&h=300&fit=crop&q=80'
    WHEN 'Chicken Burger'
      THEN 'https://images.unsplash.com/photo-1568901346375-845e8d8a1a82?w=400&h=300&fit=crop&q=80'
    WHEN 'Veg Burger'
      THEN 'https://images.unsplash.com/photo-1520072959219-c595dc870360?w=400&h=300&fit=crop&q=80'
    WHEN 'Maggi'
      THEN 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&h=300&fit=crop&q=80'
    WHEN 'Pizza'
      THEN 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=300&fit=crop&q=80'
    WHEN 'Pasta'
      THEN 'https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?w=400&h=300&fit=crop&q=80'
    WHEN 'Wrap'
      THEN 'https://images.unsplash.com/photo-1626700051175-3272a85ab77a?w=400&h=300&fit=crop&q=80'
    WHEN 'Ice Creams'
      THEN 'https://images.unsplash.com/photo-1501443762994-f3a779756c5c?w=400&h=300&fit=crop&q=80'
    WHEN 'Waffle'
      THEN 'https://images.unsplash.com/photo-1562376552-0d160a2f238a?w=400&h=300&fit=crop&q=80'
    WHEN 'Iced Tea'
      THEN 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&h=300&fit=crop&q=80'
    WHEN 'Tea'
      THEN 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400&h=300&fit=crop&q=80'
    WHEN 'Coffee'
      THEN 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop&q=80'
    WHEN 'Chocolate Beverages'
      THEN 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=400&h=300&fit=crop&q=80'
    WHEN 'Thickshakes'
      THEN 'https://images.unsplash.com/photo-1572490122747-3964f3c2b40b?w=400&h=300&fit=crop&q=80'
    WHEN 'Mojito'
      THEN 'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=400&h=300&fit=crop&q=80'
    WHEN 'Fresh Juice'
      THEN 'https://images.unsplash.com/photo-1546173159-315724a31696?w=400&h=300&fit=crop&q=80'
    WHEN 'Combos'
      THEN 'https://images.unsplash.com/photo-1552895638-f7fe08d2f7d5?w=400&h=300&fit=crop&q=80'
    ELSE mi.image_url
  END
  FROM categories c
  WHERE mi.category_id = c.id
    AND mi.restaurant_id = v_rid;

  RAISE NOTICE 'Images updated for all Cupello Cafe menu items!';
END $$;
