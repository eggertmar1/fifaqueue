-- Add queue_open_override to seasons table
-- null = use default schedule (11:00), true = forced open, false = forced closed
alter table seasons add column queue_open_override boolean default null;
