import { EventEmitter } from 'eventemitter3';
import Peer from 'peerjs';

export interface CallState {
  isInCall: boolean;
  connectionState: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

class CallService extends EventEmitter {
  private peer: Peer | null = null;
  private currentCall: Peer.MediaConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private userId: string | null = null;

  getState(): CallState {
    return {
      isInCall: this.currentCall !== null,
      connectionState: this.currentCall?.peerConnection?.connectionState || 'disconnected',
      localStream: this.localStream,
      remoteStream: this.remoteStream
    };
  }

  async connect(userId: string): Promise<void> {
    this.userId = userId;
    return new Promise((resolve, reject) => {
      // Используем публичный сервер PeerJS
      this.peer = new Peer(userId, {
        host: '0.peerjs.com',
        port: 443,
        secure: true,
        path: '/'
      });

      this.peer.on('open', () => {
        resolve();
      });

      this.peer.on('error', (error) => {
        reject(error);
      });

      // Обработка входящего звонка
      this.peer.on('call', (call) => {
        this.currentCall = call;
        this.emit('incoming_call', { fromUserId: call.peer });
      });
    });
  }

  async startCall(targetUserId: string): Promise<void> {
    if (!this.peer) throw new Error('Peer not initialized');

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const call = this.peer.call(targetUserId, this.localStream);
      this.currentCall = call;

      call.on('stream', (remoteStream) => {
        this.remoteStream = remoteStream;
        this.emit('stream_changed');
      });

      call.on('close', () => {
        this.cleanup();
        this.emit('call_ended');
      });

      this.emit('call_started');
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  async answerCall(accept: boolean): Promise<void> {
    if (!this.currentCall || !this.peer) return;

    if (!accept) {
      this.currentCall.close();
      this.cleanup();
      return;
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.currentCall.answer(this.localStream);

      this.currentCall.on('stream', (remoteStream) => {
        this.remoteStream = remoteStream;
        this.emit('stream_changed');
      });

      this.currentCall.on('close', () => {
        this.cleanup();
        this.emit('call_ended');
      });

      this.emit('call_accepted');
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  endCall(): void {
    if (this.currentCall) {
      this.currentCall.close();
    }
    this.cleanup();
    this.emit('call_ended');
  }

  private cleanup(): void {
    this.localStream?.getTracks().forEach(track => track.stop());
    this.localStream = null;
    this.remoteStream = null;
    this.currentCall = null;
  }

  disconnect(): void {
    this.cleanup();
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}

export const callService = new CallService();
export const useCallService = () => callService;
