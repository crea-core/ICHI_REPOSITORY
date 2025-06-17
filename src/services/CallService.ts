this.signalingChannel.send({
        type: 'broadcast',
        event: 'call_answer',
        payload: {
          targetUserId: fromUserId,
          fromUserId: this.currentUserId,
          answer,
          accepted: true
        }
      });

      this.updateState({ callStatus: 'connecting' });
    } catch (error) {
      console.error('Error answering call:', error);
      this.cleanup();
    }
  }

  // Обработка ответа на звонок
  private async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;

    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      this.updateState({ callStatus: 'active', isCallActive: true });
    } catch (error) {
      console.error('Error setting remote description:', error);
    }
  }

  // Обработка ICE кандидатов
  private async handleICECandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) return;

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  // Обработка завершения звонка
  private handleCallEnded(): void {
    this.updateState({ callStatus: 'ended' });
    this.cleanup();
  }

  // Завершение звонка
  endCall(targetUserId?: string): void {
    if (targetUserId) {
      this.signalingChannel.send({
        type: 'broadcast',
        event: 'call_ended',
        payload: {
          targetUserId,
          fromUserId: this.currentUserId
        }
      });
    }
    this.updateState({ callStatus: 'ended' });
    this.cleanup();
  }

  // Настройка локального аудиопотока
  private async setupLocalStream(): Promise<void> {
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.updateState({ localStream: this.localStream });
  }

  // Настройка PeerConnection
  private setupPeerConnection(targetUserId: string): void {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    });

    // Добавление локального потока
    this.localStream!.getTracks().forEach(track => {
      this.peerConnection!.addTrack(track, this.localStream!);
    });

    // Обработка удаленного потока
    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      this.updateState({ 
        remoteStream: this.remoteStream,
        isCallActive: true,
        callStatus: 'active'
      });
    };

    // Обработка ICE кандидатов
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

    // Обработка изменения состояния соединения
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      if (state) {
        this.updateState({ connectionState: state });
        
        if (state === 'connected') {
          this.updateState({ isCallActive: true, callStatus: 'active' });
        } else if (state === 'disconnected' || state === 'failed') {
          this.updateState({ callStatus: 'ended' });
          this.cleanup();
        }
      }
    };
  }

  // Очистка ресурсов
  private cleanup(): void {
    this.localStream?.getTracks().forEach(track => track.stop());
    this.localStream = null;

    this.peerConnection?.close();
    this.peerConnection = null;

    this.remoteStream = null;

    this.updateState({
      isInCall: false,
      isCallActive: false,
      localStream: null,
      remoteStream: null,
      connectionState: 'disconnected',
      callStatus: 'idle'
    });
  }
}
// Пример использования в UI компоненте
class VoiceCallUI {
  private callService: VoiceCallService;
  private unsubscribe: () => void;

  constructor(userId: string) {
    this.callService = new VoiceCallService(userId);
    this.unsubscribe = this.callService.subscribe(this.updateUI.bind(this));
    
    // Привязка UI элементов
    document.getElementById('startCallBtn')?.addEventListener('click', this.startCall.bind(this));
    document.getElementById('endCallBtn')?.addEventListener('click', this.endCall.bind(this));
  }

  private updateUI(state: CallState): void {
    // Обновление UI на основе состояния
    const callStatusElement = document.getElementById('callStatus');
    if (callStatusElement) {
      callStatusElement.textContent = state.callStatus;
    }

    const startCallBtn = document.getElementById('startCallBtn');
    if (startCallBtn) {
      startCallBtn.disabled = state.isInCall;
    }

    const endCallBtn = document.getElementById('endCallBtn');
    if (endCallBtn) {
      endCallBtn.disabled = !state.isInCall;
    }

    // Другие обновления UI...
  }

  private async startCall(): Promise<void> {
    const targetUserId = (document.getElementById('targetUserId') as HTMLInputElement).value;
    await this.callService.startCall(targetUserId);
  }

  private endCall(): void {
    const targetUserId = (document.getElementById('targetUserId') as HTMLInputElement).value;
    this.callService.endCall(targetUserId);
  }

  public destroy(): void {
    this.unsubscribe();
    this.callService.endCall();
  }
}
