import { GeneratedPerson } from '../../ui/person-avatar';
import { formationSchema, playStyleSchema, type Fixture, type WorldState } from '@football/shared';
import { resolveLineup, tacticalBonus, effectiveOverall, STYLE_LABELS } from '@football/domain';
import { Icon } from '../../ui/icons';

export function OpponentAdvice({
  state,
  fixture,
  clubId,
}: {
  state: WorldState;
  fixture: Fixture;
  clubId: string;
}) {
  if (fixture.homeId !== clubId && fixture.awayId !== clubId) return null;
  const club = state.clubs.byId[clubId];
  const opponentId = fixture.homeId === clubId ? fixture.awayId : fixture.homeId;
  const opponent = state.clubs.byId[opponentId];
  if (!club || !opponent) return null;
  const history = [...(state.seasonArchives ?? []), state]
    .flatMap((season) =>
      season.results.flatMap((result) => {
        const game = season.fixtures.find((row) => row.id === result.fixtureId);
        if (
          !game ||
          game.scheduledAt >= fixture.scheduledAt ||
          (game.homeId !== opponentId && game.awayId !== opponentId)
        )
          return [];
        const plan = result.tacticalPlans?.[game.homeId === opponentId ? 'home' : 'away'];
        return [{ at: game.scheduledAt, plan }];
      }),
    )
    .sort((a, b) => b.at - a.at)
    .slice(0, 5);
  const plans = history.flatMap((row) => (row.plan ? [row.plan] : []));
  const opposingPlans = plans.map((plan) => {
    const lineup = resolveLineup(
      state,
      opponent,
      fixture.scheduledAt,
      state.players.byId,
      plan.formation,
      [],
      plan.style ?? 'balanced',
    );
    return {
      ...plan,
      players: lineup.flatMap((slot) =>
        slot.player
          ? [{ ...slot.player, position: slot.position, overall: slot.effectiveOverall }]
          : [],
      ),
    };
  });
  const options = formationSchema.options
    .flatMap((formation) => {
      return playStyleSchema.options.map((style) => {
        const lineup = resolveLineup(
          state,
          club,
          fixture.scheduledAt,
          state.players.byId,
          formation,
          [],
          style,
        );
        const players = lineup.flatMap((slot) =>
          slot.player
            ? [{ ...slot.player, position: slot.position, overall: slot.effectiveOverall }]
            : [],
        );
        const strength = lineup.reduce((sum, slot) => sum + slot.effectiveOverall, 0) / 11;
        const chemistry = lineup.reduce((sum, slot) => sum + slot.chemistry, 0) / 11;
        const fullStrength =
          lineup.reduce(
            (sum, slot) =>
              sum +
              (slot.player
                ? Math.max(1, Math.floor(effectiveOverall(state, slot.player) * slot.factor))
                : 0),
            0,
          ) / 11;
        const tactical =
          opposingPlans.reduce(
            (sum, plan, index) =>
              sum +
              (tacticalBonus(style, formation, plan.style ?? 'balanced', plan.formation, players) -
                tacticalBonus(
                  plan.style ?? 'balanced',
                  plan.formation,
                  style,
                  formation,
                  plan.players,
                )) *
                (plans.length - index),
            0,
          ) / Math.max(1, (plans.length * (plans.length + 1)) / 2);
        const fallback = plans.length
          ? 0
          : formationSchema.options.reduce(
              (sum, opposingFormation) =>
                sum +
                playStyleSchema.options.reduce(
                  (total, opponentStyle) =>
                    total +
                    tacticalBonus(style, formation, opponentStyle, opposingFormation, players) -
                    tacticalBonus(opponentStyle, opposingFormation, style, formation, players),
                  0,
                ),
              0,
            ) /
            (formationSchema.options.length * playStyleSchema.options.length);
        return {
          formation,
          style,
          strength,
          chemistry,
          loss: fullStrength - strength,
          tactical,
          score: strength + tactical + fallback,
        };
      });
    })
    .sort((a, b) => b.score - a.score);
  const recommendation = options[0];
  if (!recommendation) return null;
  const common = [...new Set(plans.map((plan) => plan.formation))]
    .map((formation) => ({
      formation,
      count: plans.filter((plan) => plan.formation === formation).length,
    }))
    .sort((a, b) => b.count - a.count)[0];
  return (
    <aside className="opponent-advice" aria-label="Dica do auxiliar técnico">
      <div className="opponent-advice-coach">
        <GeneratedPerson name="Auxiliar técnico" outfit="#174638" />
        <span>AUXILIAR TÉCNICO</span>
      </div>
      <div className="opponent-advice-content">
        <div className="opponent-advice-heading">
          <Icon name="pitch" size={18} />
          <strong>Plano para enfrentar {opponent.name}</strong>
        </div>
        <p>
          {common
            ? `Nos últimos ${history.length} jogos, o adversário usou ${common.formation} em ${common.count} dos ${plans.length} registros táticos disponíveis. Minha sugestão combina a força do nosso elenco com as vantagens contra esses esquemas.`
            : history.length
              ? 'As partidas anteriores não têm dados táticos. Sugiro uma formação e um estilo que aproveitam nosso elenco disponível, avaliando os confrontos táticos possíveis.'
              : 'Ainda não há partidas do adversário no histórico. Sugiro uma formação e um estilo que aproveitam nosso elenco disponível, avaliando os confrontos táticos possíveis.'}
        </p>
        {plans.length > 0 && (
          <p className="opponent-advice-matchup">
            <Icon name={recommendation.tactical > 0.05 ? 'trophy' : 'shield'} size={17} />
            {recommendation.tactical > 0.05
              ? 'Explora uma fraqueza dos esquemas recentes do adversário.'
              : recommendation.tactical < -0.05
                ? 'O histórico favorece o adversário taticamente; esta combinação compensa melhor com a força do elenco.'
                : 'Confronto tático equilibrado com os esquemas recentes do adversário.'}
            <strong>
              {recommendation.tactical > 0 ? '+' : ''}
              {recommendation.tactical.toFixed(1)} OVR no confronto
            </strong>
          </p>
        )}
        <div className="opponent-advice-plan">
          <span>
            <small>FORMAÇÃO SUGERIDA</small>
            <b>{recommendation.formation}</b>
          </span>
          <span>
            <small>TÁTICA SUGERIDA</small>
            <b>{STYLE_LABELS[recommendation.style]}</b>
          </span>
          <span>
            <small>OVERALL NO ESQUEMA</small>
            <b>{Math.round(recommendation.strength)}</b>
          </span>
          <span>
            <small>ENTROSAMENTO</small>
            <b>{Math.round(recommendation.chemistry)}%</b>
          </span>
        </div>
        <p className="opponent-advice-cost">
          Perda por entrosamento: −{recommendation.loss.toFixed(1)} OVR. A sugestão compara a força
          ajustada do time com a vantagem tática contra o histórico recente.
        </p>
        <small className="opponent-advice-footnote">
          {plans.length
            ? 'Prioriza jogos recentes e considera condição, posições e entrosamento.'
            : 'Avalia posições, condição e entrosamento dos jogadores disponíveis.'}{' '}
          A dica não garante vitória.
        </small>
      </div>
    </aside>
  );
}
