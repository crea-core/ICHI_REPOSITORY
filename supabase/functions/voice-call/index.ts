// supabase/functions/voice-call/index.ts
import { serve } from 'std/server';
import { WebSocketHandler } from 'ws/mod.ts';

interface Peer {
  userId: string;
  socket: WebSocket;
}

const peers = new Map<string, Peer>();

serve(async (req) => {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return new Response('Missing userId', { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);

  socket.onopen = () => {
    peers.set(userId, { userId, socket });
    console.log(`✅ ${userId} connected`);
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const target = peers.get(data.targetUserId);

    if (target) {
      target.socket.send(JSON.stringify({ ...data, fromUserId: userId }));
    }
  };

  socket.onclose = () => {
    peers.delete(userId);
    console.log(`❌ ${userId} disconnected`);
  };

  socket.onerror = (err) => {
    console.error('WebSocket error:', err);
  };

  return response;
});
