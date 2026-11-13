import { Component } from 'react';
import type { NameMotion, NamesSeen } from './nameMotion';

interface MoveNamesProps {
  motion: NameMotion;
  /**
   * What is on the screen, in one word (`sceneOnScreen`: the date of the
   * Daily Schedule, and whether a phone's header is collapsed). When it
   * changes the names are in other places without having moved: nothing
   * travels.
   */
  scene: string;
}

/**
 * Draws nothing. Put anywhere in the screen, it tells the name motion where
 * the names were just before each redraw and lets it play just after, before
 * the browser paints. (A class, because only a class is told "the page is
 * about to change".)
 */
export class MoveNames extends Component<MoveNamesProps> {
  getSnapshotBeforeUpdate(): NamesSeen {
    return this.props.motion.seen();
  }

  componentDidUpdate(previous: MoveNamesProps, _state: unknown, before: NamesSeen) {
    if (previous.scene !== this.props.scene) this.props.motion.stop();
    else this.props.motion.play(before);
  }

  componentWillUnmount() {
    this.props.motion.stop();
  }

  render() {
    return null;
  }
}
