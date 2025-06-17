
export interface CallState {
  isInCall: boolean;
  connectionState: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

interface CallServiceOptions {
  onIncomingCall?: (fromUserId: string, offer: RTCSessionDescriptionInit) => void;
  onCallAnswer?: (fromUserId: string, answer: RTCSessionDescriptionInit, accepted: boolean) => void;
  onCallEnded?: (fromUserId: string) => void;
  onConnectionStatusChange?: (status: string) => void;
}

class CallService extends EventTarget {
  private ws: WebSocket | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private userId: string | null = null;
  private options: CallServiceOptions = {};
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private currentCallState: CallState = {
    isInCall: false,
    connectionState: 'disconnected',
    localStream: null,
    remoteStream: null
  };

  constructor(options: CallServiceOptions = {}) {
    super();
    this.options = options;
  }

  getState(): CallState {
    return {
      ...this.currentCallState,
      localStream: this.localStream,
      remoteStream: this.remoteStream
    };
  }

  private updateState(updates: Partial<CallState>) {
    this.currentCallState = { ...this.currentCallState, ...updates };
    this.dispatchEvent(new CustomEvent('connection_state_changed', { detail: this.getState() }));
  }

  async connect(userId: string): Promise<void> {
    this.userId = userId;
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket уже подключен');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        // Исправленный URL с правильным доменом
        const wsUrl = `wss://zklavsvtcnrcozsgmchq.supabase.co/functions/v1/voice-call?userId=${userId}`;
        console.log('Подключение к WebSocket:', wsUrl);
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
          console.log('WebSocket подключен успешно');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
          }
          this.updateState({ connectionState: 'connected' });
          this.options.onConnectionStatusChange?.('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('Получено сообщение WebSocket:', message);
            this.handleWebSocketMessage(message);
          } catch (error) {
            console.error('Ошибка разбора сообщения WebSocket:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket соединение закрыто:', event.code, event.reason);
          this.isConnected = false;
          this.updateState({ connectionState: 'disconnected' });
          this.options.onConnectionStatusChange?.('disconnected');
          
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('Ошибка WebSocket:', error);
          this.options.onConnectionStatusChange?.('error');
          reject(new Error('Ошибка подключения WebSocket'));
        };

        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('Превышено время ожидания подключения'));
          }
        }, 10000);

      } catch (error) {
        console.error('Ошибка создания WebSocket:', error);
        reject(error);
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(`Попытка переподключения ${this.reconnectAttempts + 1} через ${delay}ms`);
    
    this.reconnectInterval = setTimeout(() => {
      this.reconnectAttempts++;
      if (this.userId) {
        this.connect(this.userId).catch(error => {
          console.error('Ошибка переподключения:', error);
        });
      }
    }, delay);
  }

  private handleWebSocketMessage(message: any): void {
    switch (message.type) {
      case 'incoming_call':
        console.log('Входящий звонок от:', message.fromUserId);
        this.options.onIncomingCall?.(message.fromUserId, message.offer);
        
        // Отправляем событие для уведомления
        document.dispatchEvent(new CustomEvent('incomingCall', {
          detail: {
            fromUserId: message.fromUserId,
            offer: message.offer
          }
        }));
        break;

      case 'call_answered':
        console.log('Звонок отвечен:', message.accepted);
        if (message.accepted && message.answer) {
          this.handleCallAccepted(message.answer);
        } else {
          this.dispatchEvent(new CustomEvent('call_rejected', { detail: this.getState() }));
        }
        this.options.onCallAnswer?.(message.fromUserId, message.answer, message.accepted);
        break;

      case 'call_ended':
        console.log('Звонок завершен:', message.fromUserId);
        this.options.onCallEnded?.(message.fromUserId);
        this.dispatchEvent(new CustomEvent('call_ended', { detail: this.getState() }));
        this.cleanup();
        break;

      case 'ice_candidate':
        console.log('Получен ICE кандидат');
        if (this.peerConnection && message.candidate) {
          this.peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate))
            .catch(error => console.error('Ошибка добавления ICE кандидата:', error));
        }
        break;

      case 'call_failed':
        console.log('Звонок не удался:', message.message);
        this.dispatchEvent(new CustomEvent('call_failed', { detail: { message: message.message } }));
        this.cleanup();
        break;

      default:
        console.log('Неизвестный тип сообщения:', message.type);
    }
  }

  async startCall(targetUserId: string): Promise<void> {
    console.log('Начинаем звонок к:', targetUserId);
    
    if (!this.ws || !this.isConnected) {
      throw new Error('WebSocket не подключен');
    }

    try {
      // Получаем доступ к микрофону
      console.log('Запрашиваем доступ к микрофону...');
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      console.log('Доступ к микрофону получен');

      // Создаем peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      // Добавляем локальный поток
      this.localStream.getTracks().forEach(track => {
        console.log('Добавляем трек:', track.kind);
        this.peerConnection!.addTrack(track, this.localStream!);
      });

      // Обработчики событий
      this.peerConnection.ontrack = (event) => {
        console.log('Получен удаленный поток');
        this.remoteStream = event.streams[0];
        this.updateState({ remoteStream: this.remoteStream });
      };

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate && this.ws && this.isConnected) {
          console.log('Отправляем ICE кандидата');
          this.ws.send(JSON.stringify({
            type: 'ice_candidate',
            targetUserId,
            candidate: event.candidate
          }));
        }
      };

      this.peerConnection.onconnectionstatechange = () => {
        if (this.peerConnection) {
          console.log('Состояние соединения:', this.peerConnection.connectionState);
          this.updateState({ connectionState: this.peerConnection.connectionState });
          
          if (this.peerConnection.connectionState === 'connected') {
            this.updateState({ isInCall: true });
            this.dispatchEvent(new CustomEvent('call_connected', { detail: this.getState() }));
          }
        }
      };

      // Создаем offer
      console.log('Создаем offer...');
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });
      
      await this.peerConnection.setLocalDescription(offer);
      console.log('Local description установлен');

      // Отправляем offer
      console.log('Отправляем offer...');
      this.ws.send(JSON.stringify({
        type: 'call_offer',
        targetUserId,
        offer
      }));

      this.updateState({ 
        isInCall: true, 
        localStream: this.localStream,
        connectionState: 'connecting'
      });
      
      this.dispatchEvent(new CustomEvent('call_started', { detail: this.getState() }));
      console.log('Звонок инициирован успешно');

    } catch (error) {
      console.error('Ошибка инициации звонка:', error);
      this.cleanup();
      throw error;
    }
  }

  private async handleCallAccepted(answer: RTCSessionDescriptionInit): Promise<void> {
    if (this.peerConnection) {
      try {
        console.log('Обрабатываем ответ на звонок');
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log('Remote description установлен');
        this.dispatchEvent(new CustomEvent('call_accepted', { detail: this.getState() }));
      } catch (error) {
        console.error('Ошибка установки remote description:', error);
        this.dispatchEvent(new CustomEvent('call_failed', { detail: { message: 'Ошибка соединения' } }));
      }
    }
  }

  async answerCall(fromUserId: string, offer: RTCSessionDescriptionInit, accepted: boolean): Promise<void> {
    console.log('Отвечаем на звонок:', accepted ? 'принимаем' : 'отклоняем');
    
    if (!this.ws || !this.isConnected) {
      throw new Error('WebSocket не подключен');
    }

    if (!accepted) {
      this.ws.send(JSON.stringify({
        type: 'call_answer',
        targetUserId: fromUserId,
        accepted: false
      }));
      return;
    }

    try {
      // Получаем доступ к микрофону
      console.log('Запрашиваем доступ к микрофону для ответа...');
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Создаем peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      // Добавляем локальный поток
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });

      // Обработчики событий
      this.peerConnection.ontrack = (event) => {
        console.log('Получен удаленный поток при ответе');
        this.remoteStream = event.streams[0];
        this.updateState({ remoteStream: this.remoteStream });
      };

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate && this.ws && this.isConnected) {
          this.ws.send(JSON.stringify({
            type: 'ice_candidate',
            targetUserId: fromUserId,
            candidate: event.candidate
          }));
        }
      };

      this.peerConnection.onconnectionstatechange = () => {
        if (this.peerConnection) {
          console.log('Состояние соединения при ответе:', this.peerConnection.connectionState);
          this.updateState({ connectionState: this.peerConnection.connectionState });
          
          if (this.peerConnection.connectionState === 'connected') {
            this.updateState({ isInCall: true });
            this.dispatchEvent(new CustomEvent('call_connected', { detail: this.getState() }));
          }
        }
      };

      // Устанавливаем remote description
      console.log('Устанавливаем remote description с offer');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      
      // Создаем answer
      console.log('Создаем answer');
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      // Отправляем answer
      console.log('Отправляем answer');
      this.ws.send(JSON.stringify({
        type: 'call_answer',
        targetUserId: fromUserId,
        answer,
        accepted: true
      }));

      this.updateState({ 
        isInCall: true, 
        localStream: this.localStream,
        connectionState: 'connecting'
      });

      console.log('Ответ на звонок обработан успешно');

    } catch (error) {
      console.error('Ошибка ответа на звонок:', error);
      this.cleanup();
      throw error;
    }
  }

  endCall(targetUserId?: string): void {
    console.log('Завершаем звонок');
    
    if (this.ws && this.isConnected && targetUserId) {
      this.ws.send(JSON.stringify({
        type: 'end_call',
        targetUserId
      }));
    }
    
    this.dispatchEvent(new CustomEvent('call_ended', { detail: this.getState() }));
    this.cleanup();
  }

  private cleanup(): void {
    console.log('Очистка ресурсов звонка');
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log('Остановлен трек:', track.kind);
      });
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    this.updateState({
      isInCall: false,
      connectionState: 'disconnected',
      localStream: null,
      remoteStream: null
    });
  }

  disconnect(): void {
    console.log('Отключение от сервиса звонков');
    this.cleanup();
    
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
    this.userId = null;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  isCallActive(): boolean {
    return this.peerConnection !== null && this.currentCallState.isInCall;
  }

  getConnectionStatus(): string {
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'disconnected';
      default: return 'unknown';
    }
  }
}

const callService = new CallService();

export const useCallService = () => callService;
export { CallService };
