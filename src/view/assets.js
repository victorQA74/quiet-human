import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const CHARACTER_FILES = Object.freeze({ hand: 'models/hand.glb', spider: 'models/spider.glb' });
export async function loadCharacterAssets(onProgress = () => {}, load = null) {
  const loader = new GLTFLoader();
  const read = load ?? (path => loader.loadAsync(`${import.meta.env.BASE_URL}${path}`));
  const entries = Object.entries(CHARACTER_FILES); let done = 0;
  const results = await Promise.all(entries.map(async ([name, path]) => {
    const asset = await read(path);
    let skins = 0; asset.scene.traverse(o => { if (o.isSkinnedMesh) skins++; });
    if (!skins) throw new Error(`В модели ${name} отсутствует скелет`);
    onProgress(++done / entries.length);
    return [name, asset];
  }));
  return Object.fromEntries(results);
}
