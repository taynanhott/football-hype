export function SquadAssistant({ writing }: { writing: boolean }) {
  return (
    <svg
      className={`squad-assistant-avatar ${writing ? 'is-writing' : ''}`}
      viewBox="0 0 80 58"
      shapeRendering="crispEdges"
      role="img"
      aria-label="Auxiliar técnico em pixel art sentado à mesa anotando o planejamento"
    >
      <path fill="#102b29" d="M0 0h80v58H0z" />
      <path fill="#21453c" d="M3 5h21v25H3zM58 6h19v20H58z" />
      <path fill="#17372f" d="M4 6h19v23H4zM59 7h17v18H59z" />
      <path
        fill="#416956"
        d="M13 6h1v23h-1zM4 17h19v1H4zM9 14h9v1H9zM8 15h1v5H8zM18 15h1v5h-1zM9 20h9v1H9zM62 11h10v1H62zM62 15h8v1H62zM62 19h11v1H62z"
      />
      <path fill="#101e25" d="M28 28h24v3h3v18H25V31h3z" />
      <path fill="#263b41" d="M28 31h24v18H28z" />
      <path fill="#19262a" d="M34 4h13v2h4v3h2v14h-3v4h-4v3H34v-3h-4v-4h-2V10h2V7h4z" />
      <path fill="#333d3e" d="M34 6h12v2h4v5h-6v-2h-5v2h-5v4h-4v-6h2V8h2z" />
      <path fill="#dca47c" d="M34 13h5v-2h4v3h5v4h3v5h-3v4h-4v3h-9v-3h-4v-5h-2v-4h3v-3h2z" />
      <path fill="#f1c79b" d="M35 14h5v-2h2v3h5v8h-3v4h-8v-3h-3v-7h2z" />
      <path fill="#a86d53" d="M39 20h2v4h-2zM35 26h10v2H35zM37 29h7v4h-7z" />
      <path fill="#192b30" d="M33 17h5v1h-5zM43 17h5v1h-5zM35 19h2v2h-2zM44 19h2v2h-2z" />
      <path fill="#fff4d5" d="M34 19h1v1h-1zM43 19h1v1h-1zM38 25h5v1h-5z" />
      <path fill="#183631" d="M31 31h6v2h7v-2h6v3h4v4h2v9H24v-9h2v-4h5z" />
      <path fill="#387461" d="M31 33h5v2h9v-2h5v4h3v8H27v-8h4z" />
      <path fill="#53947a" d="M31 34h3v7h-3zM47 34h3v7h-3zM37 35h7v2h-7z" />
      <path fill="#c7dd95" d="M39 37h3v1h1v3h-1v1h-3v-1h-1v-3h1z" />
      <path fill="#234c40" d="M40 38h1v3h-1z" />
      <path fill="#493629" d="M4 45h72v3h3v10H1V48h3z" />
      <path fill="#c69557" d="M5 44h70v3h3v4H2v-4h3z" />
      <path fill="#a97842" d="M2 49h76v3H2z" />
      <path fill="#795234" d="M2 52h76v6H2z" />
      <path fill="#593b2e" d="M7 54h23v1H7zM47 55h24v1H47z" />
      <path fill="#e4d9ae" d="M31 43h17v2h2v8H32v-3h-1z" />
      <path fill="#fff1ca" d="M32 44h15v2h2v6H33v-3h-1z" />
      <path fill="#9da78a" d="M35 46h9v1h-9zM36 49h10v1H36z" />
      <path fill="#c08b69" d="M27 41h4v2h4v3h-2v2h-5v-2h-3v-3h2z" />
      <path fill="#f1c79b" d="M28 42h3v2h3v2h-5v-1h-3v-2h2z" />
      <g className="assistant-writing-hand">
        <path fill="#c08b69" d="M47 40h5v2h2v3h-5v2h-5v-2h-3v-2h3v-2h3z" />
        <path fill="#f1c79b" d="M47 41h4v2h2v1h-5v2h-4v-2h-2v-1h3v-1h2z" />
        <path fill="#e9bb53" d="M43 43h2v4h-1v3h-2v-3h1z" />
        <path fill="#273b37" d="M42 50h2v2h-2z" />
      </g>
      <path fill="#d0d8be" d="M63 39h6v2h3v4h-3v3h-6z" />
      <path fill="#f4edcf" d="M64 40h4v7h-4zM69 42h2v2h-2z" />
      <path fill="#8c997e" d="M64 39h4v1h-4z" />
    </svg>
  );
}
