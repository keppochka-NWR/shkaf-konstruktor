import {worktopSurfaces} from './worktopCatalog';
import {compactDecors} from './compactCatalog';
import {catalog} from './catalog';
import {facadePanels} from './facadePanels';
export const surfaceCatalog=[...catalog,...facadePanels,...compactDecors,...worktopSurfaces];
