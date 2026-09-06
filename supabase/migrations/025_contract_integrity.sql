-- REBUSCÁNDOME QA13
-- Contratos de datos y consistencia de lecturas.
-- No añade capacidades comerciales.

alter table public.affiliate_products
  drop constraint if exists affiliate_products_commission_percent_range;
alter table public.affiliate_products
  add constraint affiliate_products_commission_percent_range
  check (commission_percent is null or (commission_percent >= 0 and commission_percent <= 100)) not valid;

alter table public.product_assets
  drop constraint if exists product_assets_position_nonnegative;
alter table public.product_assets
  add constraint product_assets_position_nonnegative check (position >= 0) not valid;

alter table public.course_modules
  drop constraint if exists course_modules_position_nonnegative;
alter table public.course_modules
  add constraint course_modules_position_nonnegative check (position >= 0) not valid;

alter table public.lessons
  drop constraint if exists lessons_position_nonnegative;
alter table public.lessons
  add constraint lessons_position_nonnegative check (position >= 0) not valid;

select 'REBUSCÁNDOME QA13: contratos de datos endurecidos' as result;
