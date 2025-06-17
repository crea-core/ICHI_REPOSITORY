
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { TaskMediaUpload } from "./TaskMediaUpload";
import { UserSelector } from "./UserSelector";
import { useTranslation } from "@/components/language-provider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Task {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  position_x: number;
  position_y: number;
  parent_id: string | null;
  user_id: string;
  assigned_to: string | null;
  created_at: string;
  media_files?: string[];
}

interface TaskDetailProps {
  task: Task;
  onUpdate: (updatedTask: Partial<Task> & { id: string }) => void;
  onDelete: (taskId: string) => void;
}

const TaskDetail = ({ task, onUpdate, onDelete }: TaskDetailProps) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [status, setStatus] = useState(task.status);
  const [assignedUserId, setAssignedUserId] = useState<string | null>(task.assigned_to);
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [mediaFiles, setMediaFiles] = useState<string[]>(task.media_files || []);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    fetchCollaborators();
  }, [task.id]);

  const fetchCollaborators = async () => {
    try {
      const { data, error } = await supabase
        .from('task_collaborators')
        .select('user_id')
        .eq('task_id', task.id);

      if (error) throw error;
      setCollaborators(data?.map(c => c.user_id) || []);
    } catch (error) {
      console.error('Error fetching collaborators:', error);
    }
  };

  const handleSave = async () => {
    try {
      // Update task
      const updatedTask = {
        id: task.id,
        title,
        description,
        status,
        assigned_to: assignedUserId,
        media_files: mediaFiles
      };

      onUpdate(updatedTask);

      // Update collaborators
      await updateCollaborators();
      
      setIsEditing(false);
      toast.success(t('task updated'));
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error(t('failed to update task'));
    }
  };

  const updateCollaborators = async () => {
    try {
      // Remove existing collaborators
      await supabase
        .from('task_collaborators')
        .delete()
        .eq('task_id', task.id);

      // Add new collaborators
      if (collaborators.length > 0) {
        const collaboratorData = collaborators.map(userId => ({
          task_id: task.id,
          user_id: userId,
          added_by: currentUserId
        }));

        await supabase
          .from('task_collaborators')
          .insert(collaboratorData);
      }
    } catch (error) {
      console.error('Error updating collaborators:', error);
    }
  };
  
  const handleCancel = () => {
    setTitle(task.title);
    setDescription(task.description);
    setStatus(task.status);
    setAssignedUserId(task.assigned_to);
    setMediaFiles(task.media_files || []);
    fetchCollaborators();
    setIsEditing(false);
  };

  const handleMediaUpload = (urls: string[]) => {
    setMediaFiles(urls);
  };
  
  return (
    <div className="space-y-4">
      {isEditing ? (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('title')}</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('task title')}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('description')}</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('task description')}
              rows={4}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('status')}</label>
            <Select value={status} onValueChange={(value: "todo" | "in_progress" | "done") => setStatus(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">{t('todo')}</SelectItem>
                <SelectItem value="in_progress">{t('in_progress')}</SelectItem>
                <SelectItem value="done">{t('done')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <UserSelector
            currentUserId={currentUserId}
            assignedUserId={assignedUserId}
            collaborators={collaborators}
            onAssignedUserChange={setAssignedUserId}
            onCollaboratorsChange={setCollaborators}
          />

          <div className="space-y-2">
            <label className="text-sm font-medium">Медиафайлы</label>
            <TaskMediaUpload
              taskId={task.id}
              userId={task.user_id}
              onMediaUploaded={handleMediaUpload}
              existingMedia={mediaFiles}
            />
          </div>
          
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleCancel}>
              {t('cancel')}
            </Button>
            <Button 
              onClick={handleSave}
              className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
              disabled={!title.trim()}
            >
              {t('save changes')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div>
            <h3 className="text-lg font-medium">{task.title}</h3>
            <p className="text-muted-foreground mt-1">
              {task.description || t('no description')}
            </p>
          </div>

          {/* Assignment info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{t('assigned to')}:</span>
              <span className="text-sm">
                {task.assigned_to ? 'Назначено пользователю' : t('no assignment')}
              </span>
            </div>
            
            {collaborators.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{t('collaborators')}:</span>
                <span className="text-sm">{collaborators.length} соисполнителей</span>
              </div>
            )}
          </div>

          {task.media_files && task.media_files.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Медиафайлы</h4>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {task.media_files.map((url, index) => (
                  <div key={index} className="border rounded-lg p-2 bg-muted/30">
                    {url.includes('.mp4') || url.includes('.mov') || url.includes('.webm') ? (
                      <video 
                        src={url} 
                        controls 
                        className="w-full max-h-24 rounded"
                        preload="metadata"
                      />
                    ) : (
                      <img 
                        src={url} 
                        alt={`Media ${index + 1}`}
                        className="w-full max-h-24 object-contain rounded"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex justify-between items-center pt-2">
            <div>
              <span className="text-sm font-medium mr-2">{t('status')}:</span>
              <span className="text-sm">{t(task.status)}</span>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                {t('edit')}
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">{t('delete')}</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('delete task')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('delete task confirmation')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(task.id)}>
                      {t('delete')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TaskDetail;
