import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { Platform } from 'react-native';
import {
  mediaDevices,
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  type MediaStream,
  type MediaStreamTrack,
} from 'react-native-webrtc';
import { getFirebase } from '../firebase/config';
import type { RoomParticipant } from '../types';

type PeerEventApi = {
  addEventListener(type: 'track', listener: (event: { streams: MediaStream[] }) => void): void;
  addEventListener(type: 'connectionstatechange', listener: () => void): void;
  addEventListener(type: 'icecandidate', listener: (event: { candidate: RTCIceCandidate | null }) => void): void;
};

type TrackEventApi = {
  addEventListener(type: 'ended', listener: () => void): void;
};

type RoomCallbacks = {
  onRemoteStream: (participantId: string, stream: MediaStream) => void;
  onParticipantChange: (participants: RoomParticipant[]) => void;
  onConnectionChange: (participantId: string, state: string) => void;
  onError: (error: Error) => void;
};

export type WebRtcRoom = {
  localStream: MediaStream;
  toggleMicrophone: (enabled: boolean) => void;
  toggleCamera: (enabled: boolean) => void;
  switchCamera: () => void;
  toggleScreenShare: () => Promise<boolean>;
  leave: () => Promise<void>;
};

function iceServers() {
  const servers: { urls: string; username?: string; credential?: string }[] = [
    { urls: 'stun:stun.l.google.com:19302' },
  ];
  const turnUrl = process.env.EXPO_PUBLIC_TURN_URL;
  const turnUsername = process.env.EXPO_PUBLIC_TURN_USERNAME;
  const turnCredential = process.env.EXPO_PUBLIC_TURN_CREDENTIAL;
  if (turnUrl && turnUsername && turnCredential) {
    servers.push({ urls: turnUrl, username: turnUsername, credential: turnCredential });
  }
  return servers;
}

export async function joinWebRtcRoom(
  meetingId: string,
  participant: Omit<RoomParticipant, 'participantId' | 'active' | 'joinedAt'>,
  callbacks: RoomCallbacks,
): Promise<WebRtcRoom> {
  const { db } = getFirebase();
  const participantsRef = collection(db, 'meetings', meetingId, 'participants');
  const signalRef = collection(db, 'meetings', meetingId, 'signaling');
  const staleSignals = await Promise.all([
    getDocs(query(signalRef, where('from', '==', participant.userId))),
    getDocs(query(signalRef, where('to', '==', participant.userId))),
  ]);
  await Promise.all(staleSignals.flatMap((snapshot) => snapshot.docs.map((item) => deleteDoc(item.ref))));
  const localStream = await mediaDevices.getUserMedia({
    audio: true,
    video: { facingMode: 'user', frameRate: 24 },
  });
  const joinedAt = Date.now();
  const localParticipant: RoomParticipant = {
    ...participant,
    participantId: participant.userId,
    active: true,
    joinedAt,
  };
  await setDoc(doc(participantsRef, participant.userId), localParticipant);

  const peers = new Map<string, RTCPeerConnection>();
  const pendingIce = new Map<string, RTCIceCandidate[]>();
  const unsubscribers: Unsubscribe[] = [];
  let leaving = false;
  let screenTrack: MediaStreamTrack | null = null;
  let cameraTrack = localStream.getVideoTracks()[0];

  const stopScreenShare = async () => {
    if (!screenTrack) return;
    const currentScreen = screenTrack;
    screenTrack = null;
    for (const peer of peers.values()) {
      const sender = peer.getSenders().find((item) => item.track?.kind === 'video');
      if (sender) await sender.replaceTrack(cameraTrack ?? null);
    }
    localStream.removeTrack(currentScreen);
    currentScreen.stop();
    if (cameraTrack) localStream.addTrack(cameraTrack);
  };

  const makePeer = (remoteId: string) => {
    const existing = peers.get(remoteId);
    if (existing) return existing;
    const peer = new RTCPeerConnection({ iceServers: iceServers() });
    const events = peer as RTCPeerConnection & PeerEventApi;
    peers.set(remoteId, peer);
    localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));
    events.addEventListener('track', (event) => {
      const stream = event.streams[0];
      if (stream) callbacks.onRemoteStream(remoteId, stream);
    });
    events.addEventListener('connectionstatechange', () =>
      callbacks.onConnectionChange(remoteId, peer.connectionState),
    );
    events.addEventListener('icecandidate', (event) => {
      if (!event.candidate || leaving) return;
      void setDoc(doc(signalRef, `ice_${participant.userId}_${remoteId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`), {
        type: 'ice',
        from: participant.userId,
        to: remoteId,
        candidate: event.candidate.toJSON(),
      }).catch(callbacks.onError);
    });
    return peer;
  };

  const drainIce = async (remoteId: string, peer: RTCPeerConnection) => {
    const candidates = pendingIce.get(remoteId) ?? [];
    pendingIce.delete(remoteId);
    for (const candidate of candidates) await peer.addIceCandidate(candidate);
  };

  unsubscribers.push(
    onSnapshot(query(participantsRef, where('active', '==', true)), (snapshot) => {
      const active = snapshot.docs.map((item) => item.data() as RoomParticipant);
      const activeUserIds = new Set(active.map((item) => item.userId));
      peers.forEach((peer, id) => {
        if (!activeUserIds.has(id)) {
          peer.close();
          peers.delete(id);
          pendingIce.delete(id);
        }
      });
      callbacks.onParticipantChange(active);
      active.forEach((other) => {
        const isNewer =
          joinedAt > other.joinedAt ||
          (joinedAt === other.joinedAt && participant.userId > other.userId);
        if (other.userId !== participant.userId && isNewer && !peers.has(other.userId)) {
          void (async () => {
            try {
              const peer = makePeer(other.userId);
              const offer = await peer.createOffer();
              await peer.setLocalDescription(offer);
              await setDoc(doc(signalRef, `offer_${participant.userId}_${other.userId}`), {
                type: 'offer',
                from: participant.userId,
                to: other.userId,
                sdp: offer.sdp,
              });
            } catch (error) {
              callbacks.onError(error instanceof Error ? error : new Error('Could not create video offer.'));
            }
          })();
        }
      });
    }, callbacks.onError),
  );

  unsubscribers.push(
    onSnapshot(query(signalRef, where('to', '==', participant.userId), where('type', '==', 'offer')), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type !== 'added') return;
        const data = change.doc.data();
        const from = String(data.from);
        void (async () => {
          try {
            const peer = makePeer(from);
            await peer.setRemoteDescription(
              new RTCSessionDescription({ type: 'offer', sdp: String(data.sdp) }),
            );
            await drainIce(from, peer);
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            await setDoc(doc(signalRef, `answer_${from}_${participant.userId}`), {
              type: 'answer',
              from: participant.userId,
              to: from,
              sdp: answer.sdp,
            });
          } catch (error) {
            callbacks.onError(error instanceof Error ? error : new Error('Could not accept video offer.'));
          }
        })();
      });
    }, callbacks.onError),
  );

  unsubscribers.push(
    onSnapshot(query(signalRef, where('to', '==', participant.userId), where('type', '==', 'ice')), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type !== 'added') return;
        const data = change.doc.data();
        const from = String(data.from);
        const peer = peers.get(from);
        const candidate = new RTCIceCandidate(data.candidate);
        if (peer?.remoteDescription) {
          void peer.addIceCandidate(candidate).catch(callbacks.onError);
        } else {
          pendingIce.set(from, [...(pendingIce.get(from) ?? []), candidate]);
        }
      });
    }, callbacks.onError),
  );

  unsubscribers.push(
    onSnapshot(query(signalRef, where('to', '==', participant.userId), where('type', '==', 'answer')), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type !== 'added') return;
        const data = change.doc.data();
        const peer = peers.get(String(data.from));
        if (!peer || peer.remoteDescription) return;
        void peer
          .setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: String(data.sdp) }))
          .then(() => drainIce(String(data.from), peer))
          .catch(callbacks.onError);
      });
    }, callbacks.onError),
  );

  return {
    localStream,
    toggleMicrophone: (enabled) => {
      localStream.getAudioTracks().forEach((track) => (track.enabled = enabled));
      void setParticipantAudioState(meetingId, participant.userId, !enabled).catch(callbacks.onError);
    },
    toggleCamera: (enabled) => {
      cameraTrack = localStream.getVideoTracks().find((track) => track !== screenTrack) ?? cameraTrack;
      if (cameraTrack) cameraTrack.enabled = enabled;
      if (!screenTrack) localStream.getVideoTracks().forEach((track) => (track.enabled = enabled));
      void setParticipantCameraState(meetingId, participant.userId, !enabled).catch(callbacks.onError);
    },
    switchCamera: () => cameraTrack?._switchCamera(),
    toggleScreenShare: async () => {
      if (Platform.OS !== 'android') {
        throw new Error('Screen sharing is currently supported on Android development builds.');
      }
      if (screenTrack) {
        await stopScreenShare();
        return false;
      }
      const displayStream = await mediaDevices.getDisplayMedia();
      const nextTrack = displayStream.getVideoTracks()[0];
      if (!nextTrack) throw new Error('Android did not provide a screen video stream.');
      cameraTrack = localStream.getVideoTracks()[0] ?? cameraTrack;
      for (const peer of peers.values()) {
        const sender = peer.getSenders().find((item) => item.track?.kind === 'video');
        if (sender) await sender.replaceTrack(nextTrack);
      }
      if (cameraTrack) localStream.removeTrack(cameraTrack);
      localStream.addTrack(nextTrack);
      screenTrack = nextTrack;
      (nextTrack as MediaStreamTrack & TrackEventApi).addEventListener('ended', () => {
        void stopScreenShare().catch(callbacks.onError);
      });
      return true;
    },
    leave: async () => {
      leaving = true;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      if (screenTrack) await stopScreenShare();
      peers.forEach((peer) => peer.close());
      peers.clear();
      localStream.getTracks().forEach((track) => track.stop());
      await deleteDoc(doc(participantsRef, participant.userId));
      const roomSignals = await Promise.all([
        getDocs(query(signalRef, where('from', '==', participant.userId))),
        getDocs(query(signalRef, where('to', '==', participant.userId))),
      ]);
      await Promise.all(roomSignals.flatMap((snapshot) => snapshot.docs.map((item) => deleteDoc(item.ref))));
    },
  };
}

export async function setParticipantAudioState(meetingId: string, userId: string, muted: boolean) {
  const { db } = getFirebase();
  await updateDoc(doc(db, 'meetings', meetingId, 'participants', userId), { isMuted: muted });
}

export async function setParticipantCameraState(meetingId: string, userId: string, cameraOff: boolean) {
  const { db } = getFirebase();
  await updateDoc(doc(db, 'meetings', meetingId, 'participants', userId), { isCameraOff: cameraOff });
}
