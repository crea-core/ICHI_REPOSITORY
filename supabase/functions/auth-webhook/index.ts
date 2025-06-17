
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload = await req.json()
    console.log('Auth webhook payload:', payload)

    const { type, record } = payload

    // Обработка событий авторизации
    switch (type) {
      case 'INSERT':
        // Пользователь зарегистрировался
        console.log(`User signed up: ${record.email}`)
        
        // Создаем запись о статусе пользователя
        await supabase
          .from('user_status')
          .upsert({
            user_id: record.id,
            status: 'online',
            last_active: new Date().toISOString()
          })
        
        break

      case 'UPDATE':
        // Обновление данных пользователя (например, подтверждение email)
        if (record.email_confirmed_at && !record.last_sign_in_at) {
          console.log(`User email confirmed: ${record.email}`)
        }
        
        if (record.last_sign_in_at) {
          console.log(`User signed in: ${record.email}`)
          
          // Обновляем статус на "онлайн"
          await supabase
            .from('user_status')
            .upsert({
              user_id: record.id,
              status: 'online',
              last_active: new Date().toISOString()
            })
        }
        
        break

      case 'DELETE':
        // Пользователь удален
        console.log(`User deleted: ${record.email}`)
        
        // Удаляем статус пользователя
        await supabase
          .from('user_status')
          .delete()
          .eq('user_id', record.id)
        
        break
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Auth webhook error:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
