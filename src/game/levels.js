const book = (x, z, w, d, color = '#6b576c') => ({ type: 'book', x, z, w, d, color });
const cup = (x, z, r = 1.15) => ({ type: 'cup', x, z, r });
const shelter = (x, z) => ({ x, z, r: 1.2 });

export const LEVELS = [
  {
    name: 'Чужой стол', subtitle: 'Маленькая жизнь. Большая опасность.',
    time: 120, difficulty: 1, start: { x: -9.3, z: 6.1 }, exit: { x: 9.4, z: -5.9 },
    babies: [{ x: -8.3, z: 1.8 }, { x: -9.4, z: -5.9 }, { x: -0.8, z: -5.8 },
      { x: 5.9, z: -4.5 }, { x: 7.2, z: 3.5 }, { x: 9.3, z: 5.6 }],
    obstacles: [book(-4.5, -1, 3, 4.4), cup(3, -0.8), book(0, 5.3, 4.4, 1.7, '#b5674b'), { type: 'pot', x: 8.3, z: -0.7, r: 1.05 }],
    shelters: [shelter(-8.1, -3.8), shelter(0.2, -3.1), shelter(6.5, 5.4)],
    scanSpeed: 0.48, attentionRate: 0.5, strikeDelay: 1.35, handWait: 7.5,
  },
  {
    name: 'Кофейная пауза', subtitle: 'Человек не спит. И ты тоже.',
    time: 110, difficulty: 2, start: { x: -9.3, z: 6.1 }, exit: { x: 9.4, z: -5.9 },
    babies: [{ x: -8.4, z: -4.9 }, { x: -6.6, z: -6.8 }, { x: -1.6, z: 1.8 },
      { x: 0.3, z: 6.8 }, { x: 3.8, z: -6.1 }, { x: 6.8, z: -3.5 }, { x: 8, z: 4.5 }],
    obstacles: [book(-5.2, 0.7, 2.8, 4), cup(0, -3.9), book(4.3, 1.1, 3.2, 2.4, '#466c68'), { type: 'pot', x: 8.4, z: -1.3, r: 1.05 }],
    shelters: [shelter(-8.4, 0.4), shelter(-2.9, -5.6), shelter(1.3, 4.4), shelter(7, -4.8)],
    scanSpeed: 0.62, attentionRate: 0.62, strikeDelay: 1.2, handWait: 6.5,
  },
  {
    name: 'Последний свет', subtitle: 'Никого не оставим.',
    time: 100, difficulty: 3, start: { x: -9.3, z: 6.1 }, exit: { x: 9.4, z: -5.9 },
    babies: [{ x: -8.6, z: -5.8 }, { x: -5.9, z: -5.8 }, { x: -3.5, z: 3.7 },
      { x: -1, z: 6.7 }, { x: -0.8, z: -5.8 }, { x: 3.6, z: -5.5 }, { x: 4.6, z: 4.7 }, { x: 8.9, z: -2.5 }],
    obstacles: [book(-5.3, -1.5, 2.6, 4.5), cup(1.7, -1.4), book(3.1, 2.3, 3.1, 1.7, '#52617d'), { type: 'pot', x: 7.1, z: -6, r: 0.9 }],
    shelters: [shelter(-8.7, 0), shelter(-2.3, -2.9), shelter(0.5, 5.4), shelter(7.8, 1.8)],
    scanSpeed: 0.8, attentionRate: 0.78, strikeDelay: 1.05, handWait: 5.5,
  },
];

export const BOARD = { width: 24, depth: 18, radius: 0.34 };
