export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
}

const _state: InputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  sprint: false,
};

const KEY_MAP: Record<string, keyof InputState> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
};

function onKeyDown(e: KeyboardEvent): void {
  const key = KEY_MAP[e.code];
  if (key !== undefined) {
    _state[key] = true;
    // Prevent arrow keys from scrolling the page
    if (e.code.startsWith('Arrow')) e.preventDefault();
  }
}

function onKeyUp(e: KeyboardEvent): void {
  const key = KEY_MAP[e.code];
  if (key !== undefined) {
    _state[key] = false;
  }
}

export function initInput(): void {
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
}

export function getInput(): Readonly<InputState> {
  return _state;
}
