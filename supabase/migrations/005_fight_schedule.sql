-- Allow scheduling future fights for each fighter from the calendar page
alter table fighters add column if not exists scheduled_week integer;
alter table fighters add column if not exists scheduled_opponent jsonb;
