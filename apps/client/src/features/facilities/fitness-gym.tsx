import { PlayerCard } from '../players/player-card';
import { clubKit } from '@football/shared';
import type { ViewProps } from '../../ui/view-props';

export function FitnessGym({
  club,
  snapshot,
  active,
  slots,
  medical = false,
  coaching = false,
}: Pick<ViewProps, 'club' | 'snapshot'> & {
  active: string[];
  slots: number;
  medical?: boolean;
  coaching?: boolean;
}) {
  return (
    <div className={`fitness-gym ${medical ? 'medical-room' : coaching ? 'training-ground' : ''}`}>
      <svg
        className="fitness-gym-scene"
        viewBox="0 0 640 420"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {coaching ? (
          <>
            <rect width="640" height="420" fill="#eaf0e4" />
            <path d="M0 100H640V420H0Z" fill="#b8cda4" />
            <path d="M0 170H640M0 290H640M0 410H640" stroke="#aec59a" strokeWidth="60" />
            <g stroke="#f6f8ed" strokeWidth="3" fill="none" opacity=".85">
              <rect x="24" y="120" width="592" height="276" rx="2" />
              <path d="M320 120V396M24 190H100V326H24M616 190H540V326H616" />
              <ellipse cx="320" cy="258" rx="64" ry="52" />
              <path d="M24 222H52V294H24M616 222H588V294H616" />
            </g>
            <path
              d="M35 99V61H170V99M470 99V61H605V99"
              stroke="#9aaa8c"
              strokeWidth="5"
              fill="#f6f8ed"
            />
            <text
              x="320"
              y="53"
              textAnchor="middle"
              fill="#718763"
              fontSize="12"
              fontFamily="sans-serif"
              letterSpacing="3"
            >
              CENTRO DE TREINAMENTO
            </text>
          </>
        ) : medical ? (
          <>
            <rect width="640" height="420" fill="#f4edef" />
            <path d="M0 300H640V420H0Z" fill="#e5dce0" />
            <path d="M0 300H640M0 360H640M160 300L120 420M480 300L520 420" stroke="#d4c8ce" />
            <rect
              x="60"
              y="36"
              width="150"
              height="120"
              rx="8"
              fill="#fcfafb"
              stroke="#dacbd2"
              strokeWidth="5"
            />
            <path d="M135 38V154M62 96H208" stroke="#e5dce0" strokeWidth="4" />
            <rect x="420" y="50" width="140" height="12" rx="6" fill="#fffaf3" />
            <path
              d="M308 85H332M320 73V97"
              stroke="#b88195"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <g fill="none" stroke="#aa8e9a" strokeWidth="6" strokeLinecap="round">
              <path d="M30 290H100V250H30ZM40 290V325M90 290V325M550 320V175H585M565 175V200" />
              <rect x="557" y="200" width="18" height="35" rx="5" />
              <path d="M566 235V270M535 325H570" />
            </g>
            <text
              x="320"
              y="129"
              textAnchor="middle"
              fill="#a27d8d"
              fontSize="12"
              fontFamily="sans-serif"
              letterSpacing="3"
            >
              CUIDADO E RECUPERAÇÃO
            </text>
          </>
        ) : (
          <>
            <rect width="640" height="420" fill="#edf2e9" />
            <path d="M0 300H640V420H0Z" fill="#d9e2d4" />
            <path
              d="M0 300H640M0 360H640M130 300L85 420M320 300V420M510 300L555 420"
              stroke="#c4d0be"
              fill="none"
            />
            <rect
              x="74"
              y="38"
              width="180"
              height="122"
              rx="7"
              fill="#fafcf6"
              stroke="#c5d3bf"
              strokeWidth="5"
            />
            <path d="M164 40V158M76 100H252" stroke="#dce6d6" strokeWidth="4" />
            <rect x="390" y="45" width="160" height="12" rx="6" fill="#fffdf0" />
            <g stroke="#70866b" strokeWidth="8" strokeLinecap="round" fill="none">
              <path d="M36 255H104M46 242V268M94 242V268M55 235V275M85 235V275" />
              <path d="M540 286H605M551 286L541 326M593 286L605 326M572 285V221M550 221H594M550 210V232M594 210V232" />
            </g>
            <path
              d="M22 314H115M525 335H619"
              stroke="#b6c6ad"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <text
              x="320"
              y="91"
              textAnchor="middle"
              fill="#809575"
              fontSize="12"
              fontFamily="sans-serif"
              letterSpacing="4"
            >
              RECOVERY CLUB
            </text>
            <path
              d="M310 116H330M320 106V126"
              stroke="#90a980"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
      <div className="fitness-gym-players">
        {Array.from({ length: Math.max(slots, active.length) }, (_, index) => {
          const player = snapshot.state.players.byId[active[index] ?? ''];
          return (
            <div className="fitness-gym-station" key={index}>
              {player ? (
                <>
                  <PlayerCard player={player} clubName={club.name} kit={clubKit(club)} />
                  <span className="fitness-gym-status">
                    <i /> {coaching ? 'Treinando · +50%' : 'Recuperando · +50%'}
                  </span>
                  {coaching ? (
                    <>
                      <rect width="640" height="420" fill="#eaf0e4" />
                      <path d="M0 100H640V420H0Z" fill="#b8cda4" />
                      <path d="M0 170H640M0 290H640M0 410H640" stroke="#aec59a" strokeWidth="60" />
                      <g stroke="#f6f8ed" strokeWidth="3" fill="none" opacity=".85">
                        <rect x="24" y="120" width="592" height="276" rx="2" />
                        <path d="M320 120V396M24 190H100V326H24M616 190H540V326H616" />
                        <ellipse cx="320" cy="258" rx="64" ry="52" />
                        <path d="M24 222H52V294H24M616 222H588V294H616" />
                      </g>
                      <path
                        d="M35 99V61H170V99M470 99V61H605V99"
                        stroke="#9aaa8c"
                        strokeWidth="5"
                        fill="#f6f8ed"
                      />
                      <text
                        x="320"
                        y="53"
                        textAnchor="middle"
                        fill="#718763"
                        fontSize="12"
                        fontFamily="sans-serif"
                        letterSpacing="3"
                      >
                        CENTRO DE TREINAMENTO
                      </text>
                    </>
                  ) : medical ? (
                    <span className="medical-room-days">
                      {snapshot.state.injuries[player.id] ?? 0} jogos de recuperação
                    </span>
                  ) : (
                    <div
                      className="fitness-gym-condition"
                      role="meter"
                      aria-label={`Condição de ${player.name}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(player.fitness)}
                    >
                      <span style={{ width: `${Math.min(100, Math.max(0, player.fitness))}%` }} />
                    </div>
                  )}
                </>
              ) : (
                <div className="fitness-gym-empty">
                  <span>+</span>Vaga disponível
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
