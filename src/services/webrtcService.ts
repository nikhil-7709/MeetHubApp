import { Platform } from 'react-native';
import { getSupabase, isSupabaseConfigured } from '../supabase/config';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * MeetHub WebRTC Service
 * Real-time video/audio meetings using Dual Signaling:
 * 1. Supabase Realtime Broadcast (primary cloud signaling)
 * 2. WebSocket Signaling Server (LAN / local network fallback: EXPO_PUBLIC_SIGNALING_URL)
 *
 * Supports Web (native HTML5 WebRTC) and Native Mobile (react-native-webrtc).
 * Uses MDN Perfect Negotiation / Polite Peer pattern to guarantee 100% collision-free connections.
 */

// ── Public types ──────────────────────────────────────────────────────────────

export interface RemotePeer {
  peerId: string;
  name: string;
  stream: unknown; // MediaStream or WebRTC stream
  audioMuted: boolean;
  videoMuted: boolean;
  isScreenSharing?: boolean;
}

export interface WebRtcRoom {
  localStream: unknown | null;
  peers: Map<string, RemotePeer>;
  isMicOn: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  toggleMic: () => Promise<boolean>;
  toggleCamera: () => Promise<boolean>;
  toggleScreenShare: () => Promise<boolean>;
  flipCamera: () => Promise<void>;
  hangUp: () => void;
}

// ── Internal types ─────────────────────────────────────────────────────────────

type AnyPC = {
  localDescription: { type: string; sdp: string } | null;
  remoteDescription: { type: string; sdp: string } | null;
  signalingState?: string;
  createOffer: (opts?: object) => Promise<{ type: string; sdp: string }>;
  createAnswer: (opts?: object) => Promise<{ type: string; sdp: string }>;
  setLocalDescription: (d: object) => Promise<void>;
  setRemoteDescription: (d: object) => Promise<void>;
  addIceCandidate: (c: object) => Promise<void>;
  addStream?: (s: unknown) => void;
  addTrack?: (t: unknown, ...streams: unknown[]) => void;
  getSenders?: () => { track?: { kind: string }; replaceTrack?: (t: unknown) => Promise<void> }[];
  close: () => void;
  onicecandidate: ((e: { candidate: unknown }) => void) | null;
  onaddstream?: ((e: { stream: unknown }) => void) | null;
  ontrack?: ((e: { streams?: unknown[]; track?: unknown }) => void) | null;
  oniceconnectionstatechange?: (() => void) | null;
};

type RNWebRTC = {
  RTCPeerConnection: new (config: object) => AnyPC;
  RTCSessionDescription: new (d: object) => object;
  RTCIceCandidate: new (c: object) => object;
  mediaDevices: {
    getUserMedia: (c: object) => Promise<unknown>;
    getDisplayMedia?: (c: object) => Promise<unknown>;
  };
};

// ── WebRTC resolver — Web or Native ───────────────────────────────────────────

let _cache: RNWebRTC | null = null;
let _resolved = false;

export function getWebRTC(): RNWebRTC | null {
  if (_resolved) return _cache;
  _resolved = true;

  // 1. Web environment: native browser WebRTC
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const nav = window.navigator as unknown as {
      mediaDevices?: {
        getUserMedia: (c: object) => Promise<unknown>;
        getDisplayMedia?: (c: object) => Promise<unknown>;
      };
    };
    const win = window as unknown as {
      RTCPeerConnection?: new (config: object) => AnyPC;
      RTCSessionDescription?: new (d: object) => object;
      RTCIceCandidate?: new (c: object) => object;
    };

    if (nav?.mediaDevices && win?.RTCPeerConnection) {
      _cache = {
        RTCPeerConnection: win.RTCPeerConnection,
        RTCSessionDescription:
          win.RTCSessionDescription || (class {} as unknown as new (d: object) => object),
        RTCIceCandidate:
          win.RTCIceCandidate || (class {} as unknown as new (c: object) => object),
        mediaDevices: nav.mediaDevices,
      };
      return _cache;
    }
  }

  // 2. Native environment: react-native-webrtc
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _cache = require('react-native-webrtc') as RNWebRTC;
  } catch {
    _cache = null;
  }
  return _cache;
}

// ── ICE Server configuration (STUN + environment TURN) ─────────────────────────

export function getIceServers(): { urls: string | string[]; username?: string; credential?: string }[] {
  const servers: { urls: string | string[]; username?: string; credential?: string }[] = [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
      ],
    },
    {
      urls: ['stun:stun.cloudflare.com:3478'],
    },
    {
      urls: ['stun:stun.services.mozilla.com'],
    },
  ];

  const turnUrl = process.env.EXPO_PUBLIC_TURN_URL;
  const turnUsername = process.env.EXPO_PUBLIC_TURN_USERNAME;
  const turnCredential = process.env.EXPO_PUBLIC_TURN_CREDENTIAL;

  if (turnUrl && turnUrl.trim()) {
    const urls = turnUrl.includes(',')
      ? turnUrl.split(',').map((u) => u.trim()).filter(Boolean)
      : turnUrl.trim();

    servers.push({
      urls,
      username: turnUsername ? turnUsername.trim() : '',
      credential: turnCredential ? turnCredential.trim() : '',
    });
  }

  return servers;
}

// ── joinWebRtcRoom ────────────────────────────────────────────────────────────

export async function joinWebRtcRoom(
  meetingId: string,
  peerId: string,
  peerName: string,
  options: { camera: boolean; mic: boolean },
  onPeersChanged: (peers: Map<string, RemotePeer>) => void,
): Promise<WebRtcRoom> {
  const webrtc = getWebRTC();

  // If WebRTC is completely unavailable on this device/environment, return fallback room
  if (!webrtc) {
    return createMockRoom(options);
  }

  const { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, mediaDevices } = webrtc;

  // ── 1. Acquire Local Media ──────────────────────────────────────────────────
  let localStream: unknown = null;
  let isMicOn = options.mic;
  let isCameraOn = options.camera;
  let isScreenSharing = false;
  let facingMode: 'user' | 'environment' = 'user';

  try {
    localStream = await mediaDevices.getUserMedia({
      audio: true,
      video: options.camera
        ? { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
        : false,
    });
    applyTrackState(localStream, isMicOn, isCameraOn);
  } catch {
    try {
      // If video access denied or unavailable, acquire audio only
      localStream = await mediaDevices.getUserMedia({ audio: true, video: false });
      isCameraOn = false;
      applyTrackState(localStream, isMicOn, isCameraOn);
    } catch {
      // Permissions denied or device lacks audio/video inputs
      localStream = null;
    }
  }

  // ── 2. Peer & Connection Stores ─────────────────────────────────────────────
  const peers = new Map<string, RemotePeer>();
  const pcs = new Map<string, AnyPC>();
  const iceCandidateQueues = new Map<string, object[]>();
  const processedMessageIds = new Set<string>();

  // ── 3. Dual Signaling Transports ───────────────────────────────────────────
  let supabaseChannel: RealtimeChannel | null = null;
  let wsSocket: WebSocket | null = null;
  const channelName = `meeting_signal:${meetingId.replace(/[^A-Za-z0-9_-]/g, '_')}`;

  function sendSignal(msg: Record<string, unknown>) {
    const msgId = `${peerId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const fullMsg = {
      ...msg,
      msgId,
      meetingId,
      senderId: peerId,
      peerName,
      timestamp: Date.now(),
    };

    // Transport 1: WebSocket signaling (LAN / direct server)
    if (wsSocket && wsSocket.readyState === WebSocket.OPEN) {
      try {
        wsSocket.send(JSON.stringify(fullMsg));
      } catch {
        /* ignore ws send failure */
      }
    }

    // Transport 2: Supabase Realtime broadcast (Cloud)
    if (supabaseChannel) {
      supabaseChannel
        .send({
          type: 'broadcast',
          event: 'signal',
          payload: fullMsg,
        })
        .catch(() => {});
    }
  }

  async function flushIceCandidates(remotePeerId: string, pc: AnyPC) {
    const queue = iceCandidateQueues.get(remotePeerId);
    if (!queue || queue.length === 0) return;
    iceCandidateQueues.delete(remotePeerId);
    for (const cand of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch {
        /* ignore invalid candidates */
      }
    }
  }

  function makePeerConnection(remotePeerId: string): AnyPC {
    const pc = new RTCPeerConnection({ iceServers: getIceServers() });

    // Attach local stream tracks to the connection
    if (localStream) {
      const stream = localStream as {
        getTracks?: () => { kind: string }[];
      };
      if (typeof pc.addTrack === 'function' && typeof stream.getTracks === 'function') {
        for (const track of stream.getTracks()) {
          pc.addTrack(track, localStream);
        }
      } else if (typeof pc.addStream === 'function') {
        pc.addStream(localStream);
      }
    }

    // Exchange ICE candidates via signaling
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal({
          type: 'candidate',
          targetId: remotePeerId,
          candidate: e.candidate,
        });
      }
    };

    const handleRemoteStream = (stream: unknown) => {
      const prev = peers.get(remotePeerId);
      peers.set(remotePeerId, {
        peerId: remotePeerId,
        name: prev?.name ?? remotePeerId,
        stream,
        audioMuted: prev?.audioMuted ?? false,
        videoMuted: prev?.videoMuted ?? false,
        isScreenSharing: prev?.isScreenSharing ?? false,
      });
      onPeersChanged(new Map(peers));
    };

    // Modern ontrack listener
    if ('ontrack' in pc) {
      pc.ontrack = (e: { streams?: unknown[]; track?: unknown }) => {
        let stream = e.streams && e.streams[0];
        if (!stream && e.track && typeof window !== 'undefined' && typeof MediaStream !== 'undefined') {
          const prev = peers.get(remotePeerId);
          const cur = prev?.stream as MediaStream | undefined;
          if (cur && typeof cur.addTrack === 'function') {
            cur.addTrack(e.track as MediaStreamTrack);
            stream = cur;
          } else {
            stream = new MediaStream([e.track as MediaStreamTrack]);
          }
        }
        if (stream) {
          handleRemoteStream(stream);
        }
      };
    }

    if ('onaddstream' in pc) {
      pc.onaddstream = (e: { stream: unknown }) => {
        if (e.stream) {
          handleRemoteStream(e.stream);
        }
      };
    }

    return pc;
  }

  // Initiates an offer to a remote peer (Offerer role)
  async function callPeer(remotePeerId: string, remoteName: string) {
    try {
      let pc = pcs.get(remotePeerId);
      if (!pc) {
        pc = makePeerConnection(remotePeerId);
        pcs.set(remotePeerId, pc);
      }

      if (!peers.has(remotePeerId)) {
        peers.set(remotePeerId, {
          peerId: remotePeerId,
          name: remoteName,
          stream: null,
          audioMuted: false,
          videoMuted: false,
        });
        onPeersChanged(new Map(peers));
      }

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(new RTCSessionDescription(offer));

      sendSignal({
        type: 'offer',
        targetId: remotePeerId,
        sdp: pc.localDescription,
        peerName,
      });
    } catch {
      /* ignore call initiation errors */
    }
  }

  // Handles an incoming offer with polite-peer collision resolution
  async function handleOffer(remotePeerId: string, remoteName: string, sdp: object) {
    try {
      let pc = pcs.get(remotePeerId);
      if (!pc) {
        pc = makePeerConnection(remotePeerId);
        pcs.set(remotePeerId, pc);
      }

      // Check for offer collision (both peers sent offers simultaneously)
      const isOfferCollision =
        pc.signalingState &&
        pc.signalingState !== 'stable' &&
        pc.signalingState !== 'have-remote-offer';

      const isPolite = peerId < remotePeerId;

      if (isOfferCollision) {
        if (!isPolite) {
          // Impolite peer ignores the incoming offer; its own offer will prevail
          return;
        }
        // Polite peer rolls back its local offer and accepts incoming offer
        try {
          await pc.setLocalDescription({ type: 'rollback' });
        } catch {
          /* rollback fallback */
        }
      }

      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await flushIceCandidates(remotePeerId, pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(new RTCSessionDescription(answer));

      sendSignal({
        type: 'answer',
        targetId: remotePeerId,
        sdp: pc.localDescription,
      });

      if (!peers.has(remotePeerId)) {
        peers.set(remotePeerId, {
          peerId: remotePeerId,
          name: remoteName,
          stream: null,
          audioMuted: false,
          videoMuted: false,
        });
        onPeersChanged(new Map(peers));
      }
    } catch {
      /* ignore offer negotiation errors */
    }
  }

  async function handleAnswer(remotePeerId: string, sdp: object) {
    try {
      const pc = pcs.get(remotePeerId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await flushIceCandidates(remotePeerId, pc);
      }
    } catch {
      /* ignore answer negotiation errors */
    }
  }

  async function handleCandidate(remotePeerId: string, candidate: object) {
    try {
      const pc = pcs.get(remotePeerId);
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        const queue = iceCandidateQueues.get(remotePeerId) || [];
        queue.push(candidate);
        iceCandidateQueues.set(remotePeerId, queue);
      }
    } catch {
      /* ignore candidate errors */
    }
  }

  function broadcastMediaState() {
    const audioMuted = !isMicOn;
    const videoMuted = !isCameraOn && !isScreenSharing;

    sendSignal({
      type: 'media-state',
      audioMuted,
      videoMuted,
      isScreenSharing,
    });

    if (supabaseChannel) {
      supabaseChannel
        .track({
          peerId,
          name: peerName,
          audioMuted,
          videoMuted,
          isScreenSharing,
          updatedAt: Date.now(),
        })
        .catch(() => {});
    }
  }

  // ── 4. Unified Signal Dispatcher (Deduplicated) ───────────────────────────
  async function handleIncomingSignal(payload: Record<string, unknown>) {
    if (!payload || payload.senderId === peerId) return;
    if (payload.targetId && payload.targetId !== peerId) return;

    // Deduplicate identical signals delivered over both Supabase and WebSocket
    if (payload.msgId && typeof payload.msgId === 'string') {
      if (processedMessageIds.has(payload.msgId)) return;
      processedMessageIds.add(payload.msgId);
      if (processedMessageIds.size > 200) {
        const [first] = processedMessageIds;
        processedMessageIds.delete(first);
      }
    }

    const from = String(payload.senderId);
    const name = String(payload.peerName || from);

    switch (payload.type) {
      case 'join':
        // Register peer in list
        if (!peers.has(from)) {
          peers.set(from, {
            peerId: from,
            name,
            stream: null,
            audioMuted: false,
            videoMuted: false,
            isScreenSharing: false,
          });
          onPeersChanged(new Map(peers));
        }

        // PERFECT NEGOTIATION: Only the peer with higher peerId initiates the call
        if (peerId > from) {
          await callPeer(from, name);
        }
        break;

      case 'offer':
        await handleOffer(from, name, payload.sdp as object);
        break;

      case 'answer':
        await handleAnswer(from, payload.sdp as object);
        break;

      case 'candidate':
        await handleCandidate(from, payload.candidate as object);
        break;

      case 'media-state': {
        const p = peers.get(from);
        if (p) {
          peers.set(from, {
            ...p,
            audioMuted: Boolean(payload.audioMuted),
            videoMuted: Boolean(payload.videoMuted),
            isScreenSharing: Boolean(payload.isScreenSharing),
          });
          onPeersChanged(new Map(peers));
        }
        break;
      }

      case 'leave': {
        pcs.get(from)?.close();
        pcs.delete(from);
        peers.delete(from);
        iceCandidateQueues.delete(from);
        onPeersChanged(new Map(peers));
        break;
      }
    }
  }

  // ── 5. Setup WebSocket Signaling Client (LAN / Local Server) ───────────────
  const wsUrl = process.env.EXPO_PUBLIC_SIGNALING_URL || 'ws://192.168.234.194:8082';
  try {
    const ws = new WebSocket(wsUrl);
    wsSocket = ws;

    ws.onopen = () => {
      // Announce arrival to signaling room
      sendSignal({
        type: 'join',
        peerName,
      });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data));
        void handleIncomingSignal(data);
      } catch {
        /* ignore invalid json */
      }
    };

    ws.onerror = () => {
      /* quietly ignore if local ws server is offline; Supabase Realtime acts as backup */
    };
  } catch {
    /* ignore ws initiation errors */
  }

  // ── 6. Setup Supabase Realtime Channel (Cloud Internet) ───────────────────
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabase();
      supabaseChannel = supabase.channel(channelName, {
        config: {
          broadcast: { self: false },
          presence: { key: peerId },
        },
      });

      // A. Signaling Broadcast Listener
      supabaseChannel.on('broadcast', { event: 'signal' }, async ({ payload }) => {
        try {
          await handleIncomingSignal(payload as Record<string, unknown>);
        } catch {
          /* ignore signal errors */
        }
      });

      // B. Real-time Presence Listeners
      supabaseChannel.on('presence', { event: 'sync' }, () => {
        if (!supabaseChannel) return;
        const state = supabaseChannel.presenceState();
        let changed = false;

        for (const [key, presences] of Object.entries(state)) {
          if (key === peerId) continue;
          const p = presences[0] as
            | {
                peerId?: string;
                name?: string;
                audioMuted?: boolean;
                videoMuted?: boolean;
                isScreenSharing?: boolean;
              }
            | undefined;

          if (p) {
            const pid = p.peerId || key;
            const existing = peers.get(pid);
            if (!existing) {
              peers.set(pid, {
                peerId: pid,
                name: p.name || pid,
                stream: null,
                audioMuted: Boolean(p.audioMuted),
                videoMuted: Boolean(p.videoMuted),
                isScreenSharing: Boolean(p.isScreenSharing),
              });
              changed = true;
            }

            // Only deterministic initiator initiates offer
            if (!pcs.has(pid) && peerId > pid) {
              callPeer(pid, p.name || pid).catch(() => {});
            }
          }
        }

        if (changed) {
          onPeersChanged(new Map(peers));
        }
      });

      supabaseChannel.on('presence', { event: 'leave' }, ({ key }) => {
        if (key && key !== peerId) {
          pcs.get(key)?.close();
          pcs.delete(key);
          peers.delete(key);
          iceCandidateQueues.delete(key);
          onPeersChanged(new Map(peers));
        }
      });

      // C. Subscribe and announce Presence
      supabaseChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await supabaseChannel?.track({
            peerId,
            name: peerName,
            audioMuted: !isMicOn,
            videoMuted: !isCameraOn,
            isScreenSharing: false,
            joinedAt: Date.now(),
          });

          sendSignal({
            type: 'join',
            peerName,
          });
        }
      });
    } catch {
      /* ignore Supabase signaling setup errors */
    }
  }

  // ── 7. Room Object Interface ────────────────────────────────────────────────
  const room: WebRtcRoom = {
    get localStream() {
      return localStream;
    },
    get peers() {
      return peers;
    },
    get isMicOn() {
      return isMicOn;
    },
    get isCameraOn() {
      return isCameraOn;
    },
    get isScreenSharing() {
      return isScreenSharing;
    },

    async toggleMic() {
      isMicOn = !isMicOn;
      if (localStream) {
        applyTrackState(localStream, isMicOn, isCameraOn);
      }
      broadcastMediaState();
      return isMicOn;
    },

    async toggleCamera() {
      isCameraOn = !isCameraOn;
      if (isCameraOn && !localStream) {
        try {
          localStream = await mediaDevices.getUserMedia({
            audio: isMicOn,
            video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          });
          for (const pc of pcs.values()) {
            if (typeof pc.addStream === 'function') {
              pc.addStream(localStream);
            }
          }
        } catch {
          isCameraOn = false;
        }
      } else if (localStream) {
        applyTrackState(localStream, isMicOn, isCameraOn);
      }
      broadcastMediaState();
      return isCameraOn;
    },

    async toggleScreenShare() {
      try {
        if (isScreenSharing) {
          isScreenSharing = false;
          isCameraOn = true;
          stopStream(localStream);
          try {
            localStream = await mediaDevices.getUserMedia({
              audio: isMicOn,
              video: { facingMode },
            });
            const camTrack = (localStream as { getVideoTracks?: () => unknown[] })
              ?.getVideoTracks?.()[0];
            for (const pc of pcs.values()) {
              if (typeof pc.getSenders === 'function') {
                const senders = pc.getSenders();
                const sender = senders.find((s) => s.track?.kind === 'video');
                if (sender && typeof sender.replaceTrack === 'function') {
                  sender.replaceTrack(camTrack);
                }
              }
            }
          } catch {
            localStream = null;
          }
        } else {
          let screenStream: unknown = null;
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const nav = window.navigator as unknown as {
              mediaDevices?: { getDisplayMedia?: (c: object) => Promise<unknown> };
            };
            if (nav?.mediaDevices?.getDisplayMedia) {
              try {
                screenStream = await nav.mediaDevices.getDisplayMedia({
                  video: { displaySurface: 'browser' },
                  audio: true,
                  selfBrowserSurface: 'exclude',
                  surfaceSwitching: 'include',
                  systemAudio: 'include',
                });
              } catch {
                screenStream = await nav.mediaDevices.getDisplayMedia({
                  video: true,
                  audio: true,
                });
              }
            }
          } else if (mediaDevices.getDisplayMedia) {
            screenStream = await mediaDevices.getDisplayMedia({ video: true, audio: true });
          }

          if (screenStream) {
            stopStream(localStream);
            localStream = screenStream;
            isScreenSharing = true;
            isCameraOn = false;

            const tracks = (
              screenStream as { getVideoTracks: () => { onended: (() => void) | null }[] }
            ).getVideoTracks();
            const screenTrack = tracks[0];
            if (screenTrack) {
              screenTrack.onended = () => {
                void room.toggleScreenShare();
              };
            }

            for (const pc of pcs.values()) {
              if (typeof pc.getSenders === 'function') {
                const senders = pc.getSenders();
                const sender = senders.find((s) => s.track?.kind === 'video');
                if (sender && typeof sender.replaceTrack === 'function') {
                  sender.replaceTrack(screenTrack);
                }
              }
            }
          }
        }
      } catch {
        isScreenSharing = false;
      }
      broadcastMediaState();
      return isScreenSharing;
    },

    async flipCamera() {
      facingMode = facingMode === 'user' ? 'environment' : 'user';

      if (Platform.OS === 'web') {
        if (isCameraOn) {
          try {
            const newStream = await mediaDevices.getUserMedia({
              audio: isMicOn,
              video: { facingMode },
            });
            stopStream(localStream);
            localStream = newStream;
          } catch {
            /* ignore */
          }
        }
      } else {
        const s = localStream as { getVideoTracks?: () => { _switchCamera?: () => void }[] } | null;
        s?.getVideoTracks?.()[0]?._switchCamera?.();
      }
    },

    hangUp() {
      sendSignal({ type: 'leave' });

      for (const pc of pcs.values()) {
        try {
          pc.close();
        } catch {
          /* ignore */
        }
      }
      pcs.clear();
      peers.clear();
      iceCandidateQueues.clear();
      processedMessageIds.clear();

      stopStream(localStream);
      localStream = null;

      if (wsSocket) {
        try {
          wsSocket.close();
        } catch {
          /* ignore */
        }
        wsSocket = null;
      }

      if (supabaseChannel) {
        try {
          supabaseChannel.untrack().catch(() => {});
          getSupabase().removeChannel(supabaseChannel).catch(() => {});
        } catch {
          /* ignore */
        }
        supabaseChannel = null;
      }
    },
  };

  return room;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function applyTrackState(stream: unknown, micOn: boolean, cameraOn: boolean) {
  if (!stream) return;
  const s = stream as {
    getAudioTracks?: () => { enabled: boolean }[];
    getVideoTracks?: () => { enabled: boolean }[];
  };
  if (typeof s.getAudioTracks === 'function') {
    for (const t of s.getAudioTracks()) t.enabled = micOn;
  }
  if (typeof s.getVideoTracks === 'function') {
    for (const t of s.getVideoTracks()) t.enabled = cameraOn;
  }
}

function stopStream(stream: unknown) {
  if (!stream) return;
  const s = stream as { getTracks?: () => { stop: () => void }[] };
  if (typeof s.getTracks === 'function') {
    for (const t of s.getTracks()) t.stop();
  }
}

// ── Fallback room for environments without WebRTC ─────────────────────────────

function createMockRoom(options: { camera: boolean; mic: boolean }): WebRtcRoom {
  let isMicOn = options.mic;
  let isCameraOn = options.camera;
  let isScreenSharing = false;
  const peers = new Map<string, RemotePeer>();

  return {
    localStream: null,
    peers,
    get isMicOn() {
      return isMicOn;
    },
    get isCameraOn() {
      return isCameraOn;
    },
    get isScreenSharing() {
      return isScreenSharing;
    },
    toggleMic: async () => {
      isMicOn = !isMicOn;
      return isMicOn;
    },
    toggleCamera: async () => {
      isCameraOn = !isCameraOn;
      return isCameraOn;
    },
    toggleScreenShare: async () => {
      isScreenSharing = !isScreenSharing;
      return isScreenSharing;
    },
    flipCamera: async () => {},
    hangUp: () => {},
  };
}
