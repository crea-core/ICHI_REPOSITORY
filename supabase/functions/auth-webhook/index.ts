import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow POST requests for the webhook
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { 
      headers: corsHeaders,
      status: 405 
    });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL or Service Role Key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse the request body
    let payload;
    try {
      payload = await req.json();
    } catch (err) {
      throw new Error('Invalid JSON payload');
    }

    console.log('Auth webhook payload:', payload);

    const { type, table, record } = payload;

    // Verify this is an auth event
    if (table !== 'users') {
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Not a users table event, ignoring'
      }), {
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        },
        status: 200
      });
    }

    // Process auth events
    switch(type) {
      case 'INSERT':
        console.log(`User signed up: ${record.email}`);
        await supabase
          .from('user_status')
          .upsert({
            user_id: record.id,
            status: 'online',
            last_active: new Date().toISOString()
          });
        break;

      case 'UPDATE':
        if (record.email_confirmed_at && !record.last_sign_in_at) {
          console.log(`User email confirmed: ${record.email}`);
        }
        if (record.last_sign_in_at) {
          console.log(`User signed in: ${record.email}`);
          await supabase
            .from('user_status')
            .upsert({
              user_id: record.id,
              status: 'online',
              last_active: new Date().toISOString()
            });
        }
        break;

      case 'DELETE':
        console.log(`User deleted: ${record.email}`);
        await supabase
          .from('user_status')
          .delete()
          .eq('user_id', record.id);
        break;
    }

    return new Response(JSON.stringify({ 
      success: true 
    }), {
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json' 
      },
      status: 200
    });

  } catch (error) {
    console.error('Auth webhook error:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json' 
      },
      status: error.message.includes('Invalid JSON') ? 400 : 500
    });
  }
});
