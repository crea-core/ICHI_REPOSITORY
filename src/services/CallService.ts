type SignalData = any;

class CallService {
  private ws: WebSocket | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private userId: string;
  private targetUserId: string | null = null;

  constructor(userId: string) {
    this.userId = userId;
    this.initWebSocket();
  }

  private initWebSocket() {
    const wsUrl = `wss://<your-project-id>.supabase.co/functions/v1/voice-call?userId=${this.userId}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log("[WebSocket] Connected");
    };

    this.ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      const type = data.type;

      if (type === "offer") {
        await this.handleOffer(data.signal, data.fromUserId);
      } else if (type === "answer") {
        await this.handleAnswer(data.signal);
      } else if (type === "ice-candidate") {
        await this.handleIceCandidate(data.candidate);
      }
    };

    this.ws.onclose = () => {
      console.warn("[WebSocket] Disconnected");
    };

    this.ws.onerror = (err) => {
      console.error("[WebSocket] Error", err);
    };
  }

  private sendMessage(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.targetUserId) {
      this.ws.send(JSON.stringify({ ...message, targetUserId: this.targetUserId }));
    }
  }

  public async startCall(targetUserId: string) {
    this.targetUserId = targetUserId;
    this.peerConnection = new RTCPeerConnection();

    this.peerConnection.onicecandidate = (e) => {
      if (e.candidate) {
        this.sendMessage({ type: "ice-candidate", candidate: e.candidate });
      }
    };

    this.remoteStream = new MediaStream();
    this.peerConnection.ontrack = (e) => {
      this.remoteStream?.addTrack(e.track);
    };

    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    this.localStream.getTracks().forEach((track) => {
      this.peerConnection?.addTrack(track, this.localStream!);
    });

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    this.sendMessage({ type: "offer", signal: offer });
  }

  private async handleOffer(offer: SignalData, fromUserId: string) {
    this.targetUserId = fromUserId;
    this.peerConnection = new RTCPeerConnection();

    this.peerConnection.onicecandidate = (e) => {
      if (e.candidate) {
        this.sendMessage({ type: "ice-candidate", candidate: e.candidate });
      }
    };

    this.remoteStream = new MediaStream();
    this.peerConnection.ontrack = (e) => {
      this.remoteStream?.addTrack(e.track);
    };

    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    this.localStream.getTracks().forEach((track) => {
      this.peerConnection?.addTrack(track, this.localStream!);
    });

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    this.sendMessage({ type: "answer", signal: answer });
  }

  private async handleAnswer(answer: SignalData) {
    if (this.peerConnection) {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  private async handleIceCandidate(candidate: RTCIceCandidateInit) {
    if (this.peerConnection) {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  public getLocalStream() {
    return this.localStream;
  }

  public getRemoteStream() {
    return this.remoteStream;
  }

  public closeConnection() {
    this.peerConnection?.close();
    this.peerConnection = null;
    this.targetUserId = null;
  }
}

export default CallService;
