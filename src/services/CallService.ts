// src/services/CallService.ts
import { createClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';

const supabase = createClient(
  process.env.zklavsvtcnrcozsgmchq.supabase.co!,
  process.env.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprbGF2c3Z0Y25yY296c2dtY2hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc3MzU4ODQsImV4cCI6MjA2MzMxMTg4NH0.g_Sd37PapvRX98J8KCCoIEddQcwMJLN6vSBrEi4pzjM!
);

export type CallState = {
  isInCall: boolean;
  isCallActive: boolean;
  isCallInitiator: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connectionState: RTCPeerConnectionState;
  callStatus: 'idle' | 'connecting' | 'ringing' | 'active' | 'ended';
};

export class CallService extends EventEmitter {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private signalingChannel: any = null;
  private currentUserId: string | null = null;
  private state: CallState = {
    isInCall: false,
    isCallActive: false,
    isCallInitiator: false,
    localStream: null,
    remoteStream: null,
    connectionState: 'disconnected',
    callStatus: 'idle'
  };

  constructor() {
    super();
    this.setMaxListeners(20); // Увеличиваем лимит подписчиков
  }

  // Инициализация сервиса с ID пользователя
  initialize(userId: string) {
    this.currentUserId = userId;
    this.setupSignaling();
  }

  getState(): CallState {
    return this.state;
  }

  private updateState(newState: Partial<CallState>) {
    this.state = { ...this.state, ...newState };
    this.emit('state_changed', this.state);
  }

  private async setupLocalStream() {
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.updateState({ localStream: this.localStream });
  }

  private setupSignaling() {
    if (!this.currentUserId) return;

    this.signalingChannel = supabase.channel('voice_calls');

    this.signalingChannel
      .on('broadcast', { event: 'call_offer' }, (payload: any) => {
        if (payload.targetUserId === this.currentUserId) {
          this.emit('incoming_call', {
            fromUserId: payload.fromUserId,
            offer: payload.offer
          });
        }
      })
      .on('broadcast', { event: 'call_answer' }, (payload: any) => {
        if (payload.targetUserId === this.currentUserId) {
          if (payload.answer) {
            this.handleAnswer(payload.answer);
          }
          if (payload.accepted) {
            this.emit('call_accepted');
          } else {
            this.emit('call_rejected');
            this.cleanup();
          }
        }
      })
      .on('broadcast', { event: 'ice_candidate' }, (payload: any) => {
        if (payload.targetUserId === this.currentUserId && payload.candidate) {
          this.handleICECandidate(payload.candidate);
        }
      })
      .on('broadcast', { event: 'call_ended' }, (payload: any) => {
        if (payload.targetUserId === this.currentUserId) {
          this.emit('remote_hangup');
          this.cleanup();
        }
      })
      .subscribe();
  }

  async startCall(targetUserId: string) {
    if (!this.currentUserId) throw new Error('CallService not initialized');

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
      this.emit('call_started');
    } catch (error) {
      console.error('Call failed:', error);
      this.cleanup();
      throw error;
    }
  }

  async answerCall(targetUserId: string, offer: RTCSessionDescriptionInit, accept: boolean) {
    if (!this.currentUserId) throw new Error('CallService not initialized');
if (!accept) {
      this.signalingChannel.send({
        type: 'broadcast',
        event: 'call_answer',
        payload: {
          targetUserId,
          fromUserId: this.currentUserId,
          accepted: false
        }
      });
      this.cleanup();
      return;
    }

    try {
      this.updateState({
        isInCall: true,
        isCallInitiator: false,
        callStatus: 'connecting'
      });

      await this.setupLocalStream();
      this.setupPeerConnection(targetUserId);

      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);

      this.signalingChannel.send({
        type: 'broadcast',
        event: 'call_answer',
        payload: {
          targetUserId,
          fromUserId: this.currentUserId,
          answer,
          accepted: true
        }
      });

      this.emit('call_accepted');
    } catch (error) {
      console.error('Error answering call:', error);
      this.cleanup();
      throw error;
    }
  }

  endCall(targetUserId?: string) {
    if (targetUserId && this.signalingChannel) {
      this.signalingChannel.send({
        type: 'broadcast',
        event: 'call_ended',
        payload: {
          targetUserId,
          fromUserId: this.currentUserId
        }
      });
    }
    this.emit('call_ended');
    this.cleanup();
  }

  private setupPeerConnection(targetUserId: string) {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    });

    this.localStream!.getTracks().forEach(track => {
      this.peerConnection!.addTrack(track, this.localStream!);
    });

    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      this.updateState({ remoteStream: this.remoteStream });
      this.emit('stream_received', this.remoteStream);
    };

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

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      if (state) {
        this.updateState({ connectionState: state });
        this.emit('connection_state_changed', state);
        
        if (state === 'connected') {
          this.updateState({ isCallActive: true, callStatus: 'active' });
          this.emit('call_connected');
        } else if (state === 'disconnected' || state === 'failed') {
          this.emit('call_disconnected');
          this.cleanup();
        }
      }
    };
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.peerConnection) return;
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  private async handleICECandidate(candidate: RTCIceCandidateInit) {
    if (!this.peerConnection) return;
    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  private cleanup() {
    this.localStream?.getTracks().forEach(track => track.stop());
    this.peerConnection?.close();
    
    this.localStream = null;
    this.peerConnection = null;
    this.remoteStream = null;
    
    this.updateState({
      isInCall: false,
      isCallActive: false,
      localStream: null,
      remoteStream: null,
      connectionState: 'disconnected',
      callStatus: 'ended'
    });
  }
toggleMute() {
    if (this.localStream) {
      const newMuteState = !this.localStream.getAudioTracks()[0].enabled;
      this.localStream.getAudioTracks()[0].enabled = newMuteState;
      this.emit('mute_toggled', newMuteState);
      return newMuteState;
    }
    return false;
  }
}

// Экспортируем singleton экземпляр
export const callService = new CallService();

