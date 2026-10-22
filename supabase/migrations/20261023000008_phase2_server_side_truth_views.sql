-- Migration 20261023000008: Phase 2 Server-Side Truth Analytics Views
-- Strictly Zero-PII. Readable only by service_role.
-- Source of truth: Subscriptions, Care Circles, Daily Check-ins, Twilio Usage DB tables.

-- ============================================================================
-- 1. View: v_mrr (Monthly Recurring Revenue by Month)
-- ============================================================================
create or replace view public.v_mrr as
with months as (
  -- Distinct activity months from subscriptions
  select distinct to_char(date_trunc('month', d), 'YYYY-MM') as month_str,
                  date_trunc('month', d) as month_start,
                  (date_trunc('month', d) + interval '1 month' - interval '1 second') as month_end
  from (
    select started_at as d from public.subscriptions
    union
    select coalesce(cancelled_at, now()) as d from public.subscriptions
    union
    select now() as d
  ) s
),
monthly_agg as (
  select
    m.month_str,
    count(distinct s.care_circle_id) as active_subscriptions,
    -- Monthly plans
    coalesce(sum(case when s.billing_cycle = 'monthly' then s.price_usd else 0 end), 0) as monthly_plan_mrr,
    -- Annual plans normalized to monthly ($199.99 / 12 = $16.6658)
    coalesce(sum(case when s.billing_cycle = 'annual' then (s.price_usd / 12.0) else 0 end), 0) as annual_plan_mrr
  from months m
  left join public.subscriptions s
    on s.started_at <= m.month_end
    and (s.cancelled_at is null or s.cancelled_at >= m.month_start)
    and s.status in ('active', 'cancelled', 'failed')
  group by m.month_str
)
select
  month_str as month,
  active_subscriptions,
  round(monthly_plan_mrr::numeric, 2) as monthly_plan_mrr_usd,
  round(annual_plan_mrr::numeric, 2) as annual_plan_mrr_usd,
  round((monthly_plan_mrr + annual_plan_mrr)::numeric, 2) as total_mrr_usd
from monthly_agg
order by month_str desc;


-- ============================================================================
-- 2. View: v_conversion_cohorts (Signup Month -> Paid by Month 1/2/3)
-- ============================================================================
create or replace view public.v_conversion_cohorts as
with circle_cohorts as (
  select
    c.id as circle_id,
    to_char(c.created_at, 'YYYY-MM') as signup_cohort_month,
    c.created_at as circle_created_at,
    min(s.started_at) as first_subscription_started_at
  from public.care_circles c
  left join public.subscriptions s on c.id = s.care_circle_id
  group by c.id, c.created_at
),
cohort_aggregates as (
  select
    signup_cohort_month,
    count(distinct circle_id) as total_circles_in_cohort,
    -- Converted within 30 days of creation
    count(distinct case
      when first_subscription_started_at is not null
       and first_subscription_started_at <= (circle_created_at + interval '30 days')
      then circle_id end
    ) as paid_month_1,
    -- Converted within 60 days of creation
    count(distinct case
      when first_subscription_started_at is not null
       and first_subscription_started_at <= (circle_created_at + interval '60 days')
      then circle_id end
    ) as paid_month_2,
    -- Converted within 90 days of creation
    count(distinct case
      when first_subscription_started_at is not null
       and first_subscription_started_at <= (circle_created_at + interval '90 days')
      then circle_id end
    ) as paid_month_3
  from circle_cohorts
  group by signup_cohort_month
)
select
  signup_cohort_month,
  total_circles_in_cohort,
  paid_month_1,
  round((paid_month_1::numeric / nullif(total_circles_in_cohort, 0)::numeric) * 100, 2) as conversion_rate_m1_pct,
  paid_month_2,
  round((paid_month_2::numeric / nullif(total_circles_in_cohort, 0)::numeric) * 100, 2) as conversion_rate_m2_pct,
  paid_month_3,
  round((paid_month_3::numeric / nullif(total_circles_in_cohort, 0)::numeric) * 100, 2) as conversion_rate_m3_pct
from cohort_aggregates
order by signup_cohort_month desc;


-- ============================================================================
-- 3. View: v_churn (Voluntary vs Involuntary, Monthly)
-- ============================================================================
create or replace view public.v_churn as
with months as (
  select distinct to_char(date_trunc('month', d), 'YYYY-MM') as month_str,
                  date_trunc('month', d) as month_start,
                  (date_trunc('month', d) + interval '1 month') as next_month_start
  from (
    select started_at as d from public.subscriptions
    union
    select coalesce(cancelled_at, now()) as d from public.subscriptions
    union
    select now() as d
  ) s
),
monthly_churn_stats as (
  select
    m.month_str,
    -- Active base at start of month
    count(distinct case
      when s.started_at < m.month_start
       and (s.cancelled_at is null or s.cancelled_at >= m.month_start)
      then s.care_circle_id end
    ) as active_subscribers_start,
    -- Voluntary churn in month
    count(distinct case
      when s.cancelled_at >= m.month_start
       and s.cancelled_at < m.next_month_start
       and s.status = 'cancelled'
      then s.care_circle_id end
    ) as voluntary_cancellations,
    -- Involuntary churn in month
    count(distinct case
      when s.cancelled_at >= m.month_start
       and s.cancelled_at < m.next_month_start
       and s.status = 'failed'
      then s.care_circle_id end
    ) as involuntary_payment_failures
  from months m
  left join public.subscriptions s on true
  group by m.month_str
)
select
  month_str as month,
  active_subscribers_start,
  voluntary_cancellations,
  round((voluntary_cancellations::numeric / nullif(active_subscribers_start, 0)::numeric) * 100, 2) as voluntary_churn_rate_pct,
  involuntary_payment_failures,
  round((involuntary_payment_failures::numeric / nullif(active_subscribers_start, 0)::numeric) * 100, 2) as involuntary_churn_rate_pct,
  round(((voluntary_cancellations + involuntary_payment_failures)::numeric / nullif(active_subscribers_start, 0)::numeric) * 100, 2) as total_churn_rate_pct
from monthly_churn_stats
order by month_str desc;


-- ============================================================================
-- 4. View: v_arpu (Average Revenue Per User)
-- ============================================================================
create or replace view public.v_arpu as
with monthly_revenue as (
  select
    to_char(started_at, 'YYYY-MM') as month_str,
    count(distinct care_circle_id) as paying_users_count,
    sum(
      case
        when billing_cycle = 'annual' then (price_usd / 12.0)
        else price_usd
      end
    ) as normalized_mrr_usd
  from public.subscriptions
  where status in ('active', 'cancelled', 'failed')
  group by to_char(started_at, 'YYYY-MM')
)
select
  month_str as month,
  paying_users_count,
  round(normalized_mrr_usd::numeric, 2) as total_revenue_usd,
  round((normalized_mrr_usd::numeric / nullif(paying_users_count, 0)::numeric), 2) as arpu_usd
from monthly_revenue
order by month_str desc;


-- ============================================================================
-- 5. View: v_sms_cost_per_user (Twilio spend / active Family users)
-- ============================================================================
create or replace view public.v_sms_cost_per_user as
with monthly_sms as (
  select
    to_char(created_at, 'YYYY-MM') as month_str,
    count(*) as total_sms_sent,
    coalesce(sum(cost_estimate_usd), 0.0079 * count(*)) as total_twilio_spend_usd
  from public.twilio_usage
  where status != 'failed'
  group by to_char(created_at, 'YYYY-MM')
),
monthly_subscribers as (
  select
    to_char(started_at, 'YYYY-MM') as month_str,
    count(distinct care_circle_id) as active_family_subscribers
  from public.subscriptions
  where status in ('active', 'cancelled', 'failed')
  group by to_char(started_at, 'YYYY-MM')
)
select
  coalesce(u.month_str, s.month_str, to_char(current_date, 'YYYY-MM')) as month,
  coalesce(s.total_sms_sent, 0) as total_sms_sent,
  round(coalesce(s.total_twilio_spend_usd, 0)::numeric, 4) as total_twilio_spend_usd,
  coalesce(u.active_family_subscribers, 0) as active_family_subscribers,
  round((coalesce(s.total_twilio_spend_usd, 0)::numeric / nullif(u.active_family_subscribers, 0)::numeric), 4) as sms_cost_per_user_usd,
  -- Carrier cost as percentage of standard $19.99 subscription
  round(((coalesce(s.total_twilio_spend_usd, 0)::numeric / nullif(u.active_family_subscribers, 0)::numeric) / 19.99) * 100, 2) as sms_cost_pct_of_arpu
from monthly_subscribers u
full outer join monthly_sms s on u.month_str = s.month_str
order by month desc;


-- ============================================================================
-- 6. View: v_activation (First check-in within 7 days; median time-to-activate)
-- ============================================================================
create or replace view public.v_activation as
with circle_first_checkin as (
  select
    c.id as circle_id,
    to_char(c.created_at, 'YYYY-MM') as cohort_month,
    c.created_at as created_at,
    min(d.checked_in_at) as first_check_in_at,
    extract(epoch from (min(d.checked_in_at) - c.created_at)) / 3600.0 as time_to_activate_hours
  from public.care_circles c
  left join public.daily_check_ins d on c.id = d.care_circle_id and d.status = 'ok'
  group by c.id, c.created_at
)
select
  cohort_month,
  count(*) as total_circles_created,
  count(first_check_in_at) as total_activated,
  -- Activated within 7 days of circle creation (<= 168 hours)
  count(case when time_to_activate_hours is not null and time_to_activate_hours <= 168.0 then 1 end) as activated_within_7d,
  round((count(case when time_to_activate_hours is not null and time_to_activate_hours <= 168.0 then 1 end)::numeric / nullif(count(*), 0)::numeric) * 100, 2) as activation_rate_7d_pct,
  round(coalesce(avg(time_to_activate_hours), 0)::numeric, 2) as avg_time_to_activate_hours,
  round(coalesce(percentile_cont(0.5) within group (order by time_to_activate_hours), 0)::numeric, 2) as median_time_to_activate_hours
from circle_first_checkin
group by cohort_month
order by cohort_month desc;


-- ============================================================================
-- 7. View: v_invites (Caregiver invites sent, accepted, rate)
-- ============================================================================
create or replace view public.v_invites as
with circle_totals as (
  select count(*) as total_circles_count from public.care_circles
),
sent_events as (
  select count(*) as total_invites_sent
  from public.analytics_events
  where event_name = 'caregiver_invite_sent'
),
accepted_joins as (
  select count(*) as total_invites_accepted
  from public.care_circle_members m
  join public.care_circles c on m.care_circle_id = c.id
  where m.user_id != c.created_by -- Exclude creator
)
select
  c.total_circles_count,
  coalesce(s.total_invites_sent, 0) as total_invites_sent,
  round((coalesce(s.total_invites_sent, 0)::numeric / nullif(c.total_circles_count, 0)::numeric), 2) as invites_per_circle,
  coalesce(a.total_invites_accepted, 0) as total_invites_accepted,
  round((coalesce(a.total_invites_accepted, 0)::numeric / nullif(s.total_invites_sent, 0)::numeric) * 100, 2) as invite_acceptance_rate_pct
from circle_totals c
cross join sent_events s
cross join accepted_joins a;


-- ============================================================================
-- Security: Readable by service_role only (No public/authenticated/anon access)
-- ============================================================================
revoke all on public.v_mrr from public, authenticated, anon;
grant select on public.v_mrr to service_role;

revoke all on public.v_conversion_cohorts from public, authenticated, anon;
grant select on public.v_conversion_cohorts to service_role;

revoke all on public.v_churn from public, authenticated, anon;
grant select on public.v_churn to service_role;

revoke all on public.v_arpu from public, authenticated, anon;
grant select on public.v_arpu to service_role;

revoke all on public.v_sms_cost_per_user from public, authenticated, anon;
grant select on public.v_sms_cost_per_user to service_role;

revoke all on public.v_activation from public, authenticated, anon;
grant select on public.v_activation to service_role;

revoke all on public.v_invites from public, authenticated, anon;
grant select on public.v_invites to service_role;
