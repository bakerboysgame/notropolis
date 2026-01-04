-- 0043_add_user_prompts.sql
-- Add configurable user prompts for chat and name moderation

ALTER TABLE moderation_settings ADD COLUMN chat_user_prompt TEXT NOT NULL DEFAULT 'Message to review:

{content}';

ALTER TABLE moderation_settings ADD COLUMN name_user_prompt TEXT NOT NULL DEFAULT '{type} to review: "{content}"';

-- Update existing row with default values
UPDATE moderation_settings
SET chat_user_prompt = 'Message to review:

{content}',
    name_user_prompt = '{type} to review: "{content}"'
WHERE id = 'global';
