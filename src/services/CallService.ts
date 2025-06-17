// services/CallService.ts
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

    this.signalingChannel = supabase.channel(`calls:${userId}`);
    this.signalingChannel
      .on('broadcast', { event: 'call_offer' }, ({ payload }) => {
        this.options.onIncomingCall?.(payload.fromUserId, payload.offer);
      })
      .on('broadcast', { event: 'call_answer' }, ({ payload }) => {
        this.options.onCallAnswer?.(payload.fromUserId, payload.answer, payload.accepted);
        if (payload.accepted && payload.answer) {
          this.handleCallAccepted(payload.answer);
        } else {
          this.dispatchEvent(new CustomEvent('call_rejected', { detail: this.getState() }));
        }
      })
      .on('broadcast', { event: 'ice_candidate' }, ({ payload }) => {
        if (this.peerConnection && payload.candidate) {
          this.peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(console.error);
        }
      })
      .on('broadcast', { event: 'call_ended' }, () => {
        this.dispatchEvent(new CustomEvent('call_ended', { detail: this.getState() }));
        this.cleanup();
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

    await this.broadcast('call_offer', {
      toUserId: targetUserId,
      fromUserId: this.userId,
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
      await this.broadcast('call_answer', {
        toUserId: fromUserId,
        fromUserId: this.userId,
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

    await this.broadcast('call_answer', {
      toUserId: fromUserId,
      fromUserId: this.userId,
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
      this.broadcast('call_ended', {
        toUserId: targetUserId,
        fromUserId: this.userId
      });
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
        this.broadcast('ice_candidate', {
          toUserId: targetUserId,
          fromUserId: this.userId,
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

  private async broadcast(event: string, payload: any) {
    if (payload.toUserId) {
      await supabase.channel(`calls:${payload.toUserId}`).send({
        type: 'broadcast',
        event,
        payload
      });
    }
  }
}

const callService = new CallService();
export const useCallService = () => callService;
export { CallService };
