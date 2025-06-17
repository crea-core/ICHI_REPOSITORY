import { EventEmitter } from 'eventemitter3';

export interface CallState {
  isInCall: boolean;
  connectionState: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

class CallService extends EventEmitter {
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private userId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  getState(): CallState {
    return {
      isInCall: this.pc !== null,
      connectionState: this.pc?.connectionState || 'disconnected',
      localStream: this.localStream,
      remoteStream: this.remoteStream
    };
  }

  async connect(userId: string): Promise<void> {
    this.userId = userId;
    return this.setupWebSocket();
  }

  private async setupWebSocket(): Promise<void> {
    if (this.ws) this.ws.close();

    return new Promise((resolve, reject) => {
      const wsUrl = `wss://zklavsvtcnrcozsgmchq.supabase.co/voice-call?userId=${this.userId}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.emit('connected');
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Message parse error:', error);
        }
      };

      this.ws.onclose = () => {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(() => {
            this.reconnectAttempts++;
            this.setupWebSocket().catch(console.error);
          }, 1000 * Math.pow(2, this.reconnectAttempts));
        }
      };

      this.ws.onerror = (error) => {
        reject(error);
      };
    });
  }

  private async handleMessage(message: any) {
    switch (message.type) {
      case 'incoming_call':
        this.emit('incoming_call', {
          fromUserId: message.fromUserId,
          offer: message.offer
        });
        break;

      case 'call_accepted':
        if (message.accepted && this.pc) {
          await this.pc.setRemoteDescription(message.answer);
          this.emit('call_accepted');
        } else {
          this.cleanup();
          this.emit('call_rejected');
        }
        break;

      case 'ice_candidate':
        if (this.pc) {
          await this.pc.addIceCandidate(new RTCIceCandidate(message.candidate));
        }
        break;

      case 'call_ended':
        case 'call_failed':
        this.cleanup();
        this.emit(message.type);
        break;
    }
  }

  async startCall(targetUserId: string): Promise<void> {
    this.cleanup();
    
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.setupPeerConnection();

      const pc = this.pc!;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      this.ws?.send(JSON.stringify({
        type: 'call_offer',
        targetUserId,
        offer
      }));

      this.emit('call_started');
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  async answerCall(fromUserId: string, offer: RTCSessionDescriptionInit, accept: boolean): Promise<void> {
    if (!accept) {
      this.ws?.send(JSON.stringify({
        type: 'call_answer',
        targetUserId: fromUserId,
        accepted: false
      }));
      return;
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.setupPeerConnection();

      const pc = this.pc!;
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.ws?.send(JSON.stringify({
        type: 'call_answer',
        targetUserId: fromUserId,
        answer,
        accepted: true
      }));

      this.emit('call_accepted');
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  private setupPeerConnection() {
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    const pc = this.pc;
    pc.onicecandidate = (event) => {
      if (event.candidate && this.userId) {
        this.ws?.send(JSON.stringify({
          type: 'ice_candidate',
          targetUserId: this.userId,
          candidate: event.candidate
        }));
      }
    };

    pc.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      this.emit('stream_changed');
    };

    pc.onconnectionstatechange = () => {
      this.emit('state_changed', this.getState());
    };

    this.localStream?.getTracks().forEach(track => {
      pc.addTrack(track, this.localStream!);
    });
  }

  endCall(targetUserId?: string): void {
    if (targetUserId) {
      this.ws?.send(JSON.stringify({
        type: 'end_call',
        targetUserId
      }));
    }
    this.cleanup();
    this.emit('call_ended');
  }

  private cleanup(): void {
    this.pc?.close();
    this.pc = null;
    this.localStream?.getTracks().forEach(track => track.stop());
    this.localStream = null;
    this.remoteStream = null;
  }

  disconnect(): void {
    this.cleanup();
    this.ws?.close();
    this.ws = null;
  }
}

export const callService = new CallService();
