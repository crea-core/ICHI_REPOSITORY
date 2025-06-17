// CallService.ts — версия с WebSocket (без Supabase)

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

    return new Promise((resolve, reject) => {
      const wsUrl = `ws://localhost:3001`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.ws!.send(JSON.stringify({ userId }));
        this.updateState({ connectionState: 'connected' });
        this.options.onConnectionStatusChange?.('connected');
        resolve();
      };

      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.fromUserId === this.userId) return; // игнорируем эхо

        switch (message.type) {
          case 'call_offer':
            this.options.onIncomingCall?.(message.fromUserId, message.offer);
            break;
          case 'call_answer':
            if (message.accepted) {
              this.handleCallAccepted(message.answer);
            } else {
              this.dispatchEvent(new CustomEvent('call_rejected', { detail: this.getState() }));
            }
            this.options.onCallAnswer?.(message.fromUserId, message.answer, message.accepted);
            break;
          case 'ice_candidate':
            if (this.peerConnection && message.candidate) {
              this.peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate)).catch(console.error);
            }
            break;
          case 'end_call':
            this.options.onCallEnded?.(message.fromUserId);
            this.dispatchEvent(new CustomEvent('call_ended', { detail: this.getState() }));
            this.cleanup();
            break;
        }
      };

      this.ws.onerror = (err) => {
        this.options.onConnectionStatusChange?.('error');
        reject(err);
      };

      this.ws.onclose = () => {
        this.updateState({ connectionState: 'disconnected' });
        this.options.onConnectionStatusChange?.('disconnected');
      };
    });
  }

  async startCall(targetUserId: string): Promise<void> {
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    this.peerConnection = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    this.localStream.getTracks().forEach(track => this.peerConnection!.addTrack(track, this.localStream!));

    this.peerConnection.ontrack = (e) => {
      this.remoteStream = e.streams[0];
      this.updateState({ remoteStream: this.remoteStream });
    };

    this.peerConnection.onicecandidate = (e) => {
      if (e.candidate) {
        this.send({
          type: 'ice_candidate',
          targetUserId,
          candidate: e.candidate
        });
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection!.connectionState;
      this.updateState({ connectionState: state });
      if (state === 'connected') {
        this.updateState({ isInCall: true });
        this.dispatchEvent(new CustomEvent('call_connected', { detail: this.getState() }));
      }
    };

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    this.send({ type: 'call_offer', targetUserId, offer });

    this.updateState({ isInCall: true, localStream: this.localStream, connectionState: 'connecting' });
    this.dispatchEvent(new CustomEvent('call_started', { detail: this.getState() }));
  }

  private async handleCallAccepted(answer: RTCSessionDescriptionInit) {
    if (this.peerConnection) {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      this.dispatchEvent(new CustomEvent('call_accepted', { detail: this.getState() }));
    }
  }

  async answerCall(fromUserId: string, offer: RTCSessionDescriptionInit, accepted: boolean): Promise<void> {
    if (!accepted) {
      this.send({ type: 'call_answer', targetUserId: fromUserId, accepted: false });
      return;
    }

    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    this.peerConnection = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    this.localStream.getTracks().forEach(track => this.peerConnection!.addTrack(track, this.localStream!));

    this.peerConnection.ontrack = (e) => {
      this.remoteStream = e.streams[0];
      this.updateState({ remoteStream: this.remoteStream });
    };

    this.peerConnection.onicecandidate = (e) => {
      if (e.candidate) {
        this.send({
          type: 'ice_candidate',
          targetUserId: fromUserId,
          candidate: e.candidate
        });
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection!.connectionState;
      this.updateState({ connectionState: state });
      if (state === 'connected') {
        this.updateState({ isInCall: true });
        this.dispatchEvent(new CustomEvent('call_connected', { detail: this.getState() }));
      }
    };

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    this.send({ type: 'call_answer', targetUserId: fromUserId, answer, accepted: true });

    this.updateState({ isInCall: true, localStream: this.localStream, connectionState: 'connecting' });
  }

  endCall(targetUserId?: string): void {
    if (targetUserId) {
      this.send({ type: 'end_call', targetUserId });
    }
    this.dispatchEvent(new CustomEvent('call_ended', { detail: this.getState() }));
    this.cleanup();
  }

  disconnect(): void {
    this.cleanup();
    this.ws?.close();
    this.ws = null;
    this.userId = null;
    this.updateState({ connectionState: 'disconnected' });
  }

  private cleanup() {
    this.localStream?.getTracks().forEach(track => track.stop());
    this.localStream = null;
    this.peerConnection?.close();
    this.peerConnection = null;
    this.remoteStream = null;
    this.updateState({
      isInCall: false,
      connectionState: 'disconnected',
      localStream: null,
      remoteStream: null
    });
  }

  private send(payload: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ ...payload, fromUserId: this.userId }));
    }
  }
}

const callService = new CallService();
export const useCallService = () => callService;
export { CallService };
