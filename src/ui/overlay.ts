import type { GameState, ChatEntry, CharacterName, CharacterVariant } from '../types.js';
import { MAX_CHAT_MESSAGES, CHAT_MAX_LENGTH } from '../constants.js';
import { ASSET_BASE } from '../game/sprites.js';

/** DOM references held by the overlay module. */
interface OverlayRefs {
  namePanel:    HTMLDivElement;
  nameInput:    HTMLInputElement;
  nameError:    HTMLParagraphElement;
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

const CHAR_NAMES: readonly CharacterName[]   = ['Adam', 'Alex', 'Amelia', 'Bob'];
const CHAR_LABELS: Record<CharacterName, string> = {
  Adam:   'Adam',
  Alex:   'Alex',
  Amelia: 'Amelia',
  Bob:    'Bob',
};
const VARIANT_HUE: Record<CharacterVariant, number> = {
  1: 0, 2: 60, 3: 120, 4: 180, 5: 240, 6: 300,
};
/** Base path for character idle sprites (used as thumbnails). */
const CHAR_BASE = 'pixelart/Modern tiles_Free/Characters_free';

let _refs: OverlayRefs | null = null;
let _onNameSave:        ((name: string) => void) | null = null;
let _onChatSubmit:      ((text: string) => void) | null = null;
let _onTypingChange:    ((typing: boolean) => void) | null = null;
let _getTakenNames:     (() => Set<string>) | null = null;
let _onCharacterSelect: ((char: CharacterName, variant: CharacterVariant) => void) | null = null;

let _selectedChar:    CharacterName    = 'Adam';
let _selectedVariant: CharacterVariant = 1;

/** Build and inject all overlay HTML into #overlay. */
export function initOverlay(
  roomId:            string,
  savedName:         string,
  savedChar:         CharacterName,
  savedVariant:      CharacterVariant,
  getTakenNames:     () => Set<string>,
  onCharacterSelect: (char: CharacterName, variant: CharacterVariant) => void,
  onNameSave:        (name: string) => void,
  onChatSubmit:      (text: string) => void,
  onTypingChange:    (typing: boolean) => void,
  onDebugToggle:     () => void,
): void {
  const overlay = document.getElementById('overlay');
  if (!overlay) throw new Error('#overlay element not found');

  _onNameSave        = onNameSave;
  _onChatSubmit      = onChatSubmit;
  _onTypingChange    = onTypingChange;
  _getTakenNames     = getTakenNames;
  _onCharacterSelect = onCharacterSelect;
  _selectedChar      = savedChar;
  _selectedVariant   = savedVariant;

  // Build character card HTML for each char × variant
  const charCardsHtml = CHAR_NAMES.map(char => {
    const spritePath = `${CHAR_BASE}/${char}_idle_16x16.png`;
    // "down" facing is frame index 3 in the idle sheet (srcX = 3×16 = 48px)
    // Display at 3× = 48×96px.  Sheet is 64×32 source → 192×96 at 3×.
    return `
      <button class="char-card${char === savedChar ? ' active' : ''}" data-char="${char}" title="${CHAR_LABELS[char]}">
        <span class="char-thumb" style="background-image:url('${ASSET_BASE}${spritePath}')"></span>
        <span class="char-card-name">${CHAR_LABELS[char]}</span>
      </button>`;
  }).join('');

  const variantBtnsHtml = ([1, 2, 3, 4, 5, 6] as CharacterVariant[]).map(v => {
    const hue = VARIANT_HUE[v];
    return `<button class="variant-btn${v === savedVariant ? ' active' : ''}" data-variant="${v}" title="Variant ${v}">
      <span class="variant-dot" style="filter:hue-rotate(${hue}deg)"></span>
    </button>`;
  }).join('');

  overlay.innerHTML = `
    <style>
      /* ── Name Panel ─────────────────────────────────────────────── */
      #name-panel {
        position: absolute;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(20,20,40,0.97);
        border: 1px solid rgba(74,158,255,0.4);
        border-radius: 12px;
        padding: 24px 28px;
        width: 360px;
        max-width: calc(100vw - 32px);
        pointer-events: auto;
        text-align: center;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      }
      #name-panel h2 {
        font-size: 1.3rem;
        color: #4a9eff;
        margin-bottom: 4px;
      }
      #name-panel > p {
        font-size: 0.82rem;
        color: #888;
        margin-bottom: 14px;
      }

      /* ── Character selector ─────────────────────────────────────── */
      .selector-section-label {
        font-size: 0.75rem;
        color: #7090c0;
        text-align: left;
        margin-bottom: 6px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      #char-grid {
        display: flex;
        gap: 8px;
        justify-content: center;
        margin-bottom: 14px;
      }
      .char-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(74,158,255,0.2);
        border-radius: 8px;
        padding: 8px 6px 6px;
        cursor: pointer;
        transition: border-color 0.15s, background 0.15s;
        width: 72px;
      }
      .char-card:hover { border-color: rgba(74,158,255,0.55); background: rgba(74,158,255,0.08); }
      .char-card.active { border-color: #4a9eff; background: rgba(74,158,255,0.15); }
      .char-thumb {
        display: block;
        width: 48px;
        height: 96px;
        /* sprite sheet: 4 frames × 16px wide, 32px tall → 3× = 192×96 */
        background-size: 192px 96px;
        /* "down" = frame 3, srcX=48 → at 3× offset = 144px */
        background-position: -144px 0;
        background-repeat: no-repeat;
        image-rendering: pixelated;
      }
      .char-card.active .char-thumb { filter: var(--char-thumb-filter, none); }
      .char-card-name {
        font-size: 0.7rem;
        color: #ccc;
        font-family: "Segoe UI", system-ui, sans-serif;
      }
      .char-card.active .char-card-name { color: #4a9eff; font-weight: 700; }

      /* ── Variant row ────────────────────────────────────────────── */
      #variant-grid {
        display: flex;
        gap: 7px;
        justify-content: center;
        margin-bottom: 16px;
      }
      .variant-btn {
        background: rgba(255,255,255,0.04);
        border: 1.5px solid rgba(74,158,255,0.2);
        border-radius: 50%;
        width: 34px;
        height: 34px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: border-color 0.15s, background 0.15s;
        padding: 0;
      }
      .variant-btn:hover { border-color: rgba(74,158,255,0.5); background: rgba(74,158,255,0.1); }
      .variant-btn.active { border-color: #4a9eff; background: rgba(74,158,255,0.18); }
      .variant-dot {
        display: block;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: url('${ASSET_BASE}pixelart/Modern tiles_Free/Characters_free/Adam_idle_16x16.png') -144px 0 / 192px 96px no-repeat;
        image-rendering: pixelated;
      }

      /* ── Name input ─────────────────────────────────────────────── */
      .name-input-label {
        font-size: 0.75rem;
        color: #7090c0;
        text-align: left;
        margin-bottom: 6px;
        margin-top: 4px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      #name-input {
        width: 100%;
        padding: 8px 12px;
        border-radius: 6px;
        border: 1px solid rgba(74,158,255,0.5);
        background: rgba(255,255,255,0.07);
        color: #e0e0e0;
        font-size: 1rem;
        margin-bottom: 10px;
        outline: none;
        box-sizing: border-box;
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
      #name-error {
        font-size: 0.8rem;
        color: #ff6b6b;
        margin-top: -6px;
        margin-bottom: 10px;
        min-height: 1.1em;
        text-align: left;
      }

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
      <p>Choose your character and display name to join the office</p>

      <p class="selector-section-label">Character</p>
      <div id="char-grid">${charCardsHtml}</div>

      <p class="selector-section-label">Color variant</p>
      <div id="variant-grid">${variantBtnsHtml}</div>

      <p class="name-input-label">Your display name</p>
      <input id="name-input" type="text" maxlength="24" placeholder="Your name…" autocomplete="off" />
      <p id="name-error"></p>
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
    nameError:    overlay.querySelector('#name-error')    as HTMLParagraphElement,
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

  // Apply saved variant filter to the active char card on load
  _applyVariantFilter(_selectedChar, _selectedVariant);

  // Character card clicks
  overlay.querySelectorAll<HTMLButtonElement>('.char-card').forEach(card => {
    card.addEventListener('click', () => {
      const char = card.dataset['char'] as CharacterName;
      if (!char) return;
      _selectedChar = char;
      overlay.querySelectorAll('.char-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      _applyVariantFilter(_selectedChar, _selectedVariant);
      _onCharacterSelect?.(_selectedChar, _selectedVariant);
    });
  });

  // Variant button clicks
  overlay.querySelectorAll<HTMLButtonElement>('.variant-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = Number(btn.dataset['variant']) as CharacterVariant;
      if (v < 1 || v > 6) return;
      _selectedVariant = v;
      overlay.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _applyVariantFilter(_selectedChar, _selectedVariant);
      _onCharacterSelect?.(_selectedChar, _selectedVariant);
    });
  });

  _refs.nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveNameEntry();
  });
  _refs.nameSaveBtn.addEventListener('click', saveNameEntry);

  _refs.copyBtn.addEventListener('click', () => {
    const btn = _refs!.copyBtn;
    const url = window.location.href;

    const showMessage = (text: string) => {
      btn.textContent = text;
      setTimeout(() => { btn.textContent = 'Copy invite link'; }, 1500);
    };

    const fallbackCopy = () => {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();

      let success = false;
      try {
        success = document.execCommand('copy');
      } catch {
        success = false;
      }

      document.body.removeChild(textarea);
      showMessage(success ? 'Copied!' : 'Copy failed');
    };

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(url)
        .then(() => {
          showMessage('Copied!');
        })
        .catch(() => {
          fallbackCopy();
        });
    } else {
      fallbackCopy();
    }
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

/**
 * Update the CSS filter on the active char card thumbnail to preview the
 * selected color variant, and update all variant dot backgrounds.
 */
function _applyVariantFilter(char: CharacterName, variant: CharacterVariant): void {
  const hue = VARIANT_HUE[variant];
  const filter = hue === 0 ? 'none' : `hue-rotate(${hue}deg)`;

  // Update all char card thumbs: inactive cards show original, active shows tinted
  document.querySelectorAll<HTMLElement>('.char-card').forEach(card => {
    const thumb = card.querySelector<HTMLElement>('.char-thumb');
    if (!thumb) return;
    const isActive = card.classList.contains('active');
    thumb.style.filter = isActive ? filter : 'none';
  });

  // Update variant dot backgrounds to show current char with each hue
  const spritePath = `${CHAR_BASE}/${char}_idle_16x16.png`;
  document.querySelectorAll<HTMLElement>('.variant-dot').forEach(dot => {
    dot.style.backgroundImage = `url('${ASSET_BASE}${spritePath}')`;
    const btn = dot.closest<HTMLButtonElement>('.variant-btn');
    const v = Number(btn?.dataset['variant']) as CharacterVariant;
    const dotHue = VARIANT_HUE[v] ?? 0;
    dot.style.filter = dotHue === 0 ? 'none' : `hue-rotate(${dotHue}deg)`;
  });
}

function saveNameEntry(): void {
  if (!_refs || !_onNameSave) return;
  const name = _refs.nameInput.value.trim();
  if (!name) {
    _refs.nameInput.focus();
    return;
  }
  if (_getTakenNames) {
    const taken = _getTakenNames();
    if (taken.has(name.toLowerCase())) {
      _refs.nameError.textContent = `"${name}" is already in use in this room (names are case-insensitive). Choose a different name.`;
      _refs.nameInput.focus();
      return;
    }
  }
  _refs.nameError.textContent = '';
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

/**
 * Show a brief toast notification that the player's name was auto-renamed
 * due to a conflict with another player who joined at the same time.
 */
export function showNameConflictToast(newName: string): void {
  const toast = document.createElement('div');
  toast.style.cssText = [
    'position:fixed', 'top:60px', 'left:50%', 'transform:translateX(-50%)',
    'background:rgba(30,20,10,0.92)', 'border:1px solid rgba(255,180,50,0.5)',
    'color:#ffcc44', 'border-radius:8px', 'padding:10px 20px',
    'font-size:0.85rem', 'font-family:Segoe UI,system-ui,sans-serif',
    'pointer-events:none', 'z-index:9999',
    'box-shadow:0 4px 16px rgba(0,0,0,0.5)',
  ].join(';');
  toast.textContent = `Name taken — you've been renamed to "${newName}"`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
