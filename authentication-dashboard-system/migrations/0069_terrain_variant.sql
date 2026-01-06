ALTER TABLE tiles ADD COLUMN terrain_variant TEXT DEFAULT NULL;
-- Values: straight_ns, straight_ew, corner_ne, corner_nw, corner_se, corner_sw,
--         tjunction_n, tjunction_e, tjunction_s, tjunction_w, crossroad,
--         deadend_n, deadend_e, deadend_s, deadend_w
