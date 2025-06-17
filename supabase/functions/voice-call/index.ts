import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const peers = new Map<string, WebSocket>();

serve(async (req) => {
  const { searchParams, pathname } = new URL(req.url);
  
  // Разрешить CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (pathname !== "/voice-call") {
    return new Response("Not found", { status: 404 });
  }

  const userId = searchParams.get("userId");
  if (!userId) return new Response("Missing userId", { status: 400 });

  const { socket, response } = Deno.upgradeWebSocket(req);

  socket.onopen = () => {
    peers.set(userId, socket);
    console.log(`✅ ${userId} connected`);
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      const target = peers.get(data.targetUserId);
      
      if (target && target.readyState === WebSocket.OPEN) {
        target.send(JSON.stringify({ 
          ...data, 
          fromUserId: userId 
        }));
      }
    } catch (error) {
      console.error("Error handling message:", error);
    }
  };

  socket.onclose = () => {
    peers.delete(userId);
    console.log(`❌ ${userId} disconnected`);
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  return response;
});
