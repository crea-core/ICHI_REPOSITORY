export interface CallState {
  isInCall: boolean;
  connectionState: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

class CallService extends EventTarget {
  private ws: WebSocket | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private userId: string | null = null;
  private currentCallState: CallState = {
    isInCall: false,
    connectionState: 'disconnected',
    localStream: null,
    remoteStream: null
  };

  // Основные исправления:
  private async setupPeerConnection(targetUserId: string): Promise<RTCPeerConnection> {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
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

    return pc;
  }

  async startCall(targetUserId: string): Promise<void> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.peerConnection = await this.setupPeerConnection(targetUserId);
      
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      this.ws?.send(JSON.stringify({
        type: 'call_offer',
        targetUserId,
        offer
      }));

      this.updateState({ 
        isInCall: true,
        connectionState: 'connecting',
        localStream: this.localStream
      });
    } catch (error) {
      console.error('Call failed:', error);
      this.cleanup();
    }
  }

  private updateState(updates: Partial<CallState>) {
    this.currentCallState = { ...this.currentCallState, ...updates };
    this.dispatchEvent(new CustomEvent('state_changed'));
  }

  private cleanup() {
    this.peerConnection?.close();
    this.localStream?.getTracks().forEach(track => track.stop());
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.updateState({
      isInCall: false,
      connectionState: 'disconnected',
      localStream: null,
      remoteStream: null
    });
  }
}

const callService = new CallService();
export default callService;
