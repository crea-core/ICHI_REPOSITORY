
-- 1. Создание хранилища (bucket) для аватаров
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true);

-- 2. Настройка политик доступа для хранилища аватаров
CREATE POLICY "Аватары доступны для просмотра всем"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'avatars' );

CREATE POLICY "Аутентифицированные пользователи могут загружать аватары"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK ( bucket_id = 'avatars' );

CREATE POLICY "Пользователи могут обновлять свои аватары"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING ( auth.uid() = owner )
  WITH CHECK ( bucket_id = 'avatars' );

CREATE POLICY "Пользователи могут удалять свои аватары"
  ON storage.objects FOR DELETE
  TO authenticated
  USING ( auth.uid() = owner );

-- 3. Настройка политик доступа (RLS) для таблицы задач (tasks)
CREATE POLICY "Пользователи могут создавать задачи"
  ON public.tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Пользователи могут обновлять свои задачи"
  ON public.tasks
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Пользователи могут удалять свои задачи"
  ON public.tasks
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
