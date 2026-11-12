import { NiltonSantos } from './nilton-santos';
import { ArenaMrv } from './arena-mrv';
import { SaoJanuario } from './sao-januario';
import { Mineirao } from './mineirao';
import { ArenaGremio } from './arena-gremio';
import { Maracana } from './maracana';
import { ArenaBaixada } from './arena-baixada';
import { Morumbi } from './morumbi';
import { NeoQuimicaArena } from './neo-quimica-arena';
import { STADIUM_SKINS } from './stadium-catalog';
import { VilaBelmiro } from './vila-belmiro';
import { BufferGeometry, Float32BufferAttribute, CatmullRomCurve3, Vector3 } from 'three';
import { useMemo, useCallback } from 'react';
function Ribbon({
  inner,
  outer,
  y,
  color,
  rect = false,
  bottom,
  outerY,
  start = 0,
  end = Math.PI * 2,
}: {
  inner: [number, number];
  outer: [number, number];
  y: number;
  color: string;
  rect?: boolean;
  bottom?: number;
  outerY?: number;
  start?: number;
  end?: number;
}) {
  const geometry = useMemo(() => {
    const vertices: number[] = [];
    const point = (a: number, r: [number, number]) => {
      const c = Math.cos(a),
        s = Math.sin(a);
      return [
        r[0] * Math.sign(c) * Math.pow(Math.abs(c), rect ? 0.45 : 1),
        y,
        r[1] * Math.sign(s) * Math.pow(Math.abs(s), rect ? 0.45 : 1),
      ];
    };
    for (let i = 0; i < 64; i++) {
      const a = start + (i / 64) * (end - start),
        b = start + ((i + 1) / 64) * (end - start);
      const p = point(a, inner),
        q = point(b, inner),
        r = point(a, outer),
        t = point(b, outer);
      r[1] = outerY ?? y;
      t[1] = outerY ?? y;
      vertices.push(...p, ...r, ...q, ...q, ...r, ...t);
      if (bottom !== undefined) {
        const low = (v: number[]) => [v[0]!, bottom, v[2]!];
        vertices.push(...p, ...q, ...low(p), ...q, ...low(q), ...low(p));
        vertices.push(...r, ...low(r), ...t, ...t, ...low(r), ...low(t));
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    g.computeVertexNormals();
    return g;
  }, [inner, outer, y, rect, bottom, outerY, start, end]);
  return (
    <mesh geometry={geometry} receiveShadow castShadow>
      <meshStandardMaterial color={color} side={2} roughness={0.65} />
    </mesh>
  );
}

function Beam({
  a,
  b,
  r = 0.4,
  color = '#e1e4df',
}: {
  a: [number, number, number];
  b: [number, number, number];
  r?: number;
  color?: string;
}) {
  const curve = useMemo(() => new CatmullRomCurve3([new Vector3(...a), new Vector3(...b)]), [a, b]);
  return (
    <mesh castShadow>
      <tubeGeometry args={[curve, 1, r, 5, false]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}
function RoofArch({ side, transverse = false }: { side: number; transverse?: boolean }) {
  const center = transverse ? (side === 1 ? Math.PI / 2 : Math.PI * 1.5) : side === 1 ? 0 : Math.PI;
  const point = useCallback(
    (t: number, raised: boolean): [number, number, number] => {
      const angle = center - Math.PI / 4 + (t * Math.PI) / 2;
      return [
        87 * Math.cos(angle),
        30.8 + (raised ? 22 * Math.sin(Math.PI * t) : 0),
        113 * Math.sin(angle),
      ];
    },
    [center],
  );
  const curve = useMemo(
    () =>
      new CatmullRomCurve3(
        Array.from({ length: 33 }, (_, i) => new Vector3(...point(i / 32, true))),
      ),
    [point],
  );
  return (
    <group>
      <mesh castShadow>
        <tubeGeometry args={[curve, 48, 1.1, 8, false]} />
        <meshStandardMaterial color="#ecefe9" />
      </mesh>
      {[0, 1].map((t) => {
        const p = point(t, false);
        return (
          <mesh key={t} position={[p[0], 30.3, p[2]]}>
            <boxGeometry args={[4, 1.4, 4]} />
            <meshStandardMaterial color="#c1c8be" />
          </mesh>
        );
      })}
      {Array.from({ length: 15 }, (_, i) => {
        const t = (i + 1) / 16;
        return <Beam key={i} a={point(t, true)} b={point(t, false)} r={0.23} />;
      })}
    </group>
  );
}

function LeafRoof({ angle }: { angle: number }) {
  const geometry = useMemo(() => {
    const v: number[] = [];
    const pt = (t: number, side: number) => {
      const r = 110 + 7 * Math.sin(Math.PI * t) - 43 * t * t,
        y = 2 + 29 * Math.sin((t * Math.PI) / 2),
        a = angle + side * 0.046 * Math.pow(Math.sin(Math.PI * t), 0.45);
      return [Math.cos(a) * r, y, Math.sin(a) * r * (116 / 110)];
    };
    for (let i = 0; i < 16; i++) {
      const a = pt(i / 16, -1),
        b = pt(i / 16, 1),
        c = pt((i + 1) / 16, -1),
        d = pt((i + 1) / 16, 1);
      v.push(...a, ...b, ...c, ...b, ...d, ...c);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(v, 3));
    g.computeVertexNormals();
    return g;
  }, [angle]);
  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial color="#f0eee5" side={2} roughness={0.55} />
    </mesh>
  );
}

function PalmeirasCladding() {
  const geometry = useMemo(() => {
    const vertices: number[] = [],
      colors: number[] = [];
    const point = (a: number, y: number, offset: number) => [
      (82 + offset) * Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** 0.45,
      y,
      (102 + offset) * Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** 0.45,
    ];
    // Staggered metal scales are batched into one mesh instead of hundreds of boxes.
    for (let row = 0; row < 32; row++) {
      const bulge = Math.sin((row / 31) * Math.PI) * 0.8;
      for (let i = 0; i < 256; i++) {
        const a = ((i + (row % 2) * 0.5) / 256) * Math.PI * 2;
        const b = a + ((Math.PI * 2) / 256) * 0.92;
        const y = 4 + row * 0.78;
        const p = point(a, y, bulge),
          q = point(b, y, bulge);
        const r = point(a, y + 0.7, bulge + 0.15),
          s = point(b, y + 0.7, bulge + 0.15);
        vertices.push(...p, ...r, ...q, ...q, ...r, ...s);
        const shade = 0.42 + (((i * 17 + row * 31) % 11) / 11) * 0.3;
        for (let v = 0; v < 6; v++) colors.push(shade * 0.97, shade, shade * 1.02);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    g.setAttribute('color', new Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial vertexColors metalness={0.65} roughness={0.48} side={2} />
    </mesh>
  );
}

function PalmeirasPark({ accent }: { accent: string }) {
  return (
    <group name="Parque do Palmeiras — fachada metálica">
      {Array.from({ length: 40 }, (_, i) => {
        const tier = i < 20 ? 0 : 1,
          row = i % 20,
          d = tier * 17 + row * 0.7;
        return (
          <Ribbon
            key={i}
            inner={[41 + d, 61 + d]}
            outer={[41.8 + d, 61.8 + d]}
            y={1 + tier * 14 + row * 0.6}
            bottom={tier * 14 + row * 0.6}
            color={row % 8 === 0 ? '#d8ddd3' : '#236b48'}
            rect
          />
        );
      })}
      <Ribbon inner={[73, 93]} outer={[81.8, 101.8]} y={28.5} bottom={3.5} color="#414b48" rect />
      <Ribbon inner={[53, 73]} outer={[84, 104]} y={30.8} outerY={29.3} color="#eeeee8" rect />
      <Ribbon inner={[44, 64]} outer={[53, 73]} y={29.6} outerY={30.8} color="#b8c5c5" rect />
      <Ribbon inner={[54.5, 74.5]} outer={[57, 77]} y={13.6} bottom={11.8} color="#303b37" rect />
      <PalmeirasCladding />
      {Array.from({ length: 64 }, (_, i) => {
        const a = (i / 64) * Math.PI * 2;
        const x = Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** 0.45;
        const z = Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** 0.45;
        return (
          <group key={i}>
            <Beam a={[x * 44, 30.2, z * 64]} b={[x * 84, 30.2, z * 104]} r={0.1} />
            <Beam a={[x * 44, 27.5, z * 64]} b={[x * 57, 29.3, z * 77]} r={0.15} />
          </group>
        );
      })}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <group key={sx + ':' + sz}>
            <mesh
              position={[sx * 73, 15, sz * 89]}
              rotation={[0, (-sx * sz * Math.PI) / 4, 0]}
              castShadow
            >
              <boxGeometry args={[5, 30, 14]} />
              <meshStandardMaterial color="#087447" />
            </mesh>
            {[-1, 1].map((edge) => {
              const a: [number, number, number] = [sx * (73 + edge * 4), 30, sz * (91 - edge * 4)];
              const b: [number, number, number] = [sx * (43 + edge * 4), 30, sz * (64 - edge * 4)];
              const peak: [number, number, number] = [
                sx * (63 + edge * 4),
                39,
                sz * (82 - edge * 4),
              ];
              return (
                <group key={edge}>
                  <Beam a={a} b={b} r={0.25} />
                  <Beam a={a} b={peak} r={0.3} />
                  <Beam a={peak} b={b} r={0.3} />
                  {Array.from({ length: 5 }, (_, j) => {
                    const t = (j + 1) / 6;
                    const base = a.map((v, k) => v + (b[k]! - v) * t) as [number, number, number];
                    return <Beam key={j} a={base} b={peak} r={0.13} />;
                  })}
                </group>
              );
            })}
            <Beam a={[sx * 59, 39, sz * 86]} b={[sx * 67, 39, sz * 78]} r={0.25} />
          </group>
        )),
      )}
      <mesh position={[0, 18, 102.8]}>
        <boxGeometry args={[29, 6, 0.4]} />
        <meshStandardMaterial color="#e4efeb" />
      </mesh>
      <Ribbon inner={[81, 101]} outer={[82, 102]} y={3.5} bottom={2.5} color={accent} rect />
    </group>
  );
}

export function RealStadium({ skin }: { skin: string }) {
  if (skin === 'nilton-santos') return <NiltonSantos />;
  if (skin === 'arena-mrv') return <ArenaMrv />;
  if (skin === 'mineirao') return <Mineirao />;
  if (skin === 'arena-gremio') return <ArenaGremio />;
  if (skin === 'maracana') return <Maracana />;
  if (skin === 'morumbi') return <Morumbi />;
  if (skin === 'vila-belmiro') return <VilaBelmiro />;
  const accent = STADIUM_SKINS.find((model) => model[0] === skin)?.[2] ?? '#315d55';
  if (skin === 'palmeiras-park') return <PalmeirasPark accent={accent} />;
  if (skin === 'arena-baixada') return <ArenaBaixada />;
  if (skin === 'sao-januario') return <SaoJanuario />;
  if (skin === 'neo-quimica') return <NeoQuimicaArena />;
  const model = STADIUM_SKINS.find((s) => s[0] === skin) ?? STADIUM_SKINS[0];
  const rect = ['arena-mrv', 'neo-quimica'].includes(skin),
    open = skin === 'sao-januario';
  const h = open ? 15 : skin === 'arena-mrv' ? 33 : 29;
  const circular = skin === 'maracana' || skin === 'mineirao' || skin === 'beira-rio';
  const x = open ? 85 : circular ? 110 : skin === 'arena-mrv' ? 80 : 100,
    z = open ? 116 : circular ? 116 : skin === 'arena-mrv' ? 100 : 137;
  const xy = (a: number, rx: number, rz: number): [number, number] => [
    rx * Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), rect ? 0.45 : 1),
    rz * Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), rect ? 0.45 : 1),
  ];
  // Rounded rectangular bowls can follow the touchlines closely; oval bowls
  // need enough diagonal clearance to keep the pitch corners unobstructed.
  const frontX = rect ? 41 : skin === 'nilton-santos' ? 58 : 51;
  const frontZ = rect ? 61 : skin === 'nilton-santos' ? 85 : 77;
  const roofInnerX = circular ? 67 : frontX + 1;
  const roofInnerZ = circular ? 67 : frontZ + 1;
  const start = open ? 0.15 : 0,
    end = open ? Math.PI * 1.85 : Math.PI * 2;
  return (
    <group name={model[1]}>
      {skin !== 'arena-mrv' && (
        <Ribbon
          inner={[x - 0.6, z - 0.6]}
          outer={[x + 0.4, z + 0.4]}
          y={4}
          bottom={3}
          color={accent}
          rect={rect}
        />
      )}
      {skin === 'beira-rio' &&
        Array.from({ length: 65 }, (_, i) => <LeafRoof key={i} angle={(i / 65) * Math.PI * 2} />)}
      <Ribbon
        inner={[39, 57]}
        outer={[frontX, frontZ]}
        y={0.12}
        color={skin === 'nilton-santos' ? '#ac6555' : '#778279'}
        rect={rect}
      />
      {skin !== 'nilton-santos' &&
        skin !== 'mineirao' &&
        skin !== 'beira-rio' &&
        skin !== 'arena-mrv' && (
          <Ribbon
            inner={[x - 2, z - 2]}
            outer={[x, z]}
            y={h}
            bottom={0}
            color={skin === 'arena-mrv' ? '#373c40' : '#b7bbb6'}
            rect={rect}
            start={start}
            end={end}
          />
        )}
      {Array.from({ length: open ? 22 : 40 }, (_, i) => {
        const tier = i < 20 ? 0 : 1,
          row = i % 20,
          offset = tier * 18 + row * 0.76;
        return (
          <Ribbon
            key={i}
            inner={[frontX + offset * (circular ? 1.5 : 1), frontZ + offset * (circular ? 0.7 : 1)]}
            outer={[
              frontX + (offset + 0.8) * (circular ? 1.5 : 1),
              frontZ + (offset + 0.8) * (circular ? 0.7 : 1),
            ]}
            y={1 + row * 0.57 + tier * 15}
            bottom={row === 0 ? 0 : row * 0.57 + tier * 15}
            color={
              i % 20 === 0
                ? '#a5aaa4'
                : skin === 'maracana'
                  ? tier
                    ? '#dfca73'
                    : '#7eadd2'
                  : model[2]
            }
            rect={rect}
            start={start}
            end={end}
          />
        );
      })}
      {(skin === 'arena-mrv' || skin === 'arena-gremio') && (
        <>
          <Ribbon
            inner={[frontX + 32.3, frontZ + 32.3]}
            outer={[x - 1, z - 1]}
            y={26.9}
            bottom={25.8}
            color="#949c95"
            rect={rect}
          />
          <Ribbon
            inner={[frontX + 32.3, frontZ + 32.3]}
            outer={[frontX + 33.1, frontZ + 33.1]}
            y={h + 0.3}
            bottom={26.8}
            color={skin === 'arena-mrv' ? '#454a48' : '#748f9e'}
            rect={rect}
          />
        </>
      )}
      {!open && skin !== 'arena-mrv' && (
        <Ribbon
          inner={[roofInnerX, roofInnerZ]}
          outer={[x + 5, z + 5]}
          y={h + 1}
          bottom={h + 0.3}
          color="#e8ebe5"
          rect={rect}
        />
      )}
      {Array.from({ length: skin === 'mineirao' ? 88 : 72 }, (_, i) => {
        const a = (i / (skin === 'mineirao' ? 88 : 72)) * Math.PI * 2,
          [px, pz] = xy(a, x, z),
          [ix, iz] = xy(a, roofInnerX, roofInnerZ);
        return (
          <group key={i}>
            {skin !== 'arena-mrv' && (
              <Beam
                a={[px, 0, pz]}
                b={[px, h, pz]}
                r={skin === 'mineirao' ? 1.3 : 0.55}
                color={skin === 'maracana' ? '#7da4bc' : '#d8dcd5'}
              />
            )}
            {!open && skin !== 'arena-mrv' && (
              <Beam
                a={[px, h + 1.5, pz]}
                b={[ix, h + 1.5, iz]}
                r={skin === 'mineirao' ? 0.45 : 0.18}
              />
            )}
          </group>
        );
      })}
      {(skin === 'nilton-santos' || skin === 'mineirao' || skin === 'beira-rio') &&
        [4, 10, 16, 22, 28].map((y) => (
          <Ribbon
            key={y}
            inner={[x - 4, z - 4]}
            outer={[x, z]}
            y={y}
            bottom={y - 1.1}
            color="#b6b8ac"
          />
        ))}
      {skin === 'nilton-santos' &&
        [-1, 1].map((side) => <RoofArch key={'short' + side} side={side} transverse />)}
      {skin === 'nilton-santos' &&
        [-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => (
            <group key={sx + ':' + sz} position={[sx * 76, 0, sz * 112]}>
              <mesh position={[0, 13, 0]}>
                <cylinderGeometry args={[9, 9, 26, 24, 1, true]} />
                <meshStandardMaterial color="#d0d1c6" side={2} />
              </mesh>
              {[3, 8, 13, 18, 23].map((y) => (
                <mesh key={y} position={[0, y, 0]}>
                  <cylinderGeometry args={[9.4, 9.4, 1, 24]} />
                  <meshStandardMaterial color="#b8baaf" />
                </mesh>
              ))}
            </group>
          )),
        )}
      {skin === 'nilton-santos' && [-1, 1].map((side) => <RoofArch key={side} side={side} />)}
      {skin === 'arena-gremio' &&
        [5, 10, 15].map((y) => (
          <Ribbon
            key={y}
            inner={[99.8, 136.8]}
            outer={[100.4, 137.4]}
            y={y}
            bottom={y - 1.8}
            color="#3177a0"
            rect={rect}
          />
        ))}
      {skin === 'neo-quimica' &&
        [-1, 1].map((side) => (
          <mesh key={side} position={[side * 99, 15, 0]}>
            <boxGeometry args={[4, 30, 175]} />
            <meshStandardMaterial color="#eef0eb" metalness={0.25} roughness={0.3} />
          </mesh>
        ))}
      {open && (
        <group position={[0, 0, 114]}>
          <mesh position={[0, 5, 0]}>
            <boxGeometry args={[90, 10, 8]} />
            <meshStandardMaterial color="#e5d9bc" />
          </mesh>
          {[-32, 0, 32].map((x) => (
            <mesh key={x} position={[x, 11, 0]}>
              <boxGeometry args={[8, 12, 9]} />
              <meshStandardMaterial color="#efe8d6" />
            </mesh>
          ))}
        </group>
      )}
      {[-1, 1].map((side) => {
        const screenY = open ? 17 : h - 4;
        const screenZ = open ? 103 : roofInnerZ + 1.5;
        const hangerHeight = open ? 5 : h + 1 - (screenY + 4);
        return (
          <group key={side} position={[0, screenY, side * screenZ]}>
            {[-7, 7].map((x) => (
              <mesh key={x} position={[x, 4 + hangerHeight / 2, 0]}>
                <boxGeometry args={[0.45, hangerHeight, 0.45]} />
                <meshStandardMaterial color="#626d69" />
              </mesh>
            ))}
            <mesh castShadow>
              <boxGeometry args={[18, 8, 1]} />
              <meshStandardMaterial color="#1c2d32" />
            </mesh>
            <mesh position={[0, 0, -side * 0.6]}>
              <boxGeometry args={[16, 6, 0.1]} />
              <meshStandardMaterial color="#6b9b91" emissive="#24483c" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
