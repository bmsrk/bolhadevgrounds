import { joinRoom, selfId } from 'trystero/torrent';
import type { Room } from 'trystero';
import type { NetMsg } from '../types.js';
import { encodeMsg, decodeMsg } from './messages.js';

export type PeerJoinFn  = (peerId: string) => void;
export type PeerLeaveFn = (peerId: string) => void;
export type MsgFn       = (msg: NetMsg, peerId: string) => void;

export interface RoomHandle {
  /** Send a message to all peers (or a specific peer when peerId given). */
  send: (msg: NetMsg, peerId?: string) => void;
  /** Local Trystero self-ID. */
  selfId: string;
  /** Tear down the room connection. */
  leave: () => Promise<void>;
}

/**
 * Join a Trystero BitTorrent room and wire up message handlers.
 * Returns a RoomHandle for sending messages and a cleanup function.
 *
 * @param roomId   - The room name from the URL ?room= parameter.
 * @param onJoin   - Called when a new peer connects.
 * @param onLeave  - Called when a peer disconnects.
 * @param onMsg    - Called when a decoded NetMsg arrives from a peer.
 */
export function joinGameRoom(
  roomId: string,
  onJoin:  PeerJoinFn,
  onLeave: PeerLeaveFn,
  onMsg:   MsgFn,
): RoomHandle {
  // Using a stable, public appId string — matches the GitHub Pages URL.
  const room: Room = joinRoom(
    { appId: 'bolhadevgrounds.bmsrk.github.io' },
    roomId,
  );

  // Serialize messages as JSON strings — `string` satisfies DataPayload and avoids
  // TypeScript's index-signature requirement on our discriminated union types.
  const [sendAction, receiveAction] = room.makeAction<string>('msg');

  receiveAction((data: string, peerId: string) => {
    let parsed: unknown;
    try { parsed = JSON.parse(data); } catch { return; }
    const msg = decodeMsg(parsed);
    if (msg !== null) {
      onMsg(msg, peerId);
    }
  });

  room.onPeerJoin(onJoin);
  room.onPeerLeave(onLeave);

  return {
    send: (msg: NetMsg, peerId?: string) => {
      const encoded = JSON.stringify(encodeMsg(msg));
      void sendAction(encoded, peerId ?? null);
    },
    selfId,
    leave: () => room.leave(),
  };
}
