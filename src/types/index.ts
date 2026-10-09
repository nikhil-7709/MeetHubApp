import type { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  userId: string;
  name: string;
  email: string;
  profileImage: string;
  createdAt: number | Timestamp;
}

export type MeetingStatus = 'scheduled' | 'active' | 'ended';

export interface Meeting {
  meetingId: string;
  title: string;
  description: string;
  hostId: string;
  hostName: string;
  scheduledDate: number;
  startTime: number;
  endTime: number;
  participants: string[];
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  durationSeconds?: number;
  status: MeetingStatus;
}

export interface MeetingMessage {
  messageId: string;
  meetingId: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: number | Timestamp;
}

export interface RoomParticipant {
  participantId: string;
  userId: string;
  name: string;
  profileImage: string;
  isMuted: boolean;
  isCameraOff: boolean;
  active: boolean;
  joinedAt: number;
}