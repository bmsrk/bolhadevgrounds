import type { NetMsg, CharacterName, CharacterVariant, AnimState, Facing } from '../types.js';

export type SendFn = (msg: NetMsg, peerId?: string) => void;
export type RecvFn = (msg: NetMsg, peerId: string) => void;

/**
 * Encode a NetMsg to a plain object suitable for Trystero's JSON channel.
 * (Currently a no-op since NetMsg is already a plain object, but kept as a
 * stable boundary for future binary encoding.)
 */
export function encodeMsg(msg: NetMsg): NetMsg {
  return msg;
}

/**
 * Decode a received value from Trystero into a NetMsg.
 * Returns null if the value is not a valid NetMsg.
 */
export function decodeMsg(raw: unknown): NetMsg | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj['type'] !== 'string') return null;

  const type = obj['type'];
  switch (type) {
    case 'hello':
      if (
        typeof obj['playerId'] === 'string' &&
        typeof obj['name'] === 'string' &&
        typeof obj['x'] === 'number' &&
        typeof obj['y'] === 'number' &&
        typeof obj['color'] === 'string'
      ) {
        const CHARS: readonly string[] = ['Adam', 'Alex', 'Amelia', 'Bob'];
        const character = (CHARS.includes(obj['character'] as string)
          ? obj['character'] : 'Adam') as CharacterName;
        const rawVariant = Number(obj['variant']);
        const variant: CharacterVariant = (rawVariant >= 1 && rawVariant <= 6)
          ? (rawVariant as CharacterVariant) : 1;
        return { type: 'hello', playerId: obj['playerId'], name: obj['name'], x: obj['x'], y: obj['y'], color: obj['color'], character, variant };
      }
      break;
    case 'state':
      if (
        typeof obj['playerId'] === 'string' &&
        typeof obj['x'] === 'number' &&
        typeof obj['y'] === 'number' &&
        typeof obj['seq'] === 'number' &&
        typeof obj['ts'] === 'number'
      ) {
        const ANIM_STATES: readonly string[] = ['idle', 'idle_anim', 'walk', 'run', 'sit', 'phone'];
        const FACINGS:     readonly string[] = ['down', 'left', 'right', 'up'];
        const animState = (ANIM_STATES.includes(obj['animState'] as string)
          ? obj['animState'] : 'idle_anim') as AnimState;
        const facing = (FACINGS.includes(obj['facing'] as string)
          ? obj['facing'] : 'down') as Facing;
        const isTyping = obj['isTyping'] === true;
        return { type: 'state', playerId: obj['playerId'], x: obj['x'], y: obj['y'], seq: obj['seq'], ts: obj['ts'], animState, facing, isTyping };
      }
      break;
    case 'chat':
      if (
        typeof obj['id'] === 'string' &&
        typeof obj['fromPlayerId'] === 'string' &&
        typeof obj['fromName'] === 'string' &&
        typeof obj['text'] === 'string' &&
        typeof obj['ts'] === 'number'
      ) {
        return { type: 'chat', id: obj['id'], fromPlayerId: obj['fromPlayerId'], fromName: obj['fromName'], text: obj['text'], ts: obj['ts'] };
      }
      break;
    case 'bye':
      if (typeof obj['playerId'] === 'string') {
        return { type: 'bye', playerId: obj['playerId'] };
      }
      break;
    case 'namechange':
      if (typeof obj['playerId'] === 'string' && typeof obj['name'] === 'string') {
        return { type: 'namechange', playerId: obj['playerId'], name: obj['name'] };
      }
      break;
    case 'emote':
      if (typeof obj['playerId'] === 'string' && typeof obj['emoji'] === 'string') {
        return { type: 'emote', playerId: obj['playerId'], emoji: obj['emoji'] };
      }
      break;
  }
  return null;
}
