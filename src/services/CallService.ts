import { EventEmitter } from 'eventemitter3';

export interface CallState {
  isInCall: boolean;
  connectionState: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

class CallService extends EventEmitter {
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private userId: string | null = null;
  private targetUserId: string | null = null;
  private signalingServer = "wss://your-websocket-server.com"; // Замените на свой сервер

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
    
    return new Promise((resolve, reject) => {
      if (this.ws) {
        this.ws.close();
      }

      this.ws = new WebSocket(`${this.signalingServer}?userId=${userId}`);
      
      this.ws.onopen = () => {
        resolve();
      };
      
      this.ws.onmessage = (event) => {
        this.handleSignalingMessage(JSON.parse(event.data));
      };
      
      this.ws.onerror = (error) => {
        reject(error);
      };
    });
  }

  private async handleSignalingMessage(message: any) {
    if (!this.pc) return;

    switch (message.type) {
      case 'offer':
        await this.pc.setRemoteDescription(new RTCSessionDescription(message.offer));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.send({
          type: 'answer',
          targetUserId: message.fromUserId,
          answer
        });
        break;
        
      case 'answer':
        await this.pc.setRemoteDescription(new RTCSessionDescription(message.answer));
        break;
        
      case 'candidate':
        await this.pc.addIceCandidate(new RTCIceCandidate(message.candidate));
        break;
        
      case 'incoming_call':
        this.emit('incoming_call', {
          fromUserId: message.fromUserId,
        });
        break;
    }
  }

  private send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
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
      
      this.send({
        type: 'offer',
        targetUserId,
        offer
      });
      
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
        this.send({
          type: 'candidate',
          targetUserId: this.targetUserId,
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

  async answerCall() {
    if (!this.pc || !this.targetUserId) return;
    
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.setupPeerConnection();
      
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
    this.ws?.close();
    this.ws = null;
  }
}

export const callService = new CallService();
export const useCallService = () => callService;
