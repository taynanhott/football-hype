import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { mkdir, copyFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'apps/client/public/models');
await mkdir(output, { recursive: true });
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const positions = new Float32Array([
  -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5,
  0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
]);
const indices = new Uint16Array([
  0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 1, 2, 6, 1, 6, 5, 0, 4, 7,
  0, 7, 3,
]);
for (let level = 1; level <= 5; level++) {
  const document = new Document();
  const buffer = document.createBuffer();
  const scene = document.createScene();
  const position = document.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer);
  const index = document.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer);
  const green = document
    .createMaterial('Arquibancada')
    .setBaseColorFactor([0.16, 0.31, 0.25, 1])
    .setRoughnessFactor(0.8);
  const cream = document
    .createMaterial('Cobertura')
    .setBaseColorFactor([0.81, 0.83, 0.73, 1])
    .setMetallicFactor(0.25)
    .setRoughnessFactor(0.6);
  function box(name, scale, translation, material) {
    const mesh = document
      .createMesh(name)
      .addPrimitive(
        document
          .createPrimitive()
          .setAttribute('POSITION', position)
          .setIndices(index)
          .setMaterial(material),
      );
    scene.addChild(
      document.createNode(name).setMesh(mesh).setScale(scale).setTranslation(translation),
    );
  }
  for (let row = 0; row < 5 + level * 2; row++)
    box(`Degrau-${row}`, [1, 1.2, 2], [0, 1 + row * 0.7, -row * 0.95], row % 3 ? green : cream);
  box('Cobertura', [1.04, 0.5, 14 + level], [0, 8 + level, -6], cream);
  if (level >= 3)
    for (const side of [-1, 1])
      box(
        `Sustentação-${side}`,
        [0.008, 10 + level, 0.7],
        [side * 0.48, 5 + level / 2, -10],
        cream,
      );
  if (level >= 4)
    for (const side of [-1, 1]) {
      box(`Torre-${side}`, [0.01, 24, 0.7], [side * 0.49, 12, -4], cream);
      box(`Refletor-${side}`, [0.08, 2.8, 1], [side * 0.49, 24, -4], cream);
    }
  if (level === 5) box('Fachada', [1, 3, 0.5], [0, 4, -15], green);
  await document.transform(meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  await io.write(resolve(output, `stand-level-${level}.glb`), document);
}
const require = createRequire(resolve(root, 'apps/client/package.json'));
const three = resolve(dirname(require.resolve('three')), '..');
const decoders = resolve(root, 'apps/client/public/decoders/basis');
await mkdir(decoders, { recursive: true });
for (const file of ['basis_transcoder.js', 'basis_transcoder.wasm', 'README.md'])
  await copyFile(resolve(three, 'examples/jsm/libs/basis', file), resolve(decoders, file));
console.log('Cinco níveis glTF/Meshopt e decodificadores KTX2 preparados.');
