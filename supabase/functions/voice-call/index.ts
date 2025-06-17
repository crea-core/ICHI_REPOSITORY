
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Установка CORS-заголовков для совместимости между разными источниками
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Хранилище активных соединений с пользователями
interface Connection {
  socket: WebSocket;
  userId: string;
  peerId: string | null;
}

// Хранилище соединений по ID пользователя
const connections = new Map<string, Connection>();

serve((req) => {
  // Обработка CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Проверка заголовка Upgrade для WebSocket
  const upgradeHeader = req.headers.get('upgrade') || '';
  if (upgradeHeader.toLowerCase() !== 'websocket') {
    return new Response('Требуется WebSocket подключение', { status: 400 });
  }

  // Получение информации о пользователе из URL
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');
  
  if (!userId) {
    return new Response('Отсутствует userId в параметрах', { status: 400 });
  }

  // Создаем WebSocket-соединение
  const { socket, response } = Deno.upgradeWebSocket(req);
  
  // Обработчик при открытии соединения
  socket.onopen = () => {
    console.log(`Соединение открыто для пользователя ${userId}`);
    connections.set(userId, { socket, userId, peerId: null });
    
    // Отправка списка активных пользователей
    const activeUsers = Array.from(connections.keys()).filter(id => id !== userId);
    socket.send(JSON.stringify({
      type: 'active_users',
      users: activeUsers
    }));
  };

  // Обработчик получения сообщения
  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log(`Получено сообщение от ${userId}:`, message);
      
      switch (message.type) {
        case 'call_offer':
          // Пользователь отправляет предложение вызова
          handleCallOffer(userId, message);
          break;
          
        case 'call_answer':
          // Пользователь отвечает на вызов
          handleCallAnswer(userId, message);
          break;
          
        case 'ice_candidate':
          // Обмен ICE кандидатами
          handleIceCandidate(userId, message);
          break;
          
        case 'end_call':
          // Завершение вызова
          handleEndCall(userId, message);
          break;
          
        default:
          console.log(`Неизвестный тип сообщения: ${message.type}`);
      }
    } catch (error) {
      console.error('Ошибка обработки сообщения:', error);
    }
  };

  // Обработчик закрытия соединения
  socket.onclose = () => {
    console.log(`Соединение закрыто для пользователя ${userId}`);
    
    // Если вызов был активен, уведомляем второго участника
    const connection = connections.get(userId);
    if (connection && connection.peerId) {
      const peerConnection = connections.get(connection.peerId);
      if (peerConnection) {
        peerConnection.socket.send(JSON.stringify({
          type: 'call_ended',
          message: 'Собеседник отключился'
        }));
        peerConnection.peerId = null;
      }
    }
    
    // Удаляем пользователя из списка активных соединений
    connections.delete(userId);
    
    // Оповещаем всех о том, что пользователь отключился
    for (const connection of connections.values()) {
      connection.socket.send(JSON.stringify({
        type: 'user_disconnected',
        userId
      }));
    }
  };

  // Обработка ошибок
  socket.onerror = (error) => {
    console.error(`Ошибка WebSocket для ${userId}:`, error);
  };

  // Обработчик предложения вызова
  function handleCallOffer(fromUserId: string, message: any) {
    const { targetUserId, offer } = message;
    console.log(`${fromUserId} вызывает ${targetUserId}`);
    
    const targetConnection = connections.get(targetUserId);
    if (targetConnection) {
      // Отправляем предложение вызова целевому пользователю
      targetConnection.socket.send(JSON.stringify({
        type: 'incoming_call',
        fromUserId,
        offer
      }));
      
      // Обновляем информацию о пирах
      const fromConnection = connections.get(fromUserId);
      if (fromConnection) {
        fromConnection.peerId = targetUserId;
      }
    } else {
      // Пользователь не в сети
      const fromConnection = connections.get(fromUserId);
      if (fromConnection) {
        fromConnection.socket.send(JSON.stringify({
          type: 'call_failed',
          message: 'Пользователь не в сети'
        }));
      }
    }
  }

  // Обработчик ответа на вызов
  function handleCallAnswer(fromUserId: string, message: any) {
    const { targetUserId, answer, accepted } = message;
    console.log(`${fromUserId} ${accepted ? 'принял' : 'отклонил'} вызов от ${targetUserId}`);
    
    const targetConnection = connections.get(targetUserId);
    if (targetConnection) {
      // Отправляем ответ инициатору вызова
      targetConnection.socket.send(JSON.stringify({
        type: 'call_answered',
        fromUserId,
        answer,
        accepted
      }));
      
      // Обновляем информацию о пирах, если вызов принят
      if (accepted) {
        const fromConnection = connections.get(fromUserId);
        if (fromConnection) {
          fromConnection.peerId = targetUserId;
        }
      }
    }
  }

  // Обработчик ICE кандидатов
  function handleIceCandidate(fromUserId: string, message: any) {
    const { targetUserId, candidate } = message;
    
    const targetConnection = connections.get(targetUserId);
    if (targetConnection) {
      // Пересылаем ICE кандидата
      targetConnection.socket.send(JSON.stringify({
        type: 'ice_candidate',
        fromUserId,
        candidate
      }));
    }
  }

  // Обработчик завершения вызова
  function handleEndCall(fromUserId: string, message: any) {
    const { targetUserId } = message;
    console.log(`${fromUserId} завершает вызов с ${targetUserId}`);
    
    const targetConnection = connections.get(targetUserId);
    if (targetConnection) {
      // Отправляем уведомление о завершении вызова
      targetConnection.socket.send(JSON.stringify({
        type: 'call_ended',
        fromUserId
      }));
      
      // Сбрасываем информацию о пирах
      targetConnection.peerId = null;
    }
    
    // Сбрасываем информацию о пирах для источника вызова
    const fromConnection = connections.get(fromUserId);
    if (fromConnection) {
      fromConnection.peerId = null;
    }
  }

  return response;
});
