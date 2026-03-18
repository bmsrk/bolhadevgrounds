export type LoopCallback = (dt: number) => void;

let _animFrameId = 0;
let _lastTime = 0;

/**
 * Start the requestAnimationFrame game loop.
 * The callback receives delta-time in seconds (capped at 100 ms to avoid
 * spiral-of-death after tab focus returns).
 */
export function startLoop(callback: LoopCallback): void {
  function tick(now: number): void {
    const dt = Math.min((now - _lastTime) / 1000, 0.1);
    _lastTime = now;
    callback(dt);
    _animFrameId = requestAnimationFrame(tick);
  }
  _lastTime = performance.now();
  _animFrameId = requestAnimationFrame(tick);
}

export function stopLoop(): void {
  cancelAnimationFrame(_animFrameId);
}
