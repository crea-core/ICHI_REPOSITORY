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

  private iceBuffer: RTCIceCandidateInit[] = [];
  private remoteDescriptionSet = false;

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
    this.currentCallState = {
