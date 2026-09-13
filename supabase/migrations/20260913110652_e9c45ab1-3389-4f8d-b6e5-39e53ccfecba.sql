-- New catalog card for Darya Takmakova and public contacts for Aliya.

INSERT INTO public.therapists (
  name,
  initials,
  spec,
  experience,
  bio,
  price_label,
  languages,
  photo_url,
  contact_email,
  is_verified,
  is_active,
  sort_order
)
SELECT
  'Дарья Такмакова',
  'ДТ',
  'Травма, подавленные / сложное проявление эмоций, болезненные отношения, повторяющиеся сценарии, неуверенность в себе и низкая самооценка, личные границы, отношения взрослый ребёнок — родители',
  '3 года практики',
  $bio$Судебная сфера: гражданские и уголовные дела с детьми и родителями. Частная практика, проект «Психолог в люди».

Для записи: +7 776 270 82 44
Почта: d.takmakova@icloud.com

Специализация:
• Травма, подавленные / сложное проявление эмоций, болезненные отношения, повторяющиеся сценарии
• Неуверенность в себе и низкая самооценка
• Сложности с личными границами
• Взаимоотношения взрослый ребёнок — родители$bio$,
  'онлайн 10 000 ₸ · офлайн 13 000 ₸',
  'Русский',
  '/therapists/darya-takmakova.jpg',
  'd.takmakova@icloud.com',
  true,
  true,
  COALESCE((SELECT MAX(sort_order) + 10 FROM public.therapists), 10)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.therapists
  WHERE contact_email = 'd.takmakova@icloud.com'
     OR name = 'Дарья Такмакова'
);

UPDATE public.therapists
SET bio = CASE
  WHEN bio ILIKE '%aliya.psiholog%' THEN bio
  ELSE trim(both E'\n' FROM bio)
    || E'\n\nInstagram: @aliya.psiholog\nНомер: +7 707 111 60 20'
END
WHERE name ILIKE '%Алия%';