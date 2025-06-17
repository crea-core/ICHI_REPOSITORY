import { supabase } from "@/integrations/supabase/client";

// Интерфейс для отслеживания состояния звонка
export interface CallState {
  isInCall: boolean;
  isCaller: boolean;
  remoteUserId: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connectionState: RTCPeerConnectionState | 'disconnected';
}

// Типы событий для звонка
export type CallEventType =
  | 'call_started'
  | 'call_ended'
  | 'call_accepted'
  | 'call_rejected'
  | 'connection_state_changed';

export type CallEventHandler = (state: CallState) => void;

// Класс сервиса для звонков
export class CallService {
  private static instance: CallService;
  private socket: WebSocket | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private userId: string | null = null;
  private remoteUserId: string | null = null;
  private isCaller: boolean = false;
  private eventListeners: Map<CallEventType, CallEventHandler[]> = new Map();

  // Текущее состояние звонка
  private state: CallState = {
    isInCall: false,
    isCaller: false,
    remoteUserId: null,
    localStream: null,
    remoteStream: null,
    connectionState: 'disconnected',
  };

  private constructor() {}

  // Получение единственного экземпляра класса
  public static getInstance(): CallService {
    if (!CallService.instance) {
      CallService.instance = new CallService();
    }
    return CallService.instance;
  }

  // Подключение к сервису звонков
  public async connect(userId: string): Promise<void> {
    if (this.socket) {
      this.disconnect();
    }

    this.userId = userId;

    try {
      // Используем правильный URL для WebSocket соединения с Supabase edge функцией
      const wsUrl = `wss://zklavsvtcnrcozsgmchq.functions.supabase.co/voice-call?userId=${userId}`;
      console.log('Подключение к WebSocket:', wsUrl);
      
      this.socket = new WebSocket(wsUrl);
      
      this.socket.addEventListener('open', this.handleSocketOpen);
      this.socket.addEventListener('message', this.handleSocketMessage);
      this.socket.addEventListener('close', this.handleSocketClose);
      this.socket.addEventListener('error', this.handleSocketError);
      
      console.log('Подключение к сервису звонков...');
    } catch (error) {
      console.error('Ошибка подключения к сервису звонков:', error);
      throw error;
    }
  }

  // Отключение от сервиса звонков
  public disconnect(): void {
    this.endCall();
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.userId = null;
  }

  // Инициирование звонка
  public async startCall(targetUserId: string): Promise<void> {
    if (!this.socket || !this.userId) {
      throw new Error('Нет соединения с сервисом звонков');
    }
    
    if (this.state.isInCall) {
      throw new Error('Уже есть активный звонок');
    }
    
    try {
      // Получаем доступ к медиаустройствам
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });
      
      // Создаем RTCPeerConnection
      this.createPeerConnection();
      
      // Добавляем локальные треки
      if (this.peerConnection && this.localStream) {
        this.localStream.getTracks().forEach(track => {
          if (this.peerConnection && this.localStream) {
            this.peerConnection.addTrack(track, this.localStream);
          }
        });
      }
      
      // Создаем предложение
      const offer = await this.peerConnection!.createOffer();
      await this.peerConnection!.setLocalDescription(offer);
      
      // Отправляем предложение целевому пользователю
      this.socket.send(JSON.stringify({
        type: 'call_offer',
        targetUserId,
        offer
      }));
      
      // Обновляем состояние
      this.isCaller = true;
      this.remoteUserId = targetUserId;
      this.updateState({
        isInCall: true,
        isCaller: true,
        remoteUserId: targetUserId,
        localStream: this.localStream,
        connectionState: this.peerConnection!.connectionState
      });
      
      this.notifyEvent('call_started', this.state);
      
      console.log(`Звоним пользователю ${targetUserId}`);
    } catch (error) {
      this.cleanupCall();
      console.error('Ошибка при начале звонка:', error);
      throw error;
    }
  }

  // Ответ на входящий звонок
  public async answerCall(fromUserId: string, offer: RTCSessionDescriptionInit, accept: boolean): Promise<void> {
    if (!this.socket || !this.userId) {
      throw new Error('Нет соединения с сервисом звонков');
    }
    
    if (accept) {
      try {
        // Получаем доступ к медиаустройствам
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false
        });
        
        // Создаем RTCPeerConnection
        this.createPeerConnection();
        
        // Добавляем локальные треки
        if (this.peerConnection && this.localStream) {
          this.localStream.getTracks().forEach(track => {
            if (this.peerConnection && this.localStream) {
              this.peerConnection.addTrack(track, this.localStream);
            }
          });
        }
        
        // Устанавливаем удаленное описание
        await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(offer));
        
        // Создаем ответ
        const answer = await this.peerConnection!.createAnswer();
        await this.peerConnection!.setLocalDescription(answer);
        
        // Отправляем ответ
        this.socket.send(JSON.stringify({
          type: 'call_answer',
          targetUserId: fromUserId,
          answer,
          accepted: true
        }));
        
        // Обновляем состояние
        this.isCaller = false;
        this.remoteUserId = fromUserId;
        this.updateState({
          isInCall: true,
          isCaller: false,
          remoteUserId: fromUserId,
          localStream: this.localStream,
          connectionState: this.peerConnection!.connectionState
        });
        
        this.notifyEvent('call_accepted', this.state);
        
        console.log(`Принят звонок от пользователя ${fromUserId}`);
      } catch (error) {
        this.cleanupCall();
        console.error('Ошибка при ответе на звонок:', error);
        throw error;
      }
    } else {
      // Отклоняем звонок
      this.socket.send(JSON.stringify({
        type: 'call_answer',
        targetUserId: fromUserId,
        accepted: false
      }));
      
      this.notifyEvent('call_rejected', this.state);
      console.log(`Отклонен звонок от пользователя ${fromUserId}`);
    }
  }

  // Завершение звонка
  public endCall(): void {
    if (this.state.isInCall && this.socket && this.remoteUserId) {
      // Отправляем уведомление о завершении звонка
      this.socket.send(JSON.stringify({
        type: 'end_call',
        targetUserId: this.remoteUserId
      }));
    }
    
    this.cleanupCall();
  }

  // Очистка ресурсов звонка
  private cleanupCall(): void {
    // Освобождаем медиа-треки
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    // Закрываем соединение
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    const wasInCall = this.state.isInCall;
    
    // Сбрасываем состояние
    this.remoteStream = null;
    this.remoteUserId = null;
    this.isCaller = false;
    this.updateState({
      isInCall: false,
      isCaller: false,
      remoteUserId: null,
      localStream: null,
      remoteStream: null,
      connectionState: 'disconnected'
    });
    
    if (wasInCall) {
      this.notifyEvent('call_ended', this.state);
    }
  }

  // Создание WebRTC соединения
  private createPeerConnection(): void {
    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
    
    this.peerConnection = new RTCPeerConnection(configuration);
    
    // Отслеживание ICE кандидатов
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.socket && this.remoteUserId) {
        this.socket.send(JSON.stringify({
          type: 'ice_candidate',
          targetUserId: this.remoteUserId,
          candidate: event.candidate
        }));
      }
    };
    
    // Отслеживание изменения состояния соединения
    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection) {
        console.log('Connection state:', this.peerConnection.connectionState);
        this.updateState({
          connectionState: this.peerConnection.connectionState
        });
        this.notifyEvent('connection_state_changed', this.state);
      }
    };
    
    // Отслеживание удаленных треков
    this.peerConnection.ontrack = (event) => {
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
        this.updateState({
          remoteStream: this.remoteStream
        });
      }
      
      event.streams[0].getTracks().forEach(track => {
        if (this.remoteStream) {
          this.remoteStream.addTrack(track);
        }
      });
    };
  }
  
  // Обновление состояния
  private updateState(newState: Partial<CallState>): void {
    this.state = { ...this.state, ...newState };
  }

  // Обработчики WebSocket событий
  private handleSocketOpen = () => {
    console.log('Соединение с сервисом звонков установлено');
  };

  private handleSocketMessage = (event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);
      console.log('Получено сообщение от сервера:', message);
      
      switch (message.type) {
        case 'incoming_call':
          this.handleIncomingCall(message);
          break;
          
        case 'call_answered':
          this.handleCallAnswered(message);
          break;
          
        case 'ice_candidate':
          this.handleIceCandidate(message);
          break;
          
        case 'call_ended':
          this.handleCallEnded(message);
          break;
          
        case 'call_failed':
          this.handleCallFailed(message);
          break;
      }
    } catch (error) {
      console.error('Ошибка обработки сообщения:', error);
    }
  };

  private handleSocketClose = () => {
    console.log('Соединение с сервисом звонков закрыто');
    this.cleanupCall();
  };

  private handleSocketError = (error: Event) => {
    console.error('Ошибка WebSocket соединения:', error);
  };

  // Обработчик входящего звонка
  private handleIncomingCall(message: any) {
    const { fromUserId, offer } = message;
    
    // Вызываем соответствующие обработчики
    document.dispatchEvent(new CustomEvent('incomingCall', {
      detail: { fromUserId, offer }
    }));
  }

  // Обработчик ответа на звонок
  private handleCallAnswered(message: any) {
    const { fromUserId, answer, accepted } = message;
    
    if (accepted && this.peerConnection) {
      // Устанавливаем удаленное описание для установления соединения
      this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
        .catch(error => console.error('Ошибка установки удаленного описания:', error));
      
      console.log(`Пользователь ${fromUserId} принял звонок`);
      this.notifyEvent('call_accepted', this.state);
    } else {
      console.log(`Пользователь ${fromUserId} отклонил звонок`);
      this.cleanupCall();
      this.notifyEvent('call_rejected', this.state);
    }
  }

  // Обработчик ICE кандидатов
  private handleIceCandidate(message: any) {
    const { candidate } = message;
    
    if (candidate && this.peerConnection) {
      this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
        .catch(error => console.error('Ошибка добавления ICE кандидата:', error));
    }
  }

  // Обработчик завершения звонка
  private handleCallEnded(message: any) {
    console.log('Звонок завершен:', message);
    this.cleanupCall();
  }

  // Обработчик ошибки звонка
  private handleCallFailed(message: any) {
    console.log('Ошибка звонка:', message.message);
    this.cleanupCall();
    // Здесь можно добавить отображение сообщения пользователю
  }

  // Методы для подписки на события
  public addEventListener(eventType: CallEventType, handler: CallEventHandler): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    
    const listeners = this.eventListeners.get(eventType)!;
    if (!listeners.includes(handler)) {
      listeners.push(handler);
    }
  }

  public removeEventListener(eventType: CallEventType, handler: CallEventHandler): void {
    if (this.eventListeners.has(eventType)) {
      const listeners = this.eventListeners.get(eventType)!;
      const index = listeners.indexOf(handler);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private notifyEvent(eventType: CallEventType, state: CallState): void {
    if (this.eventListeners.has(eventType)) {
      const listeners = this.eventListeners.get(eventType)!;
      listeners.forEach(handler => handler(state));
    }
  }

  // Getter для состояния
  public getState(): CallState {
    return { ...this.state };
  }
}

// Создаем и экспортируем экземпляр сервиса
export const callService = CallService.getInstance();

// Хук для использования сервиса звонков
export function useCallService() {
  return callService;
}
