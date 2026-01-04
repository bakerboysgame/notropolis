-- 0044_create_dylan_dexter_users.sql
-- Create users for Dylan Baker and Dexter Baker

-- 1. Create SaaS companies for each user
INSERT INTO companies (id, name, is_active)
VALUES
  ('company_dylan_001', 'Dylan Baker Co', 1),
  ('company_dexter_001', 'Dexter Baker Co', 1);

-- 2. Create users (magic link enabled, placeholder password - they'll use magic link to login)
INSERT INTO users (id, email, username, password, first_name, last_name, company_id, role, magic_link_enabled, verified)
VALUES
  ('user_dylan_001', 'dylanrabaker@gmail.com', 'dylanbaker', 'placeholder:placeholder', 'Dylan', 'Baker', 'company_dylan_001', 'admin', 1, 1),
  ('user_dexter_001', 'dexterrikibaker@gmail.com', 'dexterbaker', 'placeholder:placeholder', 'Dexter', 'Baker', 'company_dexter_001', 'admin', 1, 1);

-- 3. Set admin_user_id on companies
UPDATE companies SET admin_user_id = 'user_dylan_001' WHERE id = 'company_dylan_001';
UPDATE companies SET admin_user_id = 'user_dexter_001' WHERE id = 'company_dexter_001';

-- 4. Create game companies for each user
INSERT INTO game_companies (id, user_id, name, cash, level)
VALUES
  ('gc_dylan_001', 'user_dylan_001', 'Thunderbolt Dynamics', 50000, 1),
  ('gc_dexter_001', 'user_dexter_001', 'Ironclad Syndicate', 50000, 1);
