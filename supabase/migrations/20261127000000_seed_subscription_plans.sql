-- Seed the exact active subscription packages for Fit & Impact
INSERT INTO public.subscription_plans (name, price, duration_days, is_active)
SELECT v.name, v.price, v.duration_days, true
FROM (
  VALUES
    ('1 Month GYM', 1000, 30),
    ('3 Months GYM', 2500, 90),
    ('Cardio', 1500, 30),
    ('Personal Training', 4500, 30),
    ('3 Month Cardio', 4000, 90),
    ('4 Month Cardio', 5000, 120),
    ('Annual Package', 10000, 365)
) AS v(name, price, duration_days)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.subscription_plans sp
  WHERE LOWER(sp.name) = LOWER(v.name)
);

-- Ensure existing matching plans have expected duration, price, and active status
UPDATE public.subscription_plans AS sp
SET
  price = v.price,
  duration_days = v.duration_days,
  is_active = true
FROM (
  VALUES
    ('1 Month GYM', 1000, 30),
    ('3 Months GYM', 2500, 90),
    ('Cardio', 1500, 30),
    ('Personal Training', 4500, 30),
    ('3 Month Cardio', 4000, 90),
    ('4 Month Cardio', 5000, 120),
    ('Annual Package', 10000, 365)
) AS v(name, price, duration_days)
WHERE LOWER(sp.name) = LOWER(v.name);
