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
    return this.currentCallState;
  }

  private updateState(updates: Partial<CallState>) {
    this.currentCallState = { ...this.currentCallState, ...updates };
    this.dispatchEvent(new CustomEvent('state_changed', { detail: this.getState() }));
  }

  private sendMessage(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  async connect(userId: string): Promise<void> {
    this.userId = userId;
    if (this.ws) return;

    return new Promise((resolve, reject) => {
      const wsUrl = `wss://zklavsvtcnrcozsgmchq.supabase.co/functions/v1/voice-call?userId=${userId}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.updateState({ connectionState: 'connected' });
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

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      this.ws.onclose = () => {
        this.updateState({ connectionState: 'disconnected' });
      };
    });
  }

  private handleMessage(message: any) {
    switch (message.type) {
      case 'incoming_call':
        this.handleIncomingCall(message.fromUserId, message.offer);
        break;
      case 'call_answered':
        this.handleAnswer(message.fromUserId, message.answer, message.accepted);
        break;
      case 'ice_candidate':
        this.handleIceCandidate(message.candidate);
        break;
    }
  }

  private async handleIncomingCall(fromUserId: string, offer: RTCSessionDescriptionInit) {
    this.options.onIncomingCall?.(fromUserId, offer);
  }

  private async handleAnswer(fromUserId: string, answer: RTCSessionDescriptionInit, accepted: boolean) {
    if (accepted && answer && this.peerConnection) {
      await this.peerConnection.setRemoteDescription(answer);
      this.updateState({ connectionState: 'connected' });
    }
  }

  private async handleIceCandidate(candidate: RTCIceCandidateInit) {
    if (this.peerConnection) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    }
  }

  async startCall(targetUserId: string): Promise<void> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.updateState({ localStream: this.localStream });

      this.peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendMessage({
            type: 'ice_candidate',
            targetUserId,
            candidate: event.candidate
          });
        }
      };

      this.peerConnection.ontrack = (event) => {
        this.remoteStream = event.streams[0];
        this.updateState({ remoteStream: this.remoteStream });
      };

      this.localStream.getTracks().forEach(track => {
        this.peerConnection?.addTrack(track, this.localStream!);
      });

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      this.sendMessage({
        type: 'call_offer',
        targetUserId,
        offer
      });

      this.updateState({ isInCall: true, connectionState: 'connecting' });

    } catch (error) {
      console.error('Call start failed:', error);
      this.cleanup();
      throw error;
    }
  }

  async answerCall(fromUserId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.updateState({ localStream: this.localStream });

      this.peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendMessage({
            type: 'ice_candidate',
            targetUserId: fromUserId,
            candidate: event.candidate
          });
        }
      };

      this.peerConnection.ontrack = (event) => {
        this.remoteStream = event.streams[0];
        this.updateState({ remoteStream: this.remoteStream });
      };

      this.localStream.getTracks().forEach(track => {
        this.peerConnection?.addTrack(track, this.localStream!);
      });

      await this.peerConnection.setRemoteDescription(offer);
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      this.sendMessage({
        type: 'call_answer',
        targetUserId: fromUserId,
        answer,
        accepted: true
      });

      this.updateState({ isInCall: true, connectionState: 'connected' });

    } catch (error) {
      console.error('Call answer failed:', error);
      this.cleanup();
      throw error;
    }
  }

  endCall(targetUserId?: string): void {
    if (targetUserId) {
      this.sendMessage({ type: 'end_call', targetUserId });
    }
    this.cleanup();
  }

  private cleanup(): void {
    this.localStream?.getTracks().forEach(track => track.stop());
    this.peerConnection?.close();
    
    this.localStream = null;
    this.remoteStream = null;
    this.peerConnection = null;

    this.updateState({
      isInCall: false,
      connectionState: 'disconnected',
      localStream: null,
      remoteStream: null
    });
  }

  disconnect(): void {
    this.cleanup();
    this.ws?.close();
    this.ws = null;
    this.userId = null;
    this.isConnected = false;
  }
}

const callService = new CallService();
export const useCallService = () => callService;
export { CallService };
