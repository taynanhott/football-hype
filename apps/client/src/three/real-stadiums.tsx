import { STADIUM_SKINS } from './stadium-catalog';
import { BufferGeometry, Float32BufferAttribute, CatmullRomCurve3, Vector3 } from 'three';
import { useMemo, useCallback } from 'react';
function Ribbon({
  inner,
  outer,
  y,
  color,
  rect = false,
  bottom,
  start = 0,
  end = Math.PI * 2,
}: {
  inner: [number, number];
  outer: [number, number];
  y: number;
  color: string;
  rect?: boolean;
  bottom?: number;
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
  }, [inner, outer, y, rect, bottom, start, end]);
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

function CorinthiansArena() {
  return (
    <group name="Neo Química Arena — tribunas independentes">
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 69, 14, 0]} castShadow>
            <boxGeometry args={[16, 28, 143]} />
            <meshStandardMaterial color={side === 1 ? '#d9e2e0' : '#f1f1e9'} metalness={0.15} />
          </mesh>
          {Array.from({ length: 32 }, (_, row) => (
            <mesh key={row} position={[side * (40 + row * 0.75), 1 + row * 0.7, 0]} receiveShadow>
              <boxGeometry args={[0.82, 0.8, 114]} />
              <meshStandardMaterial color={row % 8 === 0 ? '#929994' : '#e0e2dd'} />
            </mesh>
          ))}
          <mesh position={[side * 58, 29, 0]} castShadow>
            <boxGeometry args={[43, 2.2, 155]} />
            <meshStandardMaterial color="#f2f3ed" metalness={0.25} />
          </mesh>
          {Array.from({ length: 15 }, (_, n) => (
            <Beam
              key={n}
              a={[side * 78, 28, -70 + n * 10]}
              b={[side * 37, 28, -70 + n * 10]}
              r={0.25}
            />
          ))}
          {Array.from({ length: 16 }, (_, n) => (
            <mesh key={'glass' + n} position={[side * 77.1, 15, -65 + n * 8.6]}>
              <boxGeometry args={[0.2, 19, 7.6]} />
              <meshStandardMaterial
                color={side === 1 ? '#93afb4' : '#dce2de'}
                metalness={0.4}
                roughness={0.3}
              />
            </mesh>
          ))}
          <group position={[0, 0, side * 60]}>
            {Array.from({ length: 21 }, (_, row) => (
              <mesh key={row} position={[0, 1 + row * 0.6, side * row * 0.8]}>
                <boxGeometry args={[79, 0.7, 0.9]} />
                <meshStandardMaterial color={row % 7 === 0 ? '#929994' : '#d8ded9'} />
              </mesh>
            ))}
            <mesh position={[0, 7, side * 19]}>
              <boxGeometry args={[83, 14, 3]} />
              <meshStandardMaterial color="#cdd2cc" />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

function SaoJanuario({ accent }: { accent: string }) {
  return (
    <group name="São Januário — ferradura e tribuna histórica">
      {/* Curved north end joins two straight touchline terraces. The south end stays open. */}
      {Array.from({ length: 24 }, (_, row) => {
        const y = 1 + row * 0.48,
          x = 46 + row * 0.8,
          z = 79 + row * 0.8;
        return (
          <group key={row}>
            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * x, y, 0]} receiveShadow>
                <boxGeometry args={[0.9, 0.65, 116]} />
                <meshStandardMaterial color={side === -1 ? '#e5e4db' : '#252b2d'} />
              </mesh>
            ))}
            <Ribbon
              inner={[x, z]}
              outer={[x + 0.85, z + 0.85]}
              y={y}
              bottom={y - 0.55}
              color={row < 9 ? '#e1e1d8' : '#252b2d'}
              start={Math.PI}
              end={Math.PI * 2}
            />
          </group>
        );
      })}
      <Ribbon
        inner={[65, 98]}
        outer={[68, 101]}
        y={12.8}
        bottom={0}
        color="#c8c8b9"
        start={Math.PI}
        end={Math.PI * 2}
      />
      <Ribbon
        inner={[46, 79]}
        outer={[65, 98]}
        y={12.9}
        color="#f1f0e4"
        start={Math.PI * 1.36}
        end={Math.PI * 1.64}
      />
      {/* Red cross on the white northern seating mosaic. */}
      <group position={[0, 13.1, -88]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh>
          <planeGeometry args={[5, 17]} />
          <meshStandardMaterial color="#b81626" side={2} />
        </mesh>
        <mesh>
          <planeGeometry args={[15, 5]} />
          <meshStandardMaterial color="#b81626" side={2} />
        </mesh>
      </group>
      <mesh position={[68, 6, 0]}>
        <boxGeometry args={[2, 12, 118]} />
        <meshStandardMaterial color="#dad9ca" />
      </mesh>
      <mesh position={[-60, 8, 0]}>
        <boxGeometry args={[8, 16, 118]} />
        <meshStandardMaterial color="#e5dfcd" />
      </mesh>
      <mesh position={[-52, 17, 0]} castShadow>
        <boxGeometry args={[26, 1.2, 124]} />
        <meshStandardMaterial color="#535a56" />
      </mesh>
      {Array.from({ length: 16 }, (_, i) => (
        <group key={i}>
          <Beam a={[-64, 0, -57 + i * 7.6]} b={[-64, 17, -57 + i * 7.6]} r={0.3} />
          <Beam a={[-64, 17, -57 + i * 7.6]} b={[-39, 17, -57 + i * 7.6]} r={0.25} />
        </group>
      ))}
      {/* Historic pale facade, repeated arched windows and raised central entrance. */}
      <mesh position={[-65, 5, 0]}>
        <boxGeometry args={[3, 10, 122]} />
        <meshStandardMaterial color="#ede4ce" />
      </mesh>
      {Array.from({ length: 19 }, (_, i) => (
        <group key={i} position={[-66.6, 0, -54 + i * 6]}>
          <mesh position={[0, 5, 0]}>
            <boxGeometry args={[0.15, 4, 2.4]} />
            <meshStandardMaterial color="#41605a" />
          </mesh>
          <mesh position={[-0.1, 7.1, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[1.2, 1.2, 0.2, 12, 1, false, 0, Math.PI]} />
            <meshStandardMaterial color="#47655c" />
          </mesh>
        </group>
      ))}
      <mesh position={[-67, 8, 0]}>
        <boxGeometry args={[5, 16, 12]} />
        <meshStandardMaterial color="#efe6cd" />
      </mesh>
      <mesh position={[-67, 17, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[8, 4, 4]} />
        <meshStandardMaterial color="#916f54" />
      </mesh>
      <mesh position={[0, 0.1, 66]}>
        <boxGeometry args={[79, 0.2, 12]} />
        <meshStandardMaterial color="#9b9e8b" />
      </mesh>
      <group position={[0, 12, 72]}>
        <mesh>
          <boxGeometry args={[17, 7, 1]} />
          <meshStandardMaterial color="#172a2d" />
        </mesh>
        {[-6, 6].map((x) => (
          <Beam key={x} a={[x, -12, 0]} b={[x, -3.5, 0]} r={0.35} />
        ))}
      </group>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 28, 0, 64]}>
          <mesh position={[0, 1.8, 0]}>
            <boxGeometry args={[12, 3.6, 4]} />
            <meshStandardMaterial color="#7e9a94" transparent opacity={0.6} />
          </mesh>
          <mesh position={[0, 3.8, 0]}>
            <boxGeometry args={[13, 0.3, 5]} />
            <meshStandardMaterial color={accent} />
          </mesh>
        </group>
      ))}
      <mesh position={[68, 12.3, 0]}>
        <boxGeometry args={[0.5, 0.6, 120]} />
        <meshStandardMaterial color="#b91b2d" />
      </mesh>
    </group>
  );
}

function HistoricBrazilianStadium({ kind, accent }: { kind: string; accent: string }) {
  const morumbi = kind === 'morumbi',
    baixada = kind === 'arena-baixada';
  if (morumbi)
    return (
      <group name="Morumbi — três anéis descobertos">
        <Ribbon inner={[39, 57]} outer={[54, 79]} y={0.15} color="#8c4547" />
        {Array.from({ length: 57 }, (_, i) => {
          const tier = Math.floor(i / 19),
            row = i % 19,
            d = tier * 16 + row * 0.75;
          return (
            <Ribbon
              key={i}
              inner={[54 + d, 79 + d]}
              outer={[54.85 + d, 79.85 + d]}
              y={1 + tier * 12 + row * 0.55}
              bottom={tier * 12 + row * 0.55}
              color={row === 0 ? '#bfbcb0' : i % 3 === 0 ? '#c1b5a2' : '#a54446'}
            />
          );
        })}
        <Ribbon inner={[98, 123]} outer={[101, 126]} y={35} bottom={0} color="#a7aaa1" />
        {[8, 20, 32].map((y) => (
          <Ribbon
            key={y}
            inner={[99, 124]}
            outer={[101, 126]}
            y={y}
            bottom={y - 2}
            color="#bfc0b5"
          />
        ))}
        {Array.from({ length: 48 }, (_, i) => {
          const a = (i / 48) * Math.PI * 2;
          return (
            <Beam
              key={i}
              a={[100 * Math.cos(a), 0, 125 * Math.sin(a)]}
              b={[100 * Math.cos(a), 35, 125 * Math.sin(a)]}
              r={0.6}
            />
          );
        })}
        {[-1, 1].map((side) => (
          <group key={side} position={[0, 38, side * 122]}>
            <mesh>
              <boxGeometry args={[24, 10, 1]} />
              <meshStandardMaterial color="#1d292d" />
            </mesh>
            <Beam a={[-10, -9, 0]} b={[-10, -5, 0]} r={0.5} />
            <Beam a={[10, -9, 0]} b={[10, -5, 0]} r={0.5} />
          </group>
        ))}
      </group>
    );
  const rows = baixada ? 30 : 22;
  return (
    <group name={baixada ? 'Arena da Baixada — cobertura metálica' : 'Vila Belmiro — alçapão'}>
      {[-1, 1].map((side) => (
        <group key={side}>
          {Array.from({ length: rows }, (_, r) => (
            <group key={r}>
              <mesh position={[side * (40 + r * 0.72), 1 + r * 0.58, 0]}>
                <boxGeometry args={[0.8, 0.65, 116]} />
                <meshStandardMaterial color={baixada ? '#bc2634' : '#303638'} />
              </mesh>
              <mesh position={[0, 1 + r * 0.58, side * (59 + r * 0.72)]}>
                <boxGeometry args={[79, 0.65, 0.8]} />
                <meshStandardMaterial color={baixada ? '#bc2634' : '#353a3b'} />
              </mesh>
            </group>
          ))}
          <mesh position={[side * (baixada ? 66 : 58), 10, 0]}>
            <boxGeometry args={[5, 20, baixada ? 174 : 158]} />
            <meshStandardMaterial color="#e4e6de" />
          </mesh>
          <mesh position={[0, 10, side * (baixada ? 85 : 77)]}>
            <boxGeometry args={[baixada ? 138 : 122, 20, 4]} />
            <meshStandardMaterial color="#e4e6de" />
          </mesh>
          {[5, 12].map((y) => (
            <mesh key={y} position={[side * (baixada ? 68.6 : 60.6), y, 0]}>
              <boxGeometry args={[0.2, 2, 150]} />
              <meshStandardMaterial color={baixada ? '#657776' : '#202a2d'} />
            </mesh>
          ))}
          <mesh position={[side * (baixada ? 53 : 52), baixada ? 26 : 19, 0]} castShadow>
            <boxGeometry args={[baixada ? 34 : 15, 1.2, baixada ? 174 : 120]} />
            <meshStandardMaterial color={baixada ? '#9da7a5' : '#e4e5d8'} />
          </mesh>
          {baixada && (
            <mesh position={[0, 26, side * 74]} castShadow>
              <boxGeometry args={[74, 1.2, 30]} />
              <meshStandardMaterial color="#a8afac" />
            </mesh>
          )}
          {Array.from({ length: 13 }, (_, i) => (
            <group key={i}>
              <Beam
                a={[side * (baixada ? 69 : 61), 0, -72 + i * 12]}
                b={[side * (baixada ? 69 : 61), baixada ? 26 : 20, -72 + i * 12]}
                r={0.35}
              />
              {baixada && (
                <Beam a={[side * 37, 24, -72 + i * 12]} b={[side * 68, 24, -72 + i * 12]} r={0.4} />
              )}
            </group>
          ))}
          <mesh position={[side * (baixada ? 69 : 61), 18, 0]}>
            <boxGeometry args={[0.3, 0.8, 145]} />
            <meshStandardMaterial color={accent} />
          </mesh>
        </group>
      ))}
    </group>
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
      <Ribbon inner={[73, 93]} outer={[81, 101]} y={26.8} bottom={0} color="#777f7b" rect />
      <Ribbon inner={[42, 62]} outer={[84, 104]} y={30} bottom={29} color="#e4e8e1" rect />
      {Array.from({ length: 88 }, (_, i) => {
        const a = (i / 88) * Math.PI * 2,
          c = Math.cos(a),
          z = Math.sin(a),
          x = 82 * Math.sign(c) * Math.pow(Math.abs(c), 0.45),
          depth = 102 * Math.sign(z) * Math.pow(Math.abs(z), 0.45);
        return (
          <group key={i} position={[x, 0, depth]} rotation={[0, -a, 0]}>
            {Array.from({ length: 7 }, (_, j) => (
              <mesh key={j} position={[0, 2 + j * 4, 0]} castShadow>
                <boxGeometry args={[5.7, 3.6, 0.7]} />
                <meshStandardMaterial
                  color={i % 3 === 0 ? '#a1aaa7' : i % 3 === 1 ? '#d2d7d2' : '#bcc3bd'}
                  metalness={0.55}
                  roughness={0.45}
                />
              </mesh>
            ))}
          </group>
        );
      })}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <group key={sx + ':' + sz}>
            <Beam a={[sx * 64, 30, sz * 81]} b={[sx * 43, 39, sz * 61]} r={0.65} />
            <Beam a={[sx * 43, 39, sz * 61]} b={[sx * 25, 30, sz * 63]} r={0.65} />
            <Beam a={[sx * 64, 30, sz * 81]} b={[sx * 25, 30, sz * 63]} r={0.45} />
          </group>
        )),
      )}
      <mesh position={[0, 18, 102.8]}>
        <boxGeometry args={[29, 6, 0.4]} />
        <meshStandardMaterial color="#8020c8" />
      </mesh>
      <Ribbon inner={[81, 101]} outer={[82, 102]} y={3.5} bottom={2.5} color={accent} rect />
    </group>
  );
}

function MrvCladding() {
  const panels = useMemo(() => {
    const outline = new CatmullRomCurve3(
      Array.from({ length: 129 }, (_, i) => {
        const a = (i / 128) * Math.PI * 2;
        return new Vector3(
          80 * Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), 0.45),
          0,
          100 * Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 0.45),
        );
      }),
      true,
    );
    return Array.from({ length: 48 }, (_, stripe) => {
      const vertices: number[] = [];
      const pt = (u: number, t: number) => {
        const p = outline.getPointAt(u % 1);
        // Vertical wall, quarter-round eave, then a flat roof: one skin.
        let inset = 0,
          height = 1;
        if (t <= 0.55) height = 1 + (t / 0.55) * 24;
        else if (t <= 0.8) {
          const angle = (((t - 0.55) / 0.25) * Math.PI) / 2;
          inset = 8 * (1 - Math.cos(angle));
          height = 25 + 8 * Math.sin(angle);
        } else {
          inset = 8 + ((t - 0.8) / 0.2) * 30;
          height = 33;
        }
        return [p.x * (1 - inset / 80), height, p.z * (1 - inset / 100)];
      };
      for (let j = 0; j < 40; j++)
        for (let k = 0; k < 4; k++) {
          const u = (stripe + k / 4) / 48,
            v = (stripe + (k + 1) / 4) / 48,
            t = j / 40,
            w = (j + 1) / 40;
          const a = pt(u, t),
            b = pt(v, t),
            c = pt(u, w),
            d = pt(v, w);
          vertices.push(...a, ...c, ...b, ...b, ...c, ...d);
        }
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(vertices, 3));
      g.computeVertexNormals();
      return g;
    });
  }, []);
  return (
    <group name="MRV — faixas contínuas de largura uniforme">
      {panels.map((g, i) => (
        <mesh key={i} geometry={g} castShadow>
          <meshStandardMaterial
            color={i % 2 ? '#606468' : '#e6e8e3'}
            side={2}
            roughness={0.65}
            metalness={0.2}
          />
        </mesh>
      ))}
    </group>
  );
}
export function RealStadium({ skin }: { skin: string }) {
  const accent = STADIUM_SKINS.find((model) => model[0] === skin)?.[2] ?? '#315d55';
  if (skin === 'palmeiras-park') return <PalmeirasPark accent={accent} />;
  if (['morumbi', 'vila-belmiro', 'arena-baixada'].includes(skin))
    return <HistoricBrazilianStadium kind={skin} accent={accent} />;
  if (skin === 'sao-januario') return <SaoJanuario accent={accent} />;
  if (skin === 'neo-quimica') return <CorinthiansArena />;
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
      {skin === 'arena-mrv' && <MrvCladding />}
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
