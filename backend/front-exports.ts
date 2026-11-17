// Reuse the kiosk's own source of truth for knowledge, service counts and action cards.
export { knowledge } from '../frontend/src/knowledge/index';
export { mockChat as scenarioResponse } from '../frontend/src/api/mocks/ai';
export { buildServiceDocuments } from '../frontend/src/api/mocks/services';
export { tokenize, buildIndex } from '../frontend/src/knowledge/engine';
export { ALIASES, BOOST } from '../frontend/src/knowledge/tuning';
