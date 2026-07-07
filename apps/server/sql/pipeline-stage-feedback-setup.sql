-- Lead pipeline stages feedback (Slide 12)
-- Run once against your Postgres database.

ALTER TYPE pipeline_stage ADD VALUE IF NOT EXISTS 'first_follow_up';
ALTER TYPE pipeline_stage ADD VALUE IF NOT EXISTS 'second_follow_up';
ALTER TYPE pipeline_stage ADD VALUE IF NOT EXISTS 'third_follow_up';
ALTER TYPE pipeline_stage ADD VALUE IF NOT EXISTS 'fourth_follow_up';
ALTER TYPE pipeline_stage ADD VALUE IF NOT EXISTS 'need_consider';

UPDATE prospects SET stage = 'first_follow_up' WHERE stage = 'follow_up_in_progress';
UPDATE prospects SET stage = 'first_follow_up' WHERE stage = 'contacted';
UPDATE prospects SET stage = 'second_follow_up' WHERE stage = 'no_pick_reply';
UPDATE prospects SET stage = 'fourth_follow_up' WHERE stage = 'can_recycle';
UPDATE prospects SET stage = 'third_follow_up' WHERE stage = 'follow_up_for_appointment';
UPDATE prospects SET stage = 'third_follow_up' WHERE stage = 'appointment_set';
UPDATE prospects SET stage = 'need_consider' WHERE stage = 'consider_seen';
