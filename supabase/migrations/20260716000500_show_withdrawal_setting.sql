-- Add show_withdrawal setting to control walas withdrawal menu visibility
alter table public.app_settings
  add column if not exists show_withdrawal boolean not null default true;
