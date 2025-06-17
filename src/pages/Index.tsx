
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';

const Index = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-white">
      <header className="absolute top-0 w-full flex justify-between items-center py-6 px-8">
        <h1 className="text-2xl font-bold">
          <span className="text-black">Task</span>
          <span className="text-[#33C3F0]">Tide</span>
        </h1>
        <div>
          {!loading && (
            session ? (
              <Button
                className="bg-[#33C3F0] hover:bg-[#1EAEDB]"
                onClick={() => navigate('/dashboard')}
              >
                Перейти в дашборд
              </Button>
            ) : (
              <Button
                className="bg-[#33C3F0] hover:bg-[#1EAEDB]"
                onClick={() => navigate('/auth')}
              >
                Войти
              </Button>
            )
          )}
        </div>
      </header>

      <main className="text-center px-6">
        <h2 className="text-5xl font-bold mb-6">
          Управляйте задачами и общайтесь с командой
        </h2>
        <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto">
          TaskTide — это удобная платформа для управления задачами, коммуникации и эффективной работы в команде.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            className="bg-[#33C3F0] hover:bg-[#1EAEDB] text-white px-8 py-6 text-lg"
            onClick={() => navigate('/auth')}
          >
            Начать бесплатно
          </Button>
          <Button
            variant="outline"
            className="px-8 py-6 text-lg"
            onClick={() => {
              const featuresSection = document.getElementById('features');
              featuresSection?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            Узнать больше
          </Button>
        </div>
      </main>

      <section id="features" className="py-20 w-full max-w-7xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-center mb-12">Основные возможности</h2>
        
        <div className="grid md:grid-cols-3 gap-10">
          <div className="text-center">
            <div className="bg-[#33C3F0] text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Пинборд для задач</h3>
            <p className="text-gray-600">Управляйте и закрепляйте задачи, чтобы всегда иметь доступ к важной информации.</p>
          </div>
          
          <div className="text-center">
            <div className="bg-[#33C3F0] text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Чаты и звонки</h3>
            <p className="text-gray-600">Общайтесь с командой через текстовые сообщения и голосовые звонки.</p>
          </div>
          
          <div className="text-center">
            <div className="bg-[#33C3F0] text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Электронная почта</h3>
            <p className="text-gray-600">Интегрированная работа с электронной почтой без переключения между приложениями.</p>
          </div>
        </div>

        <div className="text-center mt-16">
          <Button 
            className="bg-[#33C3F0] hover:bg-[#1EAEDB]"
            onClick={() => navigate('/auth')}
          >
            Зарегистрироваться
          </Button>
        </div>
      </section>

      <footer className="w-full py-10 bg-gray-50 text-center">
        <p className="text-gray-600">
          © {new Date().getFullYear()} TaskTide. Все права защищены.
        </p>
      </footer>
    </div>
  );
};

export default Index;
