-- Mills Campus Tracker v1.2: administrator vehicle-description editor
-- Run once in Supabase SQL Editor. This intentionally excludes all location,
-- custody, department, dealership, zone, GPS and last-seen fields.

alter table public.vehicles
  add column if not exists interior_color text,
  add column if not exists packages text,
  add column if not exists body_style text,
  add column if not exists engine text,
  add column if not exists drivetrain text,
  add column if not exists transmission text,
  add column if not exists fuel_type text;

drop policy if exists "vehicle authenticated update" on public.vehicles;

create or replace function public.admin_edit_vehicle(
  p_vehicle_id uuid,
  p_vin text,
  p_stock_number text,
  p_year integer,
  p_make text,
  p_model text,
  p_trim text,
  p_color text,
  p_interior_color text,
  p_license_plate text,
  p_body_style text,
  p_engine text,
  p_drivetrain text,
  p_transmission text,
  p_fuel_type text,
  p_packages text,
  p_notes text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  before_row public.vehicles;
  after_row public.vehicles;
  clean_vin text := upper(regexp_replace(coalesce(p_vin, ''), '[^A-Z0-9]', '', 'g'));
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access is required';
  end if;
  if clean_vin !~ '^[A-HJ-NPR-Z0-9]{17}$' then
    raise exception 'VIN must contain 17 valid characters and cannot contain I, O or Q';
  end if;

  select * into before_row from public.vehicles where id = p_vehicle_id for update;
  if not found then raise exception 'Vehicle not found'; end if;

  update public.vehicles set
    vin = clean_vin,
    stock_number = nullif(btrim(p_stock_number), ''),
    year = p_year,
    make = nullif(btrim(p_make), ''),
    model = nullif(btrim(p_model), ''),
    trim = nullif(btrim(p_trim), ''),
    color = nullif(btrim(p_color), ''),
    interior_color = nullif(btrim(p_interior_color), ''),
    license_plate = nullif(btrim(p_license_plate), ''),
    body_style = nullif(btrim(p_body_style), ''),
    engine = nullif(btrim(p_engine), ''),
    drivetrain = nullif(btrim(p_drivetrain), ''),
    transmission = nullif(btrim(p_transmission), ''),
    fuel_type = nullif(btrim(p_fuel_type), ''),
    packages = nullif(btrim(p_packages), ''),
    notes = nullif(btrim(p_notes), ''),
    updated_at = now()
  where id = p_vehicle_id
  returning * into after_row;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, old_data, new_data, user_agent)
  values(auth.uid(), 'vehicle_details_edited', 'vehicle', p_vehicle_id::text, to_jsonb(before_row), to_jsonb(after_row), 'Mills Campus Admin');
end;
$$;

revoke all on function public.admin_edit_vehicle(uuid,text,text,integer,text,text,text,text,text,text,text,text,text,text,text,text,text) from public;
grant execute on function public.admin_edit_vehicle(uuid,text,text,integer,text,text,text,text,text,text,text,text,text,text,text,text,text) to authenticated;
