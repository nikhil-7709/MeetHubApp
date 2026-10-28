import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

/**
 * MeetHub Meeting Link Utilities
 * Handles real dynamic URLs, deep links, invite formatting, and meeting code extraction.
 */

// Custom scheme registered in app.json ("scheme": "meethub")
export const MEETHUB_SCHEME = 'meethub';

// Official Vercel deployment domain
export const DEFAULT_PUBLIC_URL = 'https://meethubapp.vercel.app';

/**
 * Returns the true base Web URL for joining meetings:
 * Never returns localhost or 127.0.0.1 so that shared links can be opened by ANY external device.
 */
export function getBaseWebUrl(): string {
  // If running in browser on a real non-localhost domain (e.g. vercel.app or trycloudflare.com):
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.location?.origin &&
    !window.location.hostname.includes('localhost') &&
    !window.location.hostname.includes('127.0.0.1')
  ) {
    return window.location.origin;
  }

  // Otherwise, use configured public URL so shared invites work on ALL devices
  const envUrl = process.env.EXPO_PUBLIC_APP_URL || process.env.EXPO_PUBLIC_WEB_URL;
  if (
    envUrl &&
    envUrl.trim() &&
    !envUrl.includes('localhost') &&
    !envUrl.includes('127.0.0.1')
  ) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  return DEFAULT_PUBLIC_URL;
}

/**
 * Returns the direct web URL for browser-based joining (Chrome, Safari, Firefox, Edge).
 * e.g. "http://192.168.234.194:8081/meeting/MH-8421-903" or "http://localhost:8081/meeting/MH-8421-903"
 */
export function getMeetingWebLink(meetingId: string): string {
  const clean = cleanMeetingId(meetingId);
  return `${getBaseWebUrl()}/meeting/${clean}`;
}

/**
 * Returns the mobile deep link that opens MeetHub directly:
 * e.g. "meethub://meeting/MH-8421-903"
 */
export function getMeetingDeepLink(meetingId: string): string {
  const clean = cleanMeetingId(meetingId);
  return `${MEETHUB_SCHEME}://meeting/${clean}`;
}

/**
 * Returns the Expo Go or universal development link:
 * e.g. "exp://192.168.234.194:8081/--/meeting/MH-8421-903"
 */
export function getMeetingExpoLink(meetingId: string): string {
  const clean = cleanMeetingId(meetingId);
  try {
    return Linking.createURL(`meeting/${clean}`);
  } catch {
    return `${MEETHUB_SCHEME}://meeting/${clean}`;
  }
}

/**
 * Cleans and normalizes a meeting code (e.g. "mh-1234-567" -> "MH-1234-567")
 */
export function cleanMeetingId(meetingId: string): string {
  return (meetingId || '').trim().toUpperCase();
}

/**
 * Robustly parses a meeting code out of:
 * - Direct codes: "MH-1234-567" or "MH1234567"
 * - Deep links: "meethub://meeting/MH-1234-567"
 * - Web URLs: "http://192.168.234.194:8081/meeting/MH-1234-567" or "http://localhost:8081/meeting/MH-1234-567"
 * - Expo URLs: "exp://.../--/meeting/MH-1234-567"
 * - Full pasted messages: "Join my meeting on MeetHub... Meeting Code: MH-1234-567"
 */
export function parseMeetingCode(rawInput: string): string {
  if (!rawInput) return '';

  const trimmed = rawInput.trim();

  // 1. Look for standard MeetHub pattern (e.g. MH-XXXX-XXX or MH-XXXX)
  const codeMatch = trimmed.match(/MH-[A-Z0-9]+(-[A-Z0-9]+)*/i);
  if (codeMatch) {
    return codeMatch[0].toUpperCase();
  }

  // 2. If it's a URL/path, grab the last path segment
  if (trimmed.includes('/')) {
    const withoutQuery = trimmed.split('?')[0].split('#')[0];
    const segments = withoutQuery.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (last) {
      return last.replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
    }
  }

  // 3. Fallback: sanitize alphanumeric + hyphens
  return trimmed.replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
}

/**
 * Generates a complete, beautiful invitation message with real working connection links.
 */
export function formatMeetingInvite(meeting: {
  meetingId: string;
  title?: string;
  hostName?: string;
}): {
  title: string;
  message: string;
  url: string;
  deepLink: string;
  webLink: string;
  expoLink: string;
} {
  const cleanCode = cleanMeetingId(meeting.meetingId);
  const webLink = getMeetingWebLink(cleanCode);
  const deepLink = getMeetingDeepLink(cleanCode);
  const expoLink = getMeetingExpoLink(cleanCode);
  const roomTitle = (meeting.title || 'Live Meeting').trim();
  const host = meeting.hostName ? `\n👤 Host: ${meeting.hostName}` : '';

  const message = [
    `🎥 You're invited to a live meeting on MeetHub!`,
    `📌 Topic: ${roomTitle}${host}`,
    `🔑 Meeting Code: ${cleanCode}`,
    ``,
    `🌐 Join in Web Browser (Instant - Any Device):`,
    webLink,
    ``,
    `📱 Join in MeetHub App:`,
    deepLink,
    ``,
    `Or open MeetHub → tap "Join Room" → enter code: ${cleanCode}`,
  ].join('\n');

  return {
    title: `Join "${roomTitle}" on MeetHub`,
    message,
    url: webLink,
    deepLink,
    webLink,
    expoLink,
  };
}
