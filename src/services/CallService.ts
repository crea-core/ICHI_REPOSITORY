import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

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
  private userId: string | null = null;
  private signalingChannel: RealtimeChannel | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;

  private currentCallState: CallState = {
    isInCall: false,
    connectionState: 'disconnected',
    localStream: null,
    remoteStream: null
  };

  constructor(private options: CallServiceOptions = {}) {
    super();
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

    this.signalingChannel = supabase.channel('calls');

    this.signalingChannel
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        if (payload.targetUserId !== this.userId) return;

        const { type, fromUserId } = payload;

        if (type === 'call_offer') {
          this.options.onIncomingCall?.(fromUserId, payload.offer);
        } else if (type === 'call_answer') {
          if (payload.accepted) {
            this.handleCallAccepted(payload.answer);
          } else {
            this.dispatchEvent(new CustomEvent('call_rejected', { detail: this.getState() }));
          }
          this.options.onCallAnswer?.(fromUserId, payload.answer, payload.accepted);
        } else if (type === 'ice_candidate') {
          if (this.peerConnection && payload.candidate) {
            this.peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(console.error);
          }
        } else if (type === 'call_ended') {
          this.dispatchEvent(new CustomEvent('call_ended', { detail: this.getState() }));
          this.cleanup();
        }
      })
      .subscribe();

    this.updateState({ connectionState: 'connected' });
    this.options.onConnectionStatusChange?.('connected');
  }

  async startCall(targetUserId: string): Promise<void> {
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.peerConnection = this.createPeerConnection(targetUserId);

    this.localStream.getTracks().forEach(track => {
      this.peerConnection!.addTrack(track, this.localStream!);
    });

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    await this.sendSignal('call_offer', {
      targetUserId,
      offer
    });

    this.updateState({
      isInCall: true,
      localStream: this.localStream,
      connectionState: 'connecting'
    });
    this.dispatchEvent(new CustomEvent('call_started', { detail: this.getState() }));
  }

  async answerCall(fromUserId: string, offer: RTCSessionDescriptionInit, accepted: boolean): Promise<void> {
    if (!accepted) {
      await this.sendSignal('call_answer', {
        targetUserId: fromUserId,
        accepted: false
      });
      return;
    }

    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.peerConnection = this.createPeerConnection(fromUserId);

    this.localStream.getTracks().forEach(track => {
      this.peerConnection!.addTrack(track, this.localStream!);
    });

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    await this.sendSignal('call_answer', {
      targetUserId: fromUserId,
      answer,
      accepted: true
    });

    this.updateState({
      isInCall: true,
      localStream: this.localStream,
      connectionState: 'connecting'
    });
  }

  endCall(targetUserId?: string): void {
    if (targetUserId) {
      this.sendSignal('call_ended', { targetUserId });
    }
    this.dispatchEvent(new CustomEvent('call_ended', { detail: this.getState() }));
    this.cleanup();
  }

  disconnect(): void {
    this.cleanup();
    if (this.signalingChannel) {
      this.signalingChannel.unsubscribe();
      this.signalingChannel = null;
    }
    this.userId = null;
    this.updateState({ connectionState: 'disconnected' });
  }

  private cleanup(): void {
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

  private createPeerConnection(targetUserId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.ontrack = (e) => {
      this.remoteStream = e.streams[0];
      this.updateState({ remoteStream: this.remoteStream });
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.sendSignal('ice_candidate', {
          targetUserId,
          candidate: e.candidate
        });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      this.updateState({ connectionState: state });
      if (state === 'connected') {
        this.updateState({ isInCall: true });
        this.dispatchEvent(new CustomEvent('call_connected', { detail: this.getState() }));
      }
    };

    return pc;
  }

  private async sendSignal(type: string, payload: any) {
    await supabase.channel('calls').send({
      type: 'broadcast',
      event: 'signal',
      payload: {
        type,
        ...payload,
        fromUserId: this.userId,
      }
    });
  }
}

const callService = new CallService();
export const useCallService = () => callService;
export { CallService };
