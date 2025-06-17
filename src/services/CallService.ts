import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://zklavsvtcnrcozsgmchq.supabase.co/functions/v1/voice-call', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprbGF2c3Z0Y25yY296c2dtY2hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc3MzU4ODQsImV4cCI6MjA2MzMxMTg4NH0.g_Sd37PapvRX98J8KCCoIEddQcwMJLN6vSBrEi4pzjM');

interface CallState {
  isInCall: boolean;
  isCallActive: boolean;
  isCallInitiator: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connectionState: RTCPeerConnectionState;
  callStatus: 'idle' | 'connecting' | 'ringing' | 'active' | 'ended';
}

class VoiceCallService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private signalingChannel: any = null;
  private currentCallId: string | null = null;
  private state: CallState = {
    isInCall: false,
    isCallActive: false,
    isCallInitiator: false,
    localStream: null,
    remoteStream: null,
    connectionState: 'disconnected',
    callStatus: 'idle'
  };
  private listeners: ((state: CallState) => void)[] = [];

  constructor(private currentUserId: string) {
    this.setupSignaling();
  }

  // Подписка на изменения состояния
  subscribe(callback: (state: CallState) => void): () => void {
    this.listeners.push(callback);
    callback(this.state);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private updateState(newState: Partial<CallState>): void {
    this.state = { ...this.state, ...newState };
    this.listeners.forEach(listener => listener(this.state));
  }

  // Инициализация сигнального канала
  private setupSignaling(): void {
    this.signalingChannel = supabase.channel('voice_calls');

    this.signalingChannel
      .on('broadcast', { event: 'call_offer' }, (payload: any) => {
        if (payload.targetUserId === this.currentUserId) {
          this.handleIncomingCall(payload.fromUserId, payload.offer);
        }
      })
      .on('broadcast', { event: 'call_answer' }, (payload: any) => {
        if (payload.targetUserId === this.currentUserId && payload.answer) {
          this.handleAnswer(payload.answer);
        }
      })
      .on('broadcast', { event: 'ice_candidate' }, (payload: any) => {
        if (payload.targetUserId === this.currentUserId && payload.candidate) {
          this.handleICECandidate(payload.candidate);
        }
      })
      .on('broadcast', { event: 'call_ended' }, (payload: any) => {
        if (payload.targetUserId === this.currentUserId) {
          this.handleCallEnded();
        }
      })
      .subscribe();
  }

  // Начало звонка
  async startCall(targetUserId: string): Promise<void> {
    try {
      this.updateState({
        isInCall: true,
        isCallInitiator: true,
        callStatus: 'ringing'
      });

      await this.setupLocalStream();
      this.setupPeerConnection(targetUserId);

      const offer = await this.peerConnection!.createOffer();
      await this.peerConnection!.setLocalDescription(offer);

      this.signalingChannel.send({
        type: 'broadcast',
        event: 'call_offer',
        payload: {
          targetUserId,
          fromUserId: this.currentUserId,
          offer
        }
      });

      this.updateState({ callStatus: 'connecting' });
    } catch (error) {
      console.error('Call failed:', error);
      this.cleanup();
      throw error;
    }
  }

  // Обработка входящего звонка
  private async handleIncomingCall(fromUserId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    if (this.state.isInCall) return;

    this.updateState({
      isInCall: true,
      isCallInitiator: false,
      callStatus: 'ringing'
    });

    try {
      await this.setupLocalStream();
      this.setupPeerConnection(fromUserId);

      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);
this.signalingChannel.send({
        type: 'broadcast',
        event: 'call_answer',
        payload: {
          targetUserId: fromUserId,
          fromUserId: this.currentUserId,
          answer,
          accepted: true
        }
      });

      this.updateState({ callStatus: 'connecting' });
    } catch (error) {
      console.error('Error answering call:', error);
      this.cleanup();
    }
  }

  // Обработка ответа на звонок
  private async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;

    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      this.updateState({ callStatus: 'active', isCallActive: true });
    } catch (error) {
      console.error('Error setting remote description:', error);
    }
  }

  // Обработка ICE кандидатов
  private async handleICECandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) return;

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  // Обработка завершения звонка
  private handleCallEnded(): void {
    this.updateState({ callStatus: 'ended' });
    this.cleanup();
  }

  // Завершение звонка
  endCall(targetUserId?: string): void {
    if (targetUserId) {
      this.signalingChannel.send({
        type: 'broadcast',
        event: 'call_ended',
        payload: {
          targetUserId,
          fromUserId: this.currentUserId
        }
      });
    }
    this.updateState({ callStatus: 'ended' });
    this.cleanup();
  }

  // Настройка локального аудиопотока
  private async setupLocalStream(): Promise<void> {
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.updateState({ localStream: this.localStream });
  }

  // Настройка PeerConnection
  private setupPeerConnection(targetUserId: string): void {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    });

    // Добавление локального потока
    this.localStream!.getTracks().forEach(track => {
      this.peerConnection!.addTrack(track, this.localStream!);
    });

    // Обработка удаленного потока
    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      this.updateState({ 
        remoteStream: this.remoteStream,
        isCallActive: true,
        callStatus: 'active'
      });
    };

    // Обработка ICE кандидатов
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signalingChannel.send({
          type: 'broadcast',
          event: 'ice_candidate',
          payload: {
            targetUserId,
            fromUserId: this.currentUserId,
            candidate: event.candidate
          }
        });
      }
    };

    // Обработка изменения состояния соединения
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      if (state) {
        this.updateState({ connectionState: state });
        
        if (state === 'connected') {
          this.updateState({ isCallActive: true, callStatus: 'active' });
        } else if (state === 'disconnected' || state === 'failed') {
          this.updateState({ callStatus: 'ended' });
          this.cleanup();
        }
      }
    };
  }

  // Очистка ресурсов
  private cleanup(): void {
    this.localStream?.getTracks().forEach(track => track.stop());
    this.localStream = null;

    this.peerConnection?.close();
    this.peerConnection = null;

    this.remoteStream = null;

    this.updateState({
      isInCall: false,
      isCallActive: false,
      localStream: null,
      remoteStream: null,
      connectionState: 'disconnected',
      callStatus: 'idle'
    });
  }
}
// Пример использования в UI компоненте
class VoiceCallUI {
  private callService: VoiceCallService;
  private unsubscribe: () => void;

  constructor(userId: string) {
    this.callService = new VoiceCallService(userId);
    this.unsubscribe = this.callService.subscribe(this.updateUI.bind(this));
    
    // Привязка UI элементов
    document.getElementById('startCallBtn')?.addEventListener('click', this.startCall.bind(this));
    document.getElementById('endCallBtn')?.addEventListener('click', this.endCall.bind(this));
  }

  private updateUI(state: CallState): void {
    // Обновление UI на основе состояния
    const callStatusElement = document.getElementById('callStatus');
    if (callStatusElement) {
      callStatusElement.textContent = state.callStatus;
    }

    const startCallBtn = document.getElementById('startCallBtn');
    if (startCallBtn) {
      startCallBtn.disabled = state.isInCall;
    }

    const endCallBtn = document.getElementById('endCallBtn');
    if (endCallBtn) {
      endCallBtn.disabled = !state.isInCall;
    }

    // Другие обновления UI...
  }

  private async startCall(): Promise<void> {
    const targetUserId = (document.getElementById('targetUserId') as HTMLInputElement).value;
    await this.callService.startCall(targetUserId);
  }

  private endCall(): void {
    const targetUserId = (document.getElementById('targetUserId') as HTMLInputElement).value;
    this.callService.endCall(targetUserId);
  }

  public destroy(): void {
    this.unsubscribe();
    this.callService.endCall();
  }
}
