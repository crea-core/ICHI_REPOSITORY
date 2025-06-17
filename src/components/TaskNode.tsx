import { useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImageIcon, VideoIcon, Eye } from "lucide-react";
import { useTranslation } from "@/components/language-provider";

interface Task {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  position_x: number;
  position_y: number;
  parent_id: string | null;
  user_id: string;
  created_at: string;
  media_files?: string[];
}

interface TaskNodeProps {
  task: Task;
  onClick: () => void;
  isSelected: boolean;
  onUpdate: (updatedTask: Partial<Task> & { id: string }) => void;
  onPositionChange?: (taskId: string, x: number, y: number) => void;
  containerBounds?: { width: number; height: number };
}

const TaskNode = ({ task, onClick, isSelected, onUpdate, onPositionChange, containerBounds }: TaskNodeProps) => {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showPreview, setShowPreview] = useState(false);
  
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    
    // Store initial offset from mouse to task position
    const rect = e.currentTarget.getBoundingClientRect();
    const parentRect = (e.currentTarget as HTMLElement).offsetParent?.getBoundingClientRect() || { left: 0, top: 0 };
    
    setDragStart({
      x: e.clientX - (task.position_x + parentRect.left),
      y: e.clientY - (task.position_y + parentRect.top)
    });
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging) return;
      
      const parentRect = (e.currentTarget as HTMLElement).offsetParent?.getBoundingClientRect() || { left: 0, top: 0 };
      const newX = moveEvent.clientX - parentRect.left - dragStart.x;
      const newY = moveEvent.clientY - parentRect.top - dragStart.y;
      
      // Define container bounds with proper padding
      const nodeWidth = 224; // w-56 = 224px
      const nodeHeight = 120; // approximate node height
      const padding = 20;
      
      const bounds = containerBounds || { width: 800, height: 600 };
      
      // Constrain to container bounds
      const constrainedX = Math.max(
        nodeWidth / 2 + padding, 
        Math.min(newX, bounds.width - nodeWidth / 2 - padding)
      );
      const constrainedY = Math.max(
        nodeHeight / 2 + padding, 
        Math.min(newY, bounds.height - nodeHeight / 2 - padding)
      );
      
      if (onPositionChange) {
        onPositionChange(task.id, constrainedX, constrainedY);
      }
    };
    
    const handleMouseUp = (upEvent: MouseEvent) => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      const parentRect = (e.currentTarget as HTMLElement).offsetParent?.getBoundingClientRect() || { left: 0, top: 0 };
      const newX = upEvent.clientX - parentRect.left - dragStart.x;
      const newY = upEvent.clientY - parentRect.top - dragStart.y;
      
      // Define container bounds with proper padding
      const nodeWidth = 224;
      const nodeHeight = 120;
      const padding = 20;
      
      const bounds = containerBounds || { width: 800, height: 600 };
      
      // Final position with constraints
      const finalX = Math.max(
        nodeWidth / 2 + padding, 
        Math.min(newX, bounds.width - nodeWidth / 2 - padding)
      );
      const finalY = Math.max(
        nodeHeight / 2 + padding, 
        Math.min(newY, bounds.height - nodeHeight / 2 - padding)
      );
      
      onUpdate({
        id: task.id,
        position_x: finalX,
        position_y: finalY
      });
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  const getStatusColor = () => {
    switch (task.status) {
      case 'todo': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-700';
      case 'done': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300 dark:border-green-700';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  const hasMedia = task.media_files && task.media_files.length > 0;

  return (
    <>
      <div 
        className={`absolute p-4 w-56 rounded-xl shadow-lg cursor-move transition-all duration-200 border-2
          ${isSelected 
            ? 'ring-2 ring-green-500 border-green-500 dark:ring-green-400 dark:border-green-400 shadow-green-200 dark:shadow-green-900/20' 
            : 'ring-0 border-border hover:border-green-300 dark:hover:border-green-600'} 
          ${isDragging ? 'opacity-80 scale-105 shadow-2xl z-50' : 'opacity-100 hover:shadow-xl z-10'}
          bg-card text-card-foreground backdrop-blur-sm`}
        style={{
          left: task.position_x,
          top: task.position_y,
          transform: 'translate(-50%, -50%)',
          zIndex: isSelected || isDragging ? 50 : 10
        }}
        onClick={(e) => {
          if (!isDragging) {
            onClick();
          }
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="flex justify-between items-start mb-3">
          <h4 className="font-semibold text-sm truncate flex-1 text-foreground pr-2">{task.title}</h4>
          <Badge className={`text-xs shrink-0 ${getStatusColor()}`}>
            {t(task.status)}
          </Badge>
        </div>
        
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
            {task.description}
          </p>
        )}
        
        <div className="flex items-center justify-between">
          {hasMedia && (
            <div className="flex items-center gap-1">
              {task.media_files.some(url => url.includes('.mp4') || url.includes('.mov') || url.includes('.webm')) && (
                <VideoIcon className="h-3 w-3 text-blue-500" />
              )}
              {task.media_files.some(url => !url.includes('.mp4') && !url.includes('.mov') && !url.includes('.webm')) && (
                <ImageIcon className="h-3 w-3 text-green-500" />
              )}
              <span className="text-xs text-muted-foreground">
                {task.media_files.length}
              </span>
            </div>
          )}
          
          {(task.description || hasMedia) && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 opacity-70 hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                setShowPreview(true);
              }}
            >
              <Eye className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Enhanced Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPreview(false)}>
          <div className="bg-card p-6 rounded-lg max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-foreground">{task.title}</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>×</Button>
            </div>
            
            {task.description && (
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2 text-foreground">{t('description')}</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>
              </div>
            )}
            
            {hasMedia && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-foreground">{t('upload media')}</h4>
                <div className="grid gap-3">
                  {task.media_files.map((url, index) => (
                    <div key={index} className="border rounded-lg p-2 bg-muted/50">
                      {url.includes('.mp4') || url.includes('.mov') || url.includes('.webm') ? (
                        <video 
                          src={url} 
                          controls 
                          className="w-full max-h-48 rounded"
                          preload="metadata"
                        />
                      ) : (
                        <img 
                          src={url} 
                          alt={`Media ${index + 1}`}
                          className="w-full max-h-48 object-contain rounded"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="mt-4 flex justify-between items-center">
              <Badge className={getStatusColor()}>
                {t(task.status)}
              </Badge>
              <Button onClick={() => setShowPreview(false)} variant="outline" size="sm">
                {t('close')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TaskNode;
