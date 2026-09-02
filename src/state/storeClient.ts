/**
 * Quest's connection to the shared store (SPEC.md's Coordinator). One session id per role: the
 * two demo tabs live in one browser, and the store refuses self-review by session.
 * Reviewer identity by OAuth is P1.
 */
import { createStoreClient, localSession } from '../../worker/src/client.ts';

export const STORE_URL = (import.meta.env.VITE_STORE_URL as string | undefined) || 'http://localhost:8787';
export const SURVEY_URL = (import.meta.env.VITE_SURVEY_URL as string | undefined) || 'http://localhost:8787/';

const role = new URLSearchParams(location.search).get('role') === 'reviewer' ? 'reviewer' : 'volunteer';
export const session = localSession(`quest.session.${role}`);
export const store = createStoreClient(STORE_URL, session);
