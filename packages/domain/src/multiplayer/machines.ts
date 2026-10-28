import { setup, getInitialSnapshot, getNextSnapshot } from 'xstate';

export const matchMachine = setup({
  types: { events: {} as { type: 'KICKOFF' | 'HALFTIME' | 'RESUME' | 'FINISH' } },
}).createMachine({
  id: 'match',
  initial: 'scheduled',
  states: {
    scheduled: { on: { KICKOFF: 'firstHalf' } },
    firstHalf: { on: { HALFTIME: 'halfTime' } },
    halfTime: { on: { RESUME: 'secondHalf' } },
    secondHalf: { on: { FINISH: 'finished' } },
    finished: { type: 'final' },
  },
});
export const seasonMachine = setup({
  types: { events: {} as { type: 'START' | 'FINISH' | 'NEW_SEASON' } },
}).createMachine({
  id: 'season',
  initial: 'draft',
  states: {
    draft: { on: { START: 'active' } },
    active: { on: { FINISH: 'finished' } },
    finished: { on: { NEW_SEASON: 'active' } },
  },
});
export const negotiationMachine = setup({
  types: { events: {} as { type: 'ACCEPT_FEE' | 'ACCEPT_SALARY' | 'REJECT' } },
}).createMachine({
  id: 'negotiation',
  initial: 'fee',
  states: {
    fee: { on: { ACCEPT_FEE: 'salary', REJECT: 'rejected' } },
    salary: { on: { ACCEPT_SALARY: 'completed', REJECT: 'rejected' } },
    completed: { type: 'final' },
    rejected: { type: 'final' },
  },
});
export const readyMachine = setup({
  types: { events: {} as { type: 'READY' | 'CANCEL' | 'ROUND' } },
}).createMachine({
  id: 'ready',
  initial: 'waiting',
  states: {
    waiting: { on: { READY: 'ready' } },
    ready: { on: { CANCEL: 'waiting', ROUND: 'waiting' } },
  },
});

export function nextReadyState(current: boolean, ready: boolean): boolean {
  return getNextSnapshot(
    readyMachine,
    readyMachine.resolveState({ value: current ? 'ready' : 'waiting', context: {} }),
    { type: ready ? 'READY' : 'CANCEL' },
  ).matches('ready');
}
export function feeAcceptedState(): 'salary' | 'rejected' {
  return getNextSnapshot(negotiationMachine, getInitialSnapshot(negotiationMachine), {
    type: 'ACCEPT_FEE',
  }).matches('salary')
    ? 'salary'
    : 'rejected';
}
export function salaryAcceptedState(): 'completed' | 'rejected' {
  return getNextSnapshot(
    negotiationMachine,
    negotiationMachine.resolveState({ value: 'salary', context: {} }),
    { type: 'ACCEPT_SALARY' },
  ).matches('completed')
    ? 'completed'
    : 'rejected';
}
export function completedMatchState(): string {
  let state = getInitialSnapshot(matchMachine);
  for (const type of ['KICKOFF', 'HALFTIME', 'RESUME', 'FINISH'] as const)
    state = getNextSnapshot(matchMachine, state, { type });
  return String(state.value);
}
export function nextSeasonState(
  current: 'active' | 'finished',
  event: 'FINISH' | 'NEW_SEASON',
): 'active' | 'finished' {
  return getNextSnapshot(
    seasonMachine,
    seasonMachine.resolveState({ value: current, context: {} }),
    { type: event },
  ).matches('active')
    ? 'active'
    : 'finished';
}
