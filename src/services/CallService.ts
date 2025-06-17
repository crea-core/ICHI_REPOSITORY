// src/app/services/call.service.ts
import { Injectable } from '@angular/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

export interface CallState {
  isInCall: boolean;
  connectionState: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  incomingCall: { fromUserId: string; fromUserName: string } | null;
}

@Injectable({
  providedIn: 'root'
})
export class CallService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private supabase: SupabaseClient;
  private channel: any;
  private currentUserId: string | null = null;

  private _state: CallState = {
    isInCall: false,
    connectionState: 'disconnected',
    localStream: null,
    remoteStream: null,
    incomingCall: null
  };

  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );
  }

  async initialize(userId: string): Promise<void> {
    this.currentUserId = userId;
    
    this.channel = this.supabase.channel(`calls_${userId}`, {
      config: {
        broadcast: { ack: true }
      }
    });

    this.channel
      .on('broadcast', { event: 'call-offer' }, (payload: any) => {
        this.handleIncomingCall(payload.fromUserId, payload.fromUserName, payload.offer);
      })
      .on('broadcast', { event: 'call-answer' }, async (payload: any) => {
        if (payload.answer) {
          await this.peerConnection?.setRemoteDescription(
            new RTCSessionDescription(payload.answer)
          );
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, (payload: any) => {
        this.handleRemoteIceCandidate(payload.candidate);
      })
      .subscribe();
  }

  private async handleIncomingCall(fromUserId: string, fromUserName: string, offer: RTCSessionDescriptionInit) {
    this._state.incomingCall = { fromUserId, fromUserName };
    this.notifyStateChange();
    
    try {
      this.peerConnection = new RTCPeerConnection(this.getIceConfig());
      this.setupPeerConnection(fromUserId);
      
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer)
      );
    } catch (error) {
      console.error('Error handling incoming call:', error);
      this.cleanup();
    }
  }

  async startCall(targetUserId: string, targetUserName: string): Promise<void> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this._state.localStream = this.localStream;
      this.notifyStateChange();
      
      this.peerConnection = new RTCPeerConnection(this.getIceConfig());
      this.setupPeerConnection(targetUserId);
      
      this.localStream.getTracks().forEach(track => {
        this.peerConnection?.addTrack(track, this.localStream!);
      });

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      this.channel.send({
        type: 'broadcast',
        event: 'call-offer',
        payload: {
          toUserId: targetUserId,
          fromUserId: this.currentUserId,
          fromUserName: targetUserName,
          offer: offer
        }
      });

      this._state.isInCall = true;
      this._state.connectionState = 'connecting';
      this.notifyStateChange();
      
    } catch (error) {
      console.error('Error starting call:', error);
      this.cleanup();
      throw error;
    }
  }

  async acceptCall(): Promise<void> {
    if (!this._state.incomingCall || !this.peerConnection) return;
    
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this._state.localStream = this.localStream;
      
      this.localStream.getTracks().forEach(track => {
        this.peerConnection?.addTrack(track, this.localStream!);
      });

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      this.channel.send({
        type: 'broadcast',
        event: 'call-answer',
        payload: {
          toUserId: this._state.incomingCall.fromUserId,
          fromUserId: this.currentUserId,
          answer: answer
        }
      });

      this._state.isInCall = true;
      this._state.connectionState = 'connected';
      this._state.incomingCall = null;
      this.notifyStateChange();
      
    } catch (error) {
      console.error('Error accepting call:', error);
      this.cleanup();
      throw error;
    }
  }

  rejectCall(): void {
    if (!this._state.incomingCall) return;
    
    this.channel.send({
      type: 'broadcast',
      event: 'call-answer',
      payload: {
        toUserId: this._state.incomingCall.fromUserId,
        fromUserId: this.currentUserId,
        answer: null
      }
    });
    
    this.cleanup();
  }

  endCall(): void {
    this.cleanup();
  }

  private getIceConfig(): RTCConfiguration {
    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        // Добавьте TURN сервер при необходимости
      ]
    };
  }

  private setupPeerConnection(targetUserId: string): void {
    if (!this.peerConnection) return;

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.channel.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: {
            toUserId: targetUserId,
            fromUserId: this.currentUserId,
            candidate: event.candidate
          }
        });
      }
    };

    this.peerConnection.ontrack = (event) => {
      this._state.remoteStream = event.streams[0];
      this.notifyStateChange();
    };

    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection) {
        this._state.connectionState = this.peerConnection.connectionState;
        this.notifyStateChange();
        
        if (this.peerConnection.connectionState === 'disconnected') {
          this.cleanup();
        }
      }
    };
  }

  private handleRemoteIceCandidate(candidate: RTCIceCandidateInit): void {
    if (this.peerConnection && candidate) {
      this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
        .catch(error => console.error('Error adding ICE candidate:', error));
    }
  }

  private cleanup(): void {
    this.peerConnection?.close();
    this.localStream?.getTracks().forEach(track => track.stop());
    
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    
    this._state = {
      isInCall: false,
      connectionState: 'disconnected',
      localStream: null,
      remoteStream: null,
      incomingCall: null
    };
    
    this.notifyStateChange();
  }

  private notifyStateChange(): void {
    // Здесь можно добавить вызов Subject или EventEmitter для Angular компонентов
    console.log('Call state changed:', this._state);
  }

  get state(): CallState {
    return this._state;
  }
}
