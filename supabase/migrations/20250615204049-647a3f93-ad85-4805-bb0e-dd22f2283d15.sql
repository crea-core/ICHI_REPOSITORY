
-- Удаляем старые, некорректные связи, которые ссылались на системную таблицу auth.users
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_user_id_fkey;
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_contact_id_fkey;

-- Создаем новые, правильные связи, которые ссылаются на таблицу public.profiles
ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
