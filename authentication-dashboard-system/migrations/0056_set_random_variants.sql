-- Set random variants for existing buildings that support variants
-- High Street Store variants: Fashion, Food, Electronics, Books
UPDATE building_instances
SET variant = CASE (ABS(RANDOM()) % 4)
  WHEN 0 THEN 'Fashion'
  WHEN 1 THEN 'Food'
  WHEN 2 THEN 'Electronics'
  WHEN 3 THEN 'Books'
END
WHERE building_type_id = 'high_street_store' AND variant IS NULL;

-- Shop variants: Grocery, Hardware, Pharmacy, Pet, Sports, Gift
UPDATE building_instances
SET variant = CASE (ABS(RANDOM()) % 6)
  WHEN 0 THEN 'Grocery'
  WHEN 1 THEN 'Hardware'
  WHEN 2 THEN 'Pharmacy'
  WHEN 3 THEN 'Pet'
  WHEN 4 THEN 'Sports'
  WHEN 5 THEN 'Gift'
END
WHERE building_type_id = 'shop' AND variant IS NULL;

-- Market Stall variants: Crafts, Flowers, Antiques, Clothing, Jewelry, Art
UPDATE building_instances
SET variant = CASE (ABS(RANDOM()) % 6)
  WHEN 0 THEN 'Crafts'
  WHEN 1 THEN 'Flowers'
  WHEN 2 THEN 'Antiques'
  WHEN 3 THEN 'Clothing'
  WHEN 4 THEN 'Jewelry'
  WHEN 5 THEN 'Art'
END
WHERE building_type_id = 'market_stall' AND variant IS NULL;

-- Mark all affected buildings as needing profit recalculation
-- (competition penalties now apply based on variants)
UPDATE building_instances
SET needs_profit_recalc = 1
WHERE building_type_id IN ('high_street_store', 'shop', 'market_stall');
