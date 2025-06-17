import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { ModeToggle } from "@/components/mode-toggle";
import { useTheme } from "@/components/theme-provider";
import TaskNode from "@/components/TaskNode";
import TaskConnector from "@/components/TaskConnector";
import TaskDetail from "@/components/TaskDetail";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { NotificationCenter } from "@/components/NotificationCenter";
import { useTranslation } from "@/components/language-provider";

interface Task {
  id: string;
  title: string;
  description: string | null;
  parent_id: string | null;
  user_id: string;
  assigned_to: string | null;
  created_at: string;
  status: "todo" | "in_progress" | "done";
  position_x: number;
  position_y: number;
  media_files: string[];
}

const MindMap = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [connections, setConnections] = useState<{ from: string, to: string }[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerBounds, setContainerBounds] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const updateContainerBounds = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setContainerBounds({ width, height });
      }
    };

    updateContainerBounds();
    window.addEventListener('resize', updateContainerBounds);
    
    return () => window.removeEventListener('resize', updateContainerBounds);
  }, []);
  
  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setCurrentUserId(data.user.id);
      }
    };
    
    fetchUser();
  }, []);

  useEffect(() => {
    const fetchTasks = async () => {
      if (!currentUserId) return;
      
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .or(`user_id.eq.${currentUserId},assigned_to.eq.${currentUserId}`)
          .order('created_at', { ascending: true });
          
        if (error) {
          console.error('Error fetching tasks:', error);
          toast.error(t('failed to load tasks'));
          return;
        }
        
        if (data) {
          console.log('Fetched tasks:', data);
          const taskData = data as Task[];
          setTasks(taskData);
          
          // Build connections based on parent_id relationships
          const newConnections = taskData
            .filter(task => task.parent_id)
            .map(task => ({
              from: task.parent_id as string,
              to: task.id
            }));
            
          setConnections(newConnections);
        }
      } catch (error) {
        console.error('Error fetching tasks:', error);
        toast.error(t('failed to load tasks'));
      } finally {
        setLoading(false);
      }
    };
    
    if (currentUserId) {
      fetchTasks();
    }
  }, [currentUserId, t]);

  const addTestData = async () => {
    if (!currentUserId) {
      toast.error('User not found');
      return;
    }

    try {
      const testTasks = [
        {
          title: 'Основная задача проекта',
          description: 'Это главная задача, которая содержит всю структуру проекта и его основные цели.',
          parent_id: null,
          user_id: currentUserId,
          status: 'in_progress',
          position_x: 400,
          position_y: 200,
          media_files: []
        },
        {
          title: 'Анализ требований',
          description: 'Подробный анализ всех требований к проекту, включая функциональные и нефункциональные требования.',
          parent_id: null,
          user_id: currentUserId,
          status: 'done',
          position_x: 200,
          position_y: 350,
          media_files: []
        },
        {
          title: 'Разработка архитектуры',
          description: 'Создание архитектуры системы с учетом всех требований и ограничений.',
          parent_id: null,
          user_id: currentUserId,
          status: 'todo',
          position_x: 600,
          position_y: 350,
          media_files: []
        },
        {
          title: 'Тестирование',
          description: 'Комплексное тестирование всех компонентов системы.',
          parent_id: null,
          user_id: currentUserId,
          status: 'todo',
          position_x: 400,
          position_y: 500,
          media_files: []
        }
      ];

      // Insert main task first
      const { data: mainTask, error: mainError } = await supabase
        .from('tasks')
        .insert(testTasks[0])
        .select()
        .single();

      if (mainError) throw mainError;

      // Update subtasks with parent_id
      const subTasks = testTasks.slice(1).map(task => ({
        ...task,
        parent_id: mainTask.id
      }));

      const { data: subTasksData, error: subError } = await supabase
        .from('tasks')
        .insert(subTasks)
        .select();

      if (subError) throw subError;

      // Refresh tasks
      const { data: allTasks, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .or(`user_id.eq.${currentUserId},assigned_to.eq.${currentUserId}`)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;

      if (allTasks) {
        const taskData = allTasks as Task[];
        setTasks(taskData);
        
        const newConnections = taskData
          .filter(task => task.parent_id)
          .map(task => ({
            from: task.parent_id as string,
            to: task.id
          }));
          
        setConnections(newConnections);
      }

      toast.success('Тестовые данные добавлены');
    } catch (error) {
      console.error('Error adding test data:', error);
      toast.error('Ошибка при добавлении тестовых данных');
    }
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || !currentUserId) {
      toast.error(t('task title') + ' обязательно');
      return;
    }
    
    try {
      const parentId = selectedTask ? selectedTask.id : null;
      
      // Calculate position relative to parent or center if no parent
      let posX = 400;
      let posY = 200;
      
      if (selectedTask) {
        // Position relative to selected task with better spacing
        const angle = Math.random() * 2 * Math.PI;
        const distance = 180;
        posX = selectedTask.position_x + Math.cos(angle) * distance;
        posY = selectedTask.position_y + Math.sin(angle) * distance;
      } else {
        // Random position around center for root tasks
        posX = 300 + Math.random() * 200;
        posY = 150 + Math.random() * 200;
      }
      
      const newTask = {
        title: newTaskTitle.trim(),
        description: '',
        parent_id: parentId,
        user_id: currentUserId,
        status: 'todo' as const,
        position_x: Math.round(Math.max(100, Math.min(posX, 800))),
        position_y: Math.round(Math.max(100, Math.min(posY, 600))),
        media_files: []
      };

      console.log('Creating task:', newTask);
      
      const { data, error } = await supabase
        .from('tasks')
        .insert(newTask)
        .select()
        .single();
        
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      if (data) {
        console.log('Task created successfully:', data);
        const createdTask = data as Task;
        
        // Update local state
        setTasks(prev => [...prev, createdTask]);
        
        // Add new connection if there's a parent
        if (parentId) {
          setConnections(prev => [...prev, { from: parentId, to: createdTask.id }]);
        }
        
        setNewTaskTitle("");
        setIsCreatingTask(false);
        toast.success(t('task created'));
      }
    } catch (error: any) {
      console.error('Error creating task:', error);
      toast.error(error.message || t('failed to create task'));
    }
  };

  const handleTaskUpdate = async (updatedTask: Partial<Task> & { id: string }) => {
    try {
      console.log('Updating task:', updatedTask);
      
      const { error } = await supabase
        .from('tasks')
        .update(updatedTask)
        .eq('id', updatedTask.id);
        
      if (error) throw error;
      
      // Update local state
      setTasks(prev => prev.map(task => 
        task.id === updatedTask.id ? { ...task, ...updatedTask } : task
      ));
      
      // Update selected task if it's the one being edited
      if (selectedTask && selectedTask.id === updatedTask.id) {
        setSelectedTask(prev => prev ? { ...prev, ...updatedTask } : null);
      }
      
      toast.success(t('task updated'));
    } catch (error: any) {
      console.error('Error updating task:', error);
      toast.error(error.message || t('failed to update task'));
    }
  };

  const handleTaskDelete = async (taskId: string) => {
    try {
      console.log('Deleting task:', taskId);
      
      // First delete all child tasks
      const childTasks = tasks.filter(task => task.parent_id === taskId);
      for (const child of childTasks) {
        await supabase.from('tasks').delete().eq('id', child.id);
      }
      
      // Then delete the main task
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);
        
      if (error) throw error;
      
      // Remove task and its connections
      setTasks(prev => prev.filter(task => task.id !== taskId && task.parent_id !== taskId));
      setConnections(prev => prev.filter(conn => conn.from !== taskId && conn.to !== taskId));
      
      // Clear selection if deleted task was selected
      if (selectedTask && selectedTask.id === taskId) {
        setSelectedTask(null);
      }
      
      toast.success(t('task deleted'));
    } catch (error: any) {
      console.error('Error deleting task:', error);
      toast.error(error.message || t('failed to delete task'));
    }
  };

  const handlePositionChange = (taskId: string, x: number, y: number) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, position_x: x, position_y: y } : task
    ));
  };

  const filterTasksByParent = (parentId: string | null) => {
    return tasks.filter(task => task.parent_id === parentId);
  };

  // Show either all root tasks (with no parent) or children of selected task
  const visibleTasks = selectedTask 
    ? filterTasksByParent(selectedTask.id) 
    : filterTasksByParent(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddTask();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <header className="flex items-center justify-between py-4 px-6 border-b">
        <h1 className="text-xl font-bold cursor-pointer" onClick={() => navigate("/dashboard")}>
          <span className="text-foreground">IC</span>
          <span className="text-green-500 dark:text-green-400">HI</span>
        </h1>
        <div className="flex gap-2">
          <LanguageSwitcher />
          {currentUserId && <NotificationCenter userId={currentUserId} />}
          <ModeToggle />
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            {t('back to dashboard')}
          </Button>
          <Avatar className="cursor-pointer" onClick={() => navigate("/profile")}>
            <AvatarFallback className="bg-green-500 dark:bg-green-600 text-white">ПР</AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">{t('mind map')}</h2>
            {selectedTask && (
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedTask(null)}
                  className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                >
                  ← {t('all tasks')}
                </Button>
                <span className="text-muted-foreground">
                  / {selectedTask.title}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            {/* Test data button */}
            {tasks.length === 0 && (
              <Button 
                onClick={addTestData} 
                variant="outline"
                className="border-green-500 text-green-600 hover:bg-green-500 hover:text-white dark:border-green-400 dark:text-green-400 dark:hover:bg-green-600"
              >
                Добавить тестовые данные
              </Button>
            )}
            
            {isCreatingTask ? (
              <div className="flex gap-2">
                <Input
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder={selectedTask ? `Подзадача для "${selectedTask.title}"` : t('task title')}
                  className="w-64 focus:ring-green-500 dark:focus:ring-green-400"
                  autoFocus
                  onKeyDown={handleKeyDown}
                />
                <Button 
                  onClick={handleAddTask} 
                  className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
                  disabled={!newTaskTitle.trim()}
                >
                  {t('add')}
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setIsCreatingTask(false);
                    setNewTaskTitle('');
                  }}
                >
                  {t('cancel')}
                </Button>
              </div>
            ) : (
              <Button 
                onClick={() => setIsCreatingTask(true)} 
                className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
              >
                {selectedTask ? 'Новая подзадача' : t('new task')}
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 dark:border-green-400"></div>
          </div>
        ) : (
          <div 
            ref={containerRef}
            className="relative h-[600px] border rounded-lg bg-background overflow-hidden"
          >
            {/* Task nodes */}
            {visibleTasks.map(task => (
              <TaskNode 
                key={task.id}
                task={task}
                onClick={() => handleTaskClick(task)}
                isSelected={selectedTask?.id === task.id}
                onUpdate={handleTaskUpdate}
                onPositionChange={handlePositionChange}
                containerBounds={containerBounds}
              />
            ))}
            
            {/* Connections */}
            {connections
              .filter(conn => 
                visibleTasks.some(t => t.id === conn.to) && 
                visibleTasks.some(t => t.id === conn.from)
              )
              .map((conn, idx) => {
                const fromTask = tasks.find(t => t.id === conn.from);
                const toTask = tasks.find(t => t.id === conn.to);
                
                if (!fromTask || !toTask) return null;
                
                return (
                  <TaskConnector
                    key={`conn-${idx}`}
                    fromX={fromTask.position_x}
                    fromY={fromTask.position_y}
                    toX={toTask.position_x}
                    toY={toTask.position_y}
                  />
                );
              })}
              
            {/* Empty state */}
            {visibleTasks.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <p className="text-lg mb-2">
                  {selectedTask 
                    ? t('no subtasks') 
                    : t('no tasks')}
                </p>
                <Button
                  onClick={() => setIsCreatingTask(true)}
                  variant="outline"
                  className="border-green-500 text-green-600 hover:bg-green-500 hover:text-white dark:border-green-400 dark:text-green-400 dark:hover:bg-green-600"
                >
                  {selectedTask ? 'Создать подзадачу' : t('create first task')}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Task detail panel */}
        {selectedTask && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-green-700 dark:text-green-400">{t('task details')}</CardTitle>
            </CardHeader>
            <CardContent>
              <TaskDetail 
                task={selectedTask} 
                onUpdate={handleTaskUpdate}
                onDelete={handleTaskDelete}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MindMap;
