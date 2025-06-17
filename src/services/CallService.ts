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
  private iceBuffer: RTCIceCandidateInit[] = [];
  private remoteDescriptionSet = false;

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

  private sendMessage(data: any) {
    if (this.ws && this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('Попытка отправить сообщение при отключенном WebSocket');
    }
  }

  async connect(userId: string): Promise<void> {
    this.userId = userId;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `wss://zklavsvtcnrcozsgmchq.supabase.co/functions/v1/voice-call?userId=${userId}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          clearInterval(this.reconnectInterval!);
          this.updateState({ connectionState: 'connected' });
          this.options.onConnectionStatusChange?.('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleWebSocketMessage(message);
          } catch (error) {
            console.error('Ошибка обработки сообщения WebSocket:', error);
          }
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          this.updateState({ connectionState: 'disconnected' });
          this.options.onConnectionStatusChange?.('disconnected');
          if (this.reconnectAttempts < this.maxReconnectAttempts) this.scheduleReconnect();
        };

        this.ws.onerror = (e) => {
          console.error('Ошибка WebSocket:', e);
          reject(new Error('Ошибка WebSocket'));
        };

        setTimeout(() => {
          if (!this.isConnected) reject(new Error('Таймаут WebSocket'));
        }, 10000);
      } catch (error) {
        reject(error);
      }
    });
  }

  private scheduleReconnect() {
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectInterval = setTimeout(() => {
      this.reconnectAttempts++;
      if (this.userId) this.connect(this.userId).catch(console.error);
    }, delay);
  }

  private handleWebSocketMessage(message: any) {
    switch (message.type) {
      case 'incoming_call':
        this.options.onIncomingCall?.(message.fromUserId, message.offer);
        document.dispatchEvent(new CustomEvent('incomingCall', { detail: message }));
        break;
      case 'call_answered':
        if (message.accepted && message.answer) {
          this.handleCallAccepted(message.answer);
        } else {
          this.dispatchEvent(new CustomEvent('call_rejected', { detail: this.getState() }));
        }
        this.options.onCallAnswer?.(message.fromUserId, message.answer, message.accepted);
        break;
      case 'call_ended':
        this.options.onCallEnded?.(message.fromUserId);
        this.dispatchEvent(new CustomEvent('call_ended', { detail: this.getState() }));
        this.cleanup();
        break;
      case 'ice_candidate':
        if (this.peerConnection) {
          const candidate = new RTCIceCandidate(message.candidate);
          if (this.remoteDescriptionSet) {
            this.peerConnection.addIceCandidate(candidate).catch(console.error);
          } else {
            this.iceBuffer.push(candidate);
          }
        }
        break;
      case 'call_failed':
        this.dispatchEvent(new CustomEvent('call_failed', { detail: message }));
        this.cleanup();
        break;
      default:
        console.log('Неизвестный тип сообщения:', message.type);
    }
  }

  async startCall(targetUserId: string): Promise<void> {
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    this.peerConnection = this.createPeerConnection(targetUserId);

    this.localStream.getTracks().forEach(track => {
      this.peerConnection!.addTrack(track, this.localStream!);
    });

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    this.sendMessage({ type: 'call_offer', targetUserId, offer });

    this.updateState({ isInCall: true, localStream: this.localStream, connectionState: 'connecting' });
    this.dispatchEvent(new CustomEvent('call_started', { detail: this.getState() }));
  }

  private async handleCallAccepted(answer: RTCSessionDescriptionInit) {
    if (this.peerConnection) {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      this.remoteDescriptionSet = true;
      this.iceBuffer.forEach(candidate => {
        this.peerConnection!.addIceCandidate(candidate).catch(console.error);
      });
      this.iceBuffer = [];
      this.dispatchEvent(new CustomEvent('call_accepted', { detail: this.getState() }));
    }
  }

  async answerCall(fromUserId: string, offer: RTCSessionDescriptionInit, accepted: boolean): Promise<void> {
    if (!accepted) {
      this.sendMessage({ type: 'call_answer', targetUserId: fromUserId, accepted: false });
      return;
    }

    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    this.peerConnection = this.createPeerConnection(fromUserId);

    this.localStream.getTracks().forEach(track => {
      this.peerConnection!.addTrack(track, this.localStream!);
    });

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    this.remoteDescriptionSet = true;

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    this.sendMessage({ type: 'call_answer', targetUserId: fromUserId, answer, accepted: true });

    this.updateState({ isInCall: true, localStream: this.localStream, connectionState: 'connecting' });
  }

  endCall(targetUserId?: string): void {
    if (targetUserId) {
      this.sendMessage({ type: 'end_call', targetUserId });
    }
    this.dispatchEvent(new CustomEvent('call_ended', { detail: this.getState() }));
    this.cleanup();
  }

  private createPeerConnection(targetUserId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      this.updateState({ remoteStream: this.remoteStream });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendMessage({ type: 'ice_candidate', targetUserId, candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      this.updateState({ connectionState: pc.connectionState });
      if (pc.connectionState === 'connected') {
        this.updateState({ isInCall: true });
        this.dispatchEvent(new CustomEvent('call_connected', { detail: this.getState() }));
      }
    };

    return pc;
  }

  private cleanup(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    this.remoteDescriptionSet = false;
    this.iceBuffer = [];

    this.updateState({ isInCall: false, connectionState: 'disconnected', localStream: null, remoteStream: null });
  }

  disconnect(): void {
    this.cleanup();
    if (this.reconnectInterval) clearInterval(this.reconnectInterval);
    if (this.ws) this.ws.close();
    this.ws = null;
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
    return ['connecting', 'connected', 'closing', 'disconnected'][this.ws.readyState] || 'unknown';
  }
}

const callService = new CallService();
export const useCallService = () => callService;
export { CallService };
