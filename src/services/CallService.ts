import { EventEmitter } from 'eventemitter3';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface CallState {
  isInCall: boolean;
  connectionState: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

class CallService extends EventEmitter {
  private channel: RealtimeChannel | null = null;
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private userId: string | null = null;
  private targetUserId: string | null = null;

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
    
    // Отключаемся от предыдущего канала
    if (this.channel) {
      this.channel.unsubscribe();
    }

    // Создаем канал для сигналинга
    this.channel = supabase.channel(`calls_${userId}`, {
      config: {
        presence: {
          key: userId
        }
      }
    });

    // Подписываемся на входящие сообщения
    this.channel
      .on('broadcast', { event: 'signal' }, (payload) => {
        this.handleSignalingMessage(payload.payload);
      })
      .subscribe();

    return new Promise((resolve, reject) => {
      this.channel?.on('system', (event) => {
        if (event === 'SUBSCRIBED') {
          resolve();
        } else if (event === 'CHANNEL_ERROR') {
          reject(new Error('Channel error'));
        }
      });
    });
  }

  private async handleSignalingMessage(message: any) {
    if (!this.pc) return;

    switch (message.type) {
      case 'offer':
        await this.pc.setRemoteDescription(new RTCSessionDescription(message.offer));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.sendSignal(message.fromUserId, {
          type: 'answer',
          answer
        });
        break;
        
      case 'answer':
        await this.pc.setRemoteDescription(new RTCSessionDescription(message.answer));
        break;
        
      case 'candidate':
        await this.pc.addIceCandidate(new RTCIceCandidate(message.candidate));
        break;
        
      case 'call':
        this.emit('incoming_call', {
          fromUserId: message.fromUserId,
          offer: message.offer
        });
        break;
    }
  }

  private async sendSignal(targetUserId: string, data: any) {
    if (!this.channel) return;
    
    await this.channel.send({
      type: 'broadcast',
      event: 'signal',
      payload: {
        ...data,
        toUserId: targetUserId,
        fromUserId: this.userId
      }
    });
  }

  async startCall(targetUserId: string): Promise<void> {
    this.targetUserId = targetUserId;
    this.cleanup();
    
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      
      this.setupPeerConnection();
      
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      
      // Отправляем сигнал вызова через канал
      if (this.channel) {
        await this.channel.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            type: 'call',
            targetUserId,
            fromUserId: this.userId,
            offer
          }
        });
      }
      
      this.emit('call_started');
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  private setupPeerConnection() {
    if (!this.pc) return;

    this.pc.onicecandidate = (event) => {
      if (event.candidate && this.targetUserId) {
        this.sendSignal(this.targetUserId, {
          type: 'candidate',
          candidate: event.candidate
        });
      }
    };
    
    this.pc.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      this.emit('stream_changed');
    };
    
    this.pc.onconnectionstatechange = () => {
      this.emit('state_changed');
      
      if (this.pc?.connectionState === 'connected') {
        this.emit('call_accepted');
      }
      
      if (this.pc?.connectionState === 'disconnected' || 
          this.pc?.connectionState === 'failed') {
        this.cleanup();
        this.emit('call_ended');
      }
    };
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.pc?.addTrack(track, this.localStream!);
      });
    }
  }

  async answerCall(offer: RTCSessionDescriptionInit) {
    if (!this.targetUserId) return;
    
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      
      this.setupPeerConnection();
      
      await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      
      this.sendSignal(this.targetUserId, {
        type: 'answer',
        answer
      });
      
      this.emit('call_accepted');
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  endCall() {
    this.cleanup();
    this.emit('call_ended');
  }

  private cleanup() {
    this.pc?.close();
    this.pc = null;
    this.localStream?.getTracks().forEach(track => track.stop());
    this.localStream = null;
    this.remoteStream = null;
    this.targetUserId = null;
  }

  disconnect() {
    this.cleanup();
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
  }
}

export const callService = new CallService();
export const useCallService = () => callService;
