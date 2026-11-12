import { signedInFetch } from './signIn/openPage';
import { API_BASE, apiStore } from './storage/apiStore';
import { savedInOrder, type Saves } from './storage/saveQueue';
import type { ScheduleStore } from './storage';

/**
 * The one place that chooses where the pages keep things: the Worker's
 * database, shared by every screen, through the save queue (saves in order,
 * tried again until they get through; `saves` says how it is going). Every
 * call carries the Hub sign-in.
 */
export function sharedStore(): { store: ScheduleStore; saves: Saves } {
  return savedInOrder(apiStore(API_BASE, signedInFetch));
}
