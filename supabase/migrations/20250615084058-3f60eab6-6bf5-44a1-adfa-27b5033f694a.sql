
-- Add assigned_to column to tasks table
ALTER TABLE public.tasks 
ADD COLUMN assigned_to uuid REFERENCES auth.users(id);

-- Create table for task collaborators (соисполнители)
CREATE TABLE public.task_collaborators (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'collaborator',
  added_at timestamp with time zone NOT NULL DEFAULT now(),
  added_by uuid NOT NULL REFERENCES auth.users(id),
  UNIQUE(task_id, user_id)
);

-- Create notifications table for task assignments
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'task_assigned',
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS for new tables
ALTER TABLE public.task_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for task_collaborators
CREATE POLICY "Users can view collaborators for tasks they're involved in" 
  ON public.task_collaborators 
  FOR SELECT 
  USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.tasks 
      WHERE id = task_id AND (user_id = auth.uid() OR assigned_to = auth.uid())
    )
  );

CREATE POLICY "Task owners can manage collaborators" 
  ON public.task_collaborators 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks 
      WHERE id = task_id AND user_id = auth.uid()
    )
  );

-- RLS policies for notifications
CREATE POLICY "Users can view their own notifications" 
  ON public.notifications 
  FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications" 
  ON public.notifications 
  FOR UPDATE 
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications" 
  ON public.notifications 
  FOR INSERT 
  WITH CHECK (true);

-- Update tasks RLS to include assigned users
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.tasks;
CREATE POLICY "Users can view their tasks or assigned tasks" 
  ON public.tasks 
  FOR SELECT 
  USING (
    user_id = auth.uid() OR 
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.task_collaborators 
      WHERE task_id = tasks.id AND user_id = auth.uid()
    )
  );

-- Function to create notification when task is assigned
CREATE OR REPLACE FUNCTION public.create_task_assignment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create notification for assigned user if it's not the creator
  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, task_id, type, title, message)
    VALUES (
      NEW.assigned_to,
      NEW.id,
      'task_assigned',
      'Новая задача назначена',
      'Вам назначена задача: ' || NEW.title
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for new task assignments
CREATE OR REPLACE TRIGGER on_task_assigned
  AFTER INSERT OR UPDATE OF assigned_to ON public.tasks
  FOR EACH ROW
  WHEN (NEW.assigned_to IS NOT NULL)
  EXECUTE FUNCTION public.create_task_assignment_notification();

-- Function to create notification when collaborator is added
CREATE OR REPLACE FUNCTION public.create_collaborator_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  task_title text;
BEGIN
  -- Get task title
  SELECT title INTO task_title FROM public.tasks WHERE id = NEW.task_id;
  
  -- Create notification for new collaborator
  INSERT INTO public.notifications (user_id, task_id, type, title, message)
  VALUES (
    NEW.user_id,
    NEW.task_id,
    'collaborator_added',
    'Добавлен как соисполнитель',
    'Вы добавлены как соисполнитель задачи: ' || task_title
  );
  
  RETURN NEW;
END;
$$;

-- Trigger for new collaborators
CREATE OR REPLACE TRIGGER on_collaborator_added
  AFTER INSERT ON public.task_collaborators
  FOR EACH ROW
  EXECUTE FUNCTION public.create_collaborator_notification();

-- Enable realtime for notifications
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER publication supabase_realtime ADD TABLE public.notifications;
