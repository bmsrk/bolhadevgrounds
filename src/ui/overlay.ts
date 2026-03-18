import type { GameState, ChatEntry } from '../types.js';
import { MAX_CHAT_MESSAGES, CHAT_MAX_LENGTH } from '../constants.js';

/** DOM references held by the overlay module. */
interface OverlayRefs {
  namePanel:    HTMLDivElement;
  nameInput:    HTMLInputElement;
  nameSaveBtn:  HTMLButtonElement;
  roomInfoBar:  HTMLDivElement;
  roomNameSpan: HTMLSpanElement;
  copyBtn:      HTMLButtonElement;
  chatPanel:    HTMLDivElement;
  chatMessages: HTMLDivElement;
  chatInput:    HTMLInputElement;
  chatSendBtn:  HTMLButtonElement;
  debugBtn:     HTMLButtonElement;
}

let _refs: OverlayRefs | null = null;
let _onNameSave:   ((name: string) => void) | null = null;
let _onChatSubmit: ((text: string) => void) | null = null;
let _onTypingChange: ((typing: boolean) => void) | null = null;

/** Build and inject all overlay HTML into #overlay. */
export function initOverlay(
  roomId: string,
  savedName: string,
  onNameSave:    (name: string) => void,
  onChatSubmit:  (text: string) => void,
  onTypingChange: (typing: boolean) => void,
  onDebugToggle:  () => void,
): void {
  const overlay = document.getElementById('overlay');
  if (!overlay) throw new Error('#overlay element not found');

  _onNameSave     = onNameSave;
  _onChatSubmit   = onChatSubmit;
  _onTypingChange = onTypingChange;

  overlay.innerHTML = `
    <style>
      /* ── Name Panel ─────────────────────────────────────────────── */
      #name-panel {
        position: absolute;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(20,20,40,0.95);
        border: 1px solid rgba(74,158,255,0.4);
        border-radius: 12px;
        padding: 28px 32px;
        min-width: 280px;
        pointer-events: auto;
        text-align: center;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      }
      #name-panel h2 {
        font-size: 1.3rem;
        color: #4a9eff;
        margin-bottom: 6px;
      }
      #name-panel p {
        font-size: 0.82rem;
        color: #888;
        margin-bottom: 16px;
      }
      #name-input {
        width: 100%;
        padding: 8px 12px;
        border-radius: 6px;
        border: 1px solid rgba(74,158,255,0.5);
        background: rgba(255,255,255,0.07);
        color: #e0e0e0;
        font-size: 1rem;
        margin-bottom: 12px;
        outline: none;
      }
      #name-input:focus { border-color: #4a9eff; }
      #name-save-btn {
        width: 100%;
        padding: 9px;
        border-radius: 6px;
        border: none;
        background: #4a9eff;
        color: #fff;
        font-size: 0.95rem;
        cursor: pointer;
        font-weight: 600;
      }
      #name-save-btn:hover { background: #3a8eef; }

      /* ── Room info bar ──────────────────────────────────────────── */
      #room-info-bar {
        position: absolute;
        top: 12px; left: 50%;
        transform: translateX(-50%);
        background: rgba(20,20,40,0.85);
        border: 1px solid rgba(74,158,255,0.25);
        border-radius: 20px;
        padding: 5px 14px;
        display: flex;
        align-items: center;
        gap: 10px;
        pointer-events: auto;
        font-size: 0.82rem;
        color: #aaa;
      }
      #room-name-span { color: #4a9eff; font-weight: 600; }
      #copy-btn {
        background: rgba(74,158,255,0.2);
        border: 1px solid rgba(74,158,255,0.4);
        color: #4a9eff;
        border-radius: 10px;
        padding: 2px 10px;
        font-size: 0.78rem;
        cursor: pointer;
      }
      #copy-btn:hover { background: rgba(74,158,255,0.35); }

      /* ── Chat panel ─────────────────────────────────────────────── */
      #chat-panel {
        position: absolute;
        bottom: 20px; right: 20px;
        width: 300px;
        background: rgba(15,15,30,0.9);
        border: 1px solid rgba(74,158,255,0.2);
        border-radius: 10px;
        display: flex;
        flex-direction: column;
        pointer-events: auto;
        max-height: 340px;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      }
      #chat-header {
        padding: 8px 12px;
        font-size: 0.78rem;
        font-weight: 600;
        color: #4a9eff;
        border-bottom: 1px solid rgba(74,158,255,0.15);
        background: rgba(74,158,255,0.06);
        flex-shrink: 0;
      }
      #chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-height: 180px;
        max-height: 240px;
        scrollbar-width: thin;
        scrollbar-color: rgba(74,158,255,0.3) transparent;
      }
      .chat-msg { font-size: 0.78rem; line-height: 1.4; word-break: break-word; }
      .chat-msg .sender { font-weight: 700; }
      .chat-msg.local .sender { color: #4a9eff; }
      .chat-msg .text { color: #ccc; }
      .chat-msg .ts { color: #555; font-size: 0.7rem; margin-left: 4px; }
      #chat-input-row {
        display: flex;
        gap: 6px;
        padding: 8px 10px;
        border-top: 1px solid rgba(74,158,255,0.15);
        flex-shrink: 0;
      }
      #chat-input {
        flex: 1;
        padding: 6px 8px;
        border-radius: 6px;
        border: 1px solid rgba(74,158,255,0.4);
        background: rgba(255,255,255,0.06);
        color: #e0e0e0;
        font-size: 0.8rem;
        outline: none;
      }
      #chat-input:focus { border-color: #4a9eff; }
      #chat-send-btn {
        padding: 6px 10px;
        border-radius: 6px;
        border: none;
        background: #4a9eff;
        color: #fff;
        font-size: 0.78rem;
        cursor: pointer;
        font-weight: 600;
      }
      #chat-send-btn:hover { background: #3a8eef; }

      /* ── Debug button ───────────────────────────────────────────── */
      #debug-btn {
        position: absolute;
        bottom: 20px; left: 20px;
        background: rgba(255,80,80,0.15);
        border: 1px solid rgba(255,80,80,0.35);
        color: rgba(255,80,80,0.8);
        border-radius: 8px;
        padding: 4px 10px;
        font-size: 0.73rem;
        cursor: pointer;
        pointer-events: auto;
      }
      #debug-btn:hover { background: rgba(255,80,80,0.25); }
    </style>

    <div id="name-panel">
      <h2>🚀 Startup Devgrounds</h2>
      <p>Enter your display name to join the office</p>
      <input id="name-input" type="text" maxlength="24" placeholder="Your name…" autocomplete="off" />
      <button id="name-save-btn">Save &amp; Enter</button>
    </div>

    <div id="room-info-bar" style="display:none">
      Room: <span id="room-name-span"></span>
      <button id="copy-btn">Copy invite link</button>
    </div>

    <div id="chat-panel" style="display:none">
      <div id="chat-header">💬 Chat</div>
      <div id="chat-messages"></div>
      <div id="chat-input-row">
        <input id="chat-input" type="text" maxlength="${CHAT_MAX_LENGTH}" placeholder="Say something…" autocomplete="off" />
        <button id="chat-send-btn">Send</button>
      </div>
    </div>

    <button id="debug-btn">Debug</button>
  `;

  _refs = {
    namePanel:    overlay.querySelector('#name-panel')    as HTMLDivElement,
    nameInput:    overlay.querySelector('#name-input')    as HTMLInputElement,
    nameSaveBtn:  overlay.querySelector('#name-save-btn') as HTMLButtonElement,
    roomInfoBar:  overlay.querySelector('#room-info-bar') as HTMLDivElement,
    roomNameSpan: overlay.querySelector('#room-name-span') as HTMLSpanElement,
    copyBtn:      overlay.querySelector('#copy-btn')      as HTMLButtonElement,
    chatPanel:    overlay.querySelector('#chat-panel')    as HTMLDivElement,
    chatMessages: overlay.querySelector('#chat-messages') as HTMLDivElement,
    chatInput:    overlay.querySelector('#chat-input')    as HTMLInputElement,
    chatSendBtn:  overlay.querySelector('#chat-send-btn') as HTMLButtonElement,
    debugBtn:     overlay.querySelector('#debug-btn')     as HTMLButtonElement,
  };

  // Pre-fill saved name
  if (savedName) _refs.nameInput.value = savedName;

  _refs.nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveName();
  });
  _refs.nameSaveBtn.addEventListener('click', saveName);

  _refs.copyBtn.addEventListener('click', () => {
    void navigator.clipboard.writeText(window.location.href);
    const btn = _refs!.copyBtn;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy invite link'; }, 1500);
  });

  _refs.chatInput.addEventListener('focus',  () => _onTypingChange?.(true));
  _refs.chatInput.addEventListener('blur',   () => _onTypingChange?.(false));
  _refs.chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChat();
  });
  _refs.chatSendBtn.addEventListener('click', sendChat);

  _refs.debugBtn.addEventListener('click', onDebugToggle);

  // Show name panel
  _refs.namePanel.style.display = '';
  _refs.roomNameSpan.textContent = roomId;
}

function saveName(): void {
  if (!_refs || !_onNameSave) return;
  const name = _refs.nameInput.value.trim();
  if (!name) {
    _refs.nameInput.focus();
    return;
  }
  _onNameSave(name);
  _refs.namePanel.style.display   = 'none';
  _refs.roomInfoBar.style.display = '';
  _refs.chatPanel.style.display   = '';
}

function sendChat(): void {
  if (!_refs || !_onChatSubmit) return;
  const text = _refs.chatInput.value.trim();
  if (!text) return;
  _refs.chatInput.value = '';
  _onChatSubmit(text);
}

/** Append a new chat entry and scroll to bottom. */
export function appendChatMessage(entry: ChatEntry): void {
  if (!_refs) return;
  const { chatMessages } = _refs;

  // Trim old messages if over the cap
  while (chatMessages.children.length >= MAX_CHAT_MESSAGES) {
    chatMessages.removeChild(chatMessages.firstChild!);
  }

  const time = new Date(entry.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const div = document.createElement('div');
  div.className = `chat-msg${entry.isLocal ? ' local' : ''}`;
  div.innerHTML = `<span class="sender">${escapeHtml(entry.fromName)}</span>` +
                  `<span class="ts">${time}</span><br>` +
                  `<span class="text">${escapeHtml(entry.text)}</span>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/** Update state-derived UI (called once per frame or on state change). */
export function updateOverlay(_state: GameState): void {
  // Currently no per-frame DOM updates needed — chat is event-driven.
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
