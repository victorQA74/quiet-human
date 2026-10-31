export class GameInput {
  constructor(canvas, scene, commands) {
    this.keys = new Set(); this.axis = { x: 0, z: 0 }; this.scene = scene; this.commands = commands;
    window.addEventListener('keydown', e => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.target instanceof HTMLButtonElement && ['Space', 'Enter'].includes(e.code)) return;
      this.keys.add(e.code);
      if (e.repeat) return;
      if (e.code === 'Space') commands.web();
      if (e.code === 'Escape' || e.code === 'KeyP') commands.pause();
      if (e.code === 'KeyQ') scene.rotate(-Math.PI / 8);
      if (e.code === 'KeyE') scene.rotate(Math.PI / 8);
      if (e.code === 'KeyC') scene.resetCamera();
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.clear(); commands.blur(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.clear(); commands.blur(); } });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => {
      this.pointer = { x: e.clientX, y: e.clientY, lastX: e.clientX, button: e.button };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', e => {
      if (this.pointer?.button === 2) { scene.rotate(-(e.clientX - this.pointer.lastX) * 0.005); this.pointer.lastX = e.clientX; }
    });
    canvas.addEventListener('pointerup', e => {
      if (this.pointer && this.pointer.button === 0 && Math.hypot(e.clientX - this.pointer.x, e.clientY - this.pointer.y) < 15) {
        const target = scene.world(e.clientX, e.clientY); if (target) commands.destination(target);
      }
      this.pointer = null;
    });
    const joy = document.getElementById('joystick'), stick = document.getElementById('stick');
    const update = e => {
      const rect = joy.getBoundingClientRect(); let x = e.clientX - rect.left - rect.width / 2, y = e.clientY - rect.top - rect.height / 2;
      const distance = Math.hypot(x, y), max = rect.width * 0.31;
      if (distance > max) { x *= max / distance; y *= max / distance; }
      this.axis = { x: x / max, z: y / max }; stick.style.transform = `translate(${x}px,${y}px)`;
    };
    joy.addEventListener('pointerdown', e => { e.preventDefault(); this.joyId = e.pointerId; joy.setPointerCapture(e.pointerId); update(e); });
    joy.addEventListener('pointermove', e => { if (this.joyId === e.pointerId) update(e); });
    const release = () => { this.joyId = null; this.axis = { x: 0, z: 0 }; stick.style.transform = ''; };
    joy.addEventListener('pointerup', release); joy.addEventListener('pointercancel', release); joy.addEventListener('lostpointercapture', release);
  }
  clear() { this.keys.clear(); this.axis = { x: 0, z: 0 }; this.pointer = null; }
  sample() {
    const k = this.keys;
    const x = this.axis.x + (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const z = this.axis.z + (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    const a = this.scene.yaw;
    return { x: x * Math.cos(a) + z * Math.sin(a), z: -x * Math.sin(a) + z * Math.cos(a) };
  }
}
