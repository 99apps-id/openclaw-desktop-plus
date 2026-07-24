/** Skills: merge gateway RPC with local scan */

export { listSkillsWithProxy } from './skills-proxy.js'
export type { SkillsProxyDeps } from './skills-proxy.js'
export {
  searchClawHubSkills,
  installClawHubSkill,
  type ClawHubSkillHit,
  type ClawHubSearchResult,
  type ClawHubInstallResult,
} from './clawhub-proxy.js'
