-- 0041_create_test_users.sql
-- Create 3 test users with companies

-- 1. Create SaaS companies for each user
INSERT INTO companies (id, name, is_active)
VALUES
  ('company_liam_001', 'Liam Baker Co', 1),
  ('company_jesse_001', 'Jesse Baker Co', 1),
  ('company_rikitest_001', 'Rikitest Baker Co', 1);

-- 2. Create users (magic link enabled, placeholder password - they'll use magic link to login)
INSERT INTO users (id, email, username, password, first_name, last_name, company_id, role, magic_link_enabled, verified)
VALUES
  ('user_liam_001', 'liambaker33p@gmail.com', 'liambaker', 'placeholder:placeholder', 'Liam', 'Baker', 'company_liam_001', 'admin', 1, 1),
  ('user_jesse_001', 'daddybakes6@gmail.com', 'jessebaker', 'placeholder:placeholder', 'Jesse', 'Baker', 'company_jesse_001', 'admin', 1, 1),
  ('user_rikitest_001', 'rikibaker+notrotest@gmail.com', 'rikitestbaker', 'placeholder:placeholder', 'Rikitest', 'Baker', 'company_rikitest_001', 'admin', 1, 1);

-- 3. Set admin_user_id on companies
UPDATE companies SET admin_user_id = 'user_liam_001' WHERE id = 'company_liam_001';
UPDATE companies SET admin_user_id = 'user_jesse_001' WHERE id = 'company_jesse_001';
UPDATE companies SET admin_user_id = 'user_rikitest_001' WHERE id = 'company_rikitest_001';

-- 4. Create game companies for each user
INSERT INTO game_companies (id, user_id, name, cash, level)
VALUES
  ('gc_liam_001', 'user_liam_001', 'Liam Enterprises', 50000, 1),
  ('gc_jesse_001', 'user_jesse_001', 'Jesse Industries', 50000, 1),
  ('gc_rikitest_001', 'user_rikitest_001', 'Rikitest Corp', 50000, 1);
