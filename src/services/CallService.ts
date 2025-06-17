export interface CallState {
  isInCall: boolean;
  connectionState: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  incomingCall: { fromUserId: string } | null;
}

interface CallServiceOptions {
  onIncomingCall?: (fromUserId: string) => void;
  onCallAnswered?: () => void;
  onCallEnded?: () => void;
}

class CallService extends EventTarget {
  private ws: WebSocket | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private userId: string | null = null;
  private options: CallServiceOptions = {};
  private currentCallState: CallState = {
    isInCall: false,
    connectionState: 'disconnected',
    localStream: null,
    remoteStream: null,
    incomingCall: null
  };

  constructor(options: CallServiceOptions = {}) {
    super();
    this.options = options;
  }

  async connect(userId: string): Promise<void> {
    this.userId = userId;
    const wsUrl = `wss://zklavsvtcnrcozsgmchq.supabase.co/functions/v1/voice-call?userId=${userId}`;
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    return new Promise((resolve) => {
      this.ws!.onopen = () => {
        this.updateState({ connectionState: 'connected' });
        resolve();
      };
    });
  }

  private handleMessage(message: any) {
    switch (message.type) {
      case 'incoming_call':
        this.showIncomingCall(message.fromUserId, message.offer);
        break;
      case 'call_answered':
        if (message.accepted) {
          this.handleCallAccepted(message.answer);
        } else {
          this.handleCallRejected();
        }
        break;
      case 'ice_candidate':
        this.addIceCandidate(message.candidate);
        break;
    }
  }

  private showIncomingCall(fromUserId: string, offer: RTCSessionDescriptionInit) {
    this.updateState({ incomingCall: { fromUserId } });
    this.options.onIncomingCall?.(fromUserId);
    
    // Сохраняем offer для последующего принятия
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  }

  async startCall(targetUserId: string): Promise<void> {
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    this.setupPeerConnection(targetUserId);
    
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    
    this.ws?.send(JSON.stringify({
      type: 'call_offer',
      targetUserId,
      offer
    }));

    this.updateState({ isInCall: true, connectionState: 'connecting' });
  }

  async answerCall(): Promise<void> {
    if (!this.currentCallState.incomingCall) return;
    
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.peerConnection!.addTrack(this.localStream.getTracks()[0]);
    
    const answer = await this.peerConnection!.createAnswer();
    await this.peerConnection!.setLocalDescription(answer);
    
    this.ws?.send(JSON.stringify({
      type: 'call_answer',
      targetUserId: this.currentCallState.incomingCall.fromUserId,
      answer,
      accepted: true
    }));

    this.updateState({ 
      isInCall: true, 
      connectionState: 'connected',
      incomingCall: null 
    });
  }

  rejectCall(): void {
    if (!this.currentCallState.incomingCall) return;
    
    this.ws?.send(JSON.stringify({
      type: 'call_answer',
      targetUserId: this.currentCallState.incomingCall.fromUserId,
      accepted: false
    }));

    this.cleanup();
  }

  endCall(): void {
    this.cleanup();
  }

  private handleCallAccepted(answer: RTCSessionDescriptionInit) {
    this.peerConnection?.setRemoteDescription(new RTCSessionDescription(answer));
    this.updateState({ connectionState: 'connected' });
  }

  private handleCallRejected() {
    this.cleanup();
  }

  private addIceCandidate(candidate: RTCIceCandidateInit) {
    this.peerConnection?.addIceCandidate(new RTCIceCandidate(candidate));
  }

  private setupPeerConnection(targetUserId: string) {
    const pc = this.peerConnection!;
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.ws?.send(JSON.stringify({
          type: 'ice_candidate',
          targetUserId,
          candidate: event.candidate
        }));
      }
    };

    pc.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      this.updateState({ remoteStream: this.remoteStream });
    };

    pc.onconnectionstatechange = () => {
      this.updateState({ connectionState: pc.connectionState });
    };
  }

  private cleanup(): void {
    this.peerConnection?.close();
    this.localStream?.getTracks().forEach(track => track.stop());
    
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    
    this.updateState({
      isInCall: false,
      connectionState: 'disconnected',
      incomingCall: null,
      localStream: null,
      remoteStream: null
    });
  }

  private updateState(updates: Partial<CallState>): void {
    this.currentCallState = { ...this.currentCallState, ...updates };
    this.dispatchEvent(new CustomEvent('state_changed', { detail: this.currentCallState }));
  }

  getState(): CallState {
    return this.currentCallState;
  }
}

const callService = new CallService();
export const useCallService = () => callService;
export { CallService };
