import type { ViewProps } from '../../ui/view-props';
import { SquadPlanning } from './squad-planning';

export function Squad(props: ViewProps) {
  return <SquadPlanning key={`${props.snapshot.state.id}.${props.club.id}`} {...props} />;
}
