// World
export const WORLD_WIDTH  = 1280;
export const WORLD_HEIGHT = 720;
export const PLAYER_RADIUS = 14;
export const PLAYER_SPEED  = 180;   // pixels per second at normal speed
export const PLAYER_SPRINT_MULT = 1.8;

// Network
export const SEND_HZ          = 15;        // state broadcasts per second
export const PEER_TIMEOUT_MS  = 6_000;     // remove peer after 6 s silence
export const SMOOTHING_SAMPLES = 3;

// Chat
export const MAX_CHAT_MESSAGES = 200;
export const CHAT_MAX_LENGTH   = 300;      // max characters per message

// Colours
export const PLAYER_COLORS: readonly string[] = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#e91e63',
  '#00bcd4', '#8bc34a', '#ff5722', '#607d8b',
];
