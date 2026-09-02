-- Migration: Fix Jefatura institution assignments to strictly prevent cross-institution email notifications
UPDATE public.profiles SET institution_id = 'f512fa56-14ba-4536-ac45-f1f01bfcb758' WHERE id = '50d7d1df-4fc7-4338-804c-756c9a27c60a'; -- Marcelo Díaz -> Fomento al Riego
UPDATE public.profiles SET institution_id = '20f4194b-d3fd-46c5-ad62-509fd2c67fff' WHERE id = 'f966dea6-74df-4070-8749-c35e0c1730d5'; -- Marianela Matta -> Estudios
UPDATE public.profiles SET institution_id = '1065cb9c-d0e0-4bd3-8dfc-b1af737f3f49' WHERE id = '936eb9a4-3c02-4fe1-b6c1-bf2fcee944ad'; -- Jorge Marín -> Dirección Ejecutiva
UPDATE public.profiles SET institution_id = '4694b44e-d3a5-45be-9920-a25617fbd8e1' WHERE id = 'e7b34182-1ad7-41a4-93e5-b15bec61d347'; -- Doris Roa -> División Jurídica
UPDATE public.profiles SET institution_id = '355a27ad-39b4-47f9-86ae-fb8925260155' WHERE id = 'eff3c1b2-76c5-4419-98da-d2daba3dd05b'; -- Andres Guajardo -> Admin y Finanzas

DELETE FROM public.user_institutions WHERE user_id = 'f966dea6-74df-4070-8749-c35e0c1730d5' AND institution_id <> '20f4194b-d3fd-46c5-ad62-509fd2c67fff';
DELETE FROM public.user_institutions WHERE user_id = '936eb9a4-3c02-4fe1-b6c1-bf2fcee944ad' AND institution_id <> '1065cb9c-d0e0-4bd3-8dfc-b1af737f3f49';
DELETE FROM public.user_institutions WHERE user_id = '50d7d1df-4fc7-4338-804c-756c9a27c60a' AND institution_id <> 'f512fa56-14ba-4536-ac45-f1f01bfcb758';
