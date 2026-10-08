CREATE TABLE public.daily_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank text NOT NULL CHECK (bank IN ('daily','self','psych')),
  topic text NOT NULL DEFAULT '',
  text text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.daily_questions TO authenticated;
GRANT ALL ON public.daily_questions TO service_role;
ALTER TABLE public.daily_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read active questions" ON public.daily_questions FOR SELECT TO authenticated USING (active);

CREATE TABLE public.ai_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_chat_messages_user_idx ON public.ai_chat_messages (user_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.ai_chat_messages TO authenticated;
GRANT ALL ON public.ai_chat_messages TO service_role;
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own AI messages read" ON public.ai_chat_messages FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own AI messages insert" ON public.ai_chat_messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own AI messages delete" ON public.ai_chat_messages FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.ai_usage (
  user_id uuid NOT NULL,
  day date NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
GRANT SELECT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own AI usage read" ON public.ai_usage FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Plan-based limit: free plan = 30/day. Subscriptions will raise it here later.
CREATE OR REPLACE FUNCTION public.ai_daily_limit(_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT 30 $$;

CREATE OR REPLACE FUNCTION public.consume_ai_message()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _lim integer; _used integer; _day date := (now() AT TIME ZONE 'Asia/Almaty')::date;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  _lim := public.ai_daily_limit(_uid);
  INSERT INTO public.ai_usage(user_id, day, count) VALUES (_uid, _day, 0) ON CONFLICT DO NOTHING;
  SELECT count INTO _used FROM public.ai_usage WHERE user_id = _uid AND day = _day FOR UPDATE;
  IF _used >= _lim THEN RETURN jsonb_build_object('allowed', false, 'used', _used, 'limit', _lim); END IF;
  UPDATE public.ai_usage SET count = count + 1 WHERE user_id = _uid AND day = _day;
  RETURN jsonb_build_object('allowed', true, 'used', _used + 1, 'limit', _lim);
END $$;

CREATE OR REPLACE FUNCTION public.ai_usage_today()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'used', COALESCE((SELECT count FROM public.ai_usage WHERE user_id = auth.uid() AND day = (now() AT TIME ZONE 'Asia/Almaty')::date), 0),
    'limit', public.ai_daily_limit(auth.uid()))
$$;

REVOKE EXECUTE ON FUNCTION public.ai_daily_limit(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.consume_ai_message() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ai_usage_today() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_message() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ai_usage_today() TO authenticated;

INSERT INTO public.daily_questions (bank, topic, text, sort) VALUES
('daily','Эмоции и состояние','Что сегодня вызвало у тебя больше всего эмоций — положительных или отрицательных?',1),
('daily','Эмоции и состояние','Какое чувство преобладало сегодня весь день?',2),
('daily','Эмоции и состояние','Было ли сегодня что-то, что вызвало раздражение или злость?',3),
('daily','Эмоции и состояние','Что сегодня тебя удивило?',4),
('daily','Энергия и усталость','Что сегодня отняло у тебя больше всего энергии?',5),
('daily','Энергия и усталость','Что, наоборот, подзарядило тебя сегодня?',6),
('daily','Энергия и усталость','Что сейчас чувствуется сильнее — отдых или усталость?',7),
('daily','Благодарность и позитив','За что хочется сказать спасибо сегодняшнему дню?',8),
('daily','Благодарность и позитив','Какой момент дня был самым приятным?',9),
('daily','Благодарность и позитив','Кто сегодня сделал что-то хорошее для тебя?',10),
('daily','Тревога и стресс','Было ли сегодня что-то, что вызывало тревогу?',11),
('daily','Тревога и стресс','Если бы можно было убрать одну вещь, которая тебя беспокоит, — что бы это было?',12),
('daily','Тревога и стресс','Что помогло тебе успокоиться сегодня, если было тревожно?',13),
('daily','Решения и мысли','Какое решение было принято сегодня и как ощущается после него?',14),
('daily','Решения и мысли','О чём сегодня думалось чаще всего?',15),
('daily','Решения и мысли','Есть ли что-то, что ты откладываешь, но знаешь, что нужно сделать?',16),
('daily','Отношения и общение','С кем сегодня было больше всего общения и как это на тебя повлияло?',17),
('daily','Отношения и общение','Было ли сегодня честное, искреннее общение?',18),
('daily','Отношения и общение','Не хватало ли тебе сегодня кого-то, с кем можно было бы поговорить?',19),
('daily','Про себя и рост','Чем ты гордишься за последние несколько дней?',20),
('daily','Про себя и рост','Какие слова хочется передать себе сегодняшним утром, если бы это было возможно?',21),
('daily','Про себя и рост','Что завтра хочется сделать иначе, чем сегодня?',22),
('self','Ценности и приоритеты','Что для тебя важнее всего в жизни прямо сейчас?',1),
('self','Ценности и приоритеты','Какие три вещи ты никогда не станешь делать, даже если тебя попросят?',2),
('self','Ценности и приоритеты','Если бы деньги не имели значения, чем хотелось бы заниматься?',3),
('self','Сильные стороны и слабости','Что у тебя действительно хорошо получается, но об этом редко говоришь?',4),
('self','Сильные стороны и слабости','Какая твоя черта характера мешает тебе больше всего?',5),
('self','Сильные стороны и слабости','За что тебя чаще всего хвалят другие люди?',6),
('self','Страхи и границы','Чего ты боишься больше всего, если честно с собой?',7),
('self','Страхи и границы','Что ты терпишь в жизни, хотя давно пора было сказать «нет»?',8),
('self','Страхи и границы','Какую границу пока не получается отстаивать?',9),
('self','Прошлое и формирование личности','Какое событие в жизни сильнее всего тебя изменило?',10),
('self','Прошлое и формирование личности','Какой совет пригодился бы тебе пять лет назад?',11),
('self','Прошлое и формирование личности','Что в тебе осталось из детства?',12),
('self','Настоящее «я»','Каким человеком ты себя считаешь, а каким тебя видят другие — есть ли разница?',13),
('self','Настоящее «я»','Что ты делаешь не потому, что хочешь, а потому что «так надо»?',14),
('self','Настоящее «я»','Если бы никто тебя не оценивал, что изменилось бы в твоих поступках?',15),
('self','Будущее и смысл','Каким человеком хочется стать через 5 лет?',16),
('self','Будущее и смысл','Что хочется, чтобы люди помнили о тебе?',17),
('self','Будущее и смысл','Что даёт тебе ощущение, что день прожит не зря?',18),
('psych','Тревога и беспокойство','Что чаще всего вызывает у тебя тревогу — конкретные события или ощущение неопределённости?',1),
('psych','Тревога и беспокойство','Как ты понимаешь, что тревога усиливается — по каким признакам в теле или мыслях?',2),
('psych','Тревога и беспокойство','Что помогает тебе снизить тревогу в моменте?',3),
('psych','Стресс и копинг-стратегии','Как ты обычно реагируешь на стресс — действием, избеганием или заморозкой?',4),
('psych','Стресс и копинг-стратегии','Есть ли у тебя привычка «заедать» или «загружать себя делами», чтобы не думать о проблеме?',5),
('psych','Стресс и копинг-стратегии','Что ты делаешь, когда чувствуешь, что не справляешься?',6),
('psych','Самооценка','Как ты относишься к своим ошибкам — как к провалу или как к опыту?',7),
('psych','Самооценка','Сравниваешь ли ты себя с другими людьми? Как часто и в чём?',8),
('psych','Самооценка','Что заставляет тебя сомневаться в себе чаще всего?',9),
('psych','Границы и отношения','Легко ли тебе говорить «нет», когда что-то не устраивает?',10),
('psych','Границы и отношения','Чувствуешь ли ты вину, когда отдыхаешь или ничего не делаешь?',11),
('psych','Границы и отношения','Есть ли люди, рядом с которыми тебе приходится «надевать маску»?',12),
('psych','Внутренний диалог','Какой у тебя внутренний голос — поддерживающий или критикующий?',13),
('psych','Внутренний диалог','Как ты разговариваешь с собой, когда что-то не получилось?',14),
('psych','Внутренний диалог','Бывают ли навязчивые мысли, от которых трудно избавиться?',15),
('psych','Прошлый опыт и паттерны','Повторяются ли у тебя одни и те же сложности в разных ситуациях (работа, отношения)?',16),
('psych','Прошлый опыт и паттерны','Есть ли реакция, которая «включается на автомате», даже если не хочется так реагировать?',17);