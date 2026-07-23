/**
 * OpenClaw upstream lists `slack` in bundled chat-channel metadata. When the Slack extension is
 * stripped (because `@slack/web-api` is not in the published npm tarball), startup can throw:
 *
 *   `Missing bundled chat channel metadata for: slack`
 *
 * Layouts:
 * - Older: hardcoded `"slack"` inside `CHAT_CHANNEL_ORDER` in `chat-meta-*.js` / `channel-options-*.js`.
 * - 2026.7+: `CHAT_CHANNEL_ORDER` is derived from `GENERATED_BUNDLED_CHANNEL_CONFIG_METADATA` in
 *   `ids-*.js` via `listBundledChatChannelEntries()` — filter `channelId`/`pluginId` `"slack"` there.
 *
 * Additionally, `slack-surface-*.js` (when present) delegates through a facade loader to
 * `slack/api.js`. When that surface is stripped, replace with stub no-op exports.
 *
 * Idempotent: safe to run after every download-openclaw / prepare-bundle.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

/**
 * The export names used by `slack-surface-*.js` and imported by `gateway-cli-*.js`.
 * Each is replaced by a safe no-op: numbers return 0, lists return [], actions return null/undefined.
 * handleSlackHttpRequest returns false so the gateway continues to the next stage without
 * sending a response (prevents ERR_HTTP_HEADERS_SENT in subsequent stages).
 */
const NOOP_SURFACE = `
// /* openclaw-desktop: slack stripped — no-op surface (extension removed from bundle) */
const buildSlackThreadingToolContext=()=>{};
const createSlackWebClient=()=>({});
const deleteSlackMessage=async()=>null;
const downloadSlackFile=async()=>null;
const editSlackMessage=async()=>null;
const extractSlackToolSend=()=>{};
const getSlackMemberInfo=async()=>null;
function handleSlackHttpRequest(){return false;}
const inspectSlackAccount=async()=>null;
const isSlackInteractiveRepliesEnabled=()=>false;
const listEnabledSlackAccounts=async()=>[];
const listSlackAccountIds=async()=>[];
const listSlackDirectoryGroupsFromConfig=async()=>[];
const listSlackDirectoryPeersFromConfig=async()=>[];
const listSlackEmojis=async()=>[];
const listSlackMessageActions=async()=>[];
const listSlackPins=async()=>[];
const listSlackReactions=async()=>[];
const normalizeAllowListLower=(v)=>v??[];
const parseSlackBlocksInput=async()=>null;
const recordSlackThreadParticipation=async()=>{};
const resolveDefaultSlackAccountId=async()=>null;
const resolveSlackAutoThreadId=()=>null;
const resolveSlackGroupRequireMention=()=>false;
const resolveSlackRuntimeGroupPolicy=()=>({});
const resolveSlackGroupToolPolicy=()=>({});
const resolveSlackReplyToMode=()=>"off";
const sendSlackMessage=async()=>null;
const pinSlackMessage=async()=>null;
const reactSlackMessage=async()=>null;
const readSlackMessages=async()=>[];
const removeOwnSlackReactions=async()=>null;
const removeSlackReaction=async()=>null;
const unpinSlackMessage=async()=>null;
export{resolveSlackGroupToolPolicy as A,readSlackMessages as C,resolveDefaultSlackAccountId as D,removeSlackReaction as E,resolveSlackRuntimeGroupPolicy as M,sendSlackMessage as N,resolveSlackAutoThreadId as O,unpinSlackMessage as P,reactSlackMessage as S,removeOwnSlackReactions as T,listSlackPins as _,editSlackMessage as a,parseSlackBlocksInput as b,handleSlackHttpRequest as c,listEnabledSlackAccounts as d,listSlackAccountIds as f,listSlackMessageActions as g,listSlackEmojis as h,downloadSlackFile as i,resolveSlackReplyToMode as j,resolveSlackGroupRequireMention as k,inspectSlackAccount as l,listSlackDirectoryPeersFromConfig as m,createSlackWebClient as n,extractSlackToolSend as o,listSlackDirectoryGroupsFromConfig as p,deleteSlackMessage as r,getSlackMemberInfo as s,buildSlackThreadingToolContext as t,isSlackInteractiveRepliesEnabled as u,listSlackReactions as v,recordSlackThreadParticipation as w,pinSlackMessage as x,normalizeAllowListLower as y};
`.trimStart()

const IDS_PATCH_MARKER = '/* openclaw-desktop: slack stripped from bundled channel metadata */'
const ORDER_PATCH_MARKER = '/* openclaw-desktop: slack stripped from channel order */'

/** 2026.7+: filter slack out of listBundledChatChannelEntries() in ids-*.js */
async function patchIdsBundledChannelEntries(filePath: string): Promise<boolean> {
  let raw = await readFile(filePath, 'utf8')
  if (raw.includes(IDS_PATCH_MARKER)) return false

  const before = raw
  // Pretty and minified forms of the configurable filter inside listBundledChatChannelEntries.
  raw = raw.replace(
    /GENERATED_BUNDLED_CHANNEL_CONFIG_METADATA\.filter\(\((entry)\)\s*=>\s*\1\.configurable\s*!==\s*false\)/g,
    `GENERATED_BUNDLED_CHANNEL_CONFIG_METADATA.filter(($1)=>$1.configurable!==false&&$1.channelId!=="slack"&&$1.pluginId!=="slack")`,
  )
  if (raw === before) {
    return false
  }
  raw = `// ${IDS_PATCH_MARKER}\n` + raw
  await writeFile(filePath, raw, 'utf8')
  console.log(`  [patch-slack] ${basename(filePath)}: slack filtered from listBundledChatChannelEntries`)
  return true
}

/** Older layout: remove `"slack"` from hardcoded CHAT_CHANNEL_ORDER arrays. */
async function patchHardcodedChannelOrder(filePath: string): Promise<boolean> {
  let raw = await readFile(filePath, 'utf8')
  if (raw.includes(ORDER_PATCH_MARKER)) return false

  const slackEntry = /[\s\n]*"slack",/
  if (!slackEntry.test(raw)) {
    const slackEntryNoComma = /[\s\n]*"slack"\s*\]/
    if (!slackEntryNoComma.test(raw)) {
      return false
    }
    raw = raw.replace(slackEntryNoComma, '\n]')
  } else {
    raw = raw.replace(slackEntry, '')
  }

  raw = `// ${ORDER_PATCH_MARKER}\n` + raw
  await writeFile(filePath, raw, 'utf8')
  console.log(`  [patch-slack] ${basename(filePath)}: "slack" removed from CHAT_CHANNEL_ORDER`)
  return true
}

export async function patchOpenClawStripSlackChannel(openclawRoot: string): Promise<void> {
  const dist = join(openclawRoot, 'dist')
  let names: string[]
  try {
    names = await readdir(dist)
  } catch {
    return
  }

  let patchedAny = false
  let idsAlreadyPatched = false

  for (const n of names.filter((name) => /^ids-.*\.js$/.test(name))) {
    const filePath = join(dist, n)
    const existing = await readFile(filePath, 'utf8')
    if (existing.includes(IDS_PATCH_MARKER)) {
      idsAlreadyPatched = true
      continue
    }
    if (await patchIdsBundledChannelEntries(filePath)) patchedAny = true
  }

  // Hashed output file name varies per build — CHAT_CHANNEL_ORDER has moved between
  // chat-meta-*.js and channel-options-*.js across upstream versions; match both.
  for (const n of names.filter(
    (name) => /^chat-meta-.*\.js$/.test(name) || /^channel-options-.*\.js$/.test(name),
  )) {
    const filePath = join(dist, n)
    const raw = await readFile(filePath, 'utf8')
    // Skip pure re-export barrels that only import CHAT_CHANNEL_ORDER (no literal "slack").
    if (!/"slack"/.test(raw)) continue
    if (raw.includes(ORDER_PATCH_MARKER)) {
      patchedAny = true
      continue
    }
    if (await patchHardcodedChannelOrder(filePath)) patchedAny = true
    else {
      console.warn(
        `  [patch-slack] ${n}: contains "slack" but CHAT_CHANNEL_ORDER entry not matched — layout may have changed`,
      )
    }
  }

  if (!patchedAny && !idsAlreadyPatched) {
    const idsPresent = names.some((n) => /^ids-.*\.js$/.test(n))
    if (idsPresent) {
      console.warn(
        '  [patch-slack] ids-*.js present but listBundledChatChannelEntries filter not patched — layout may have changed',
      )
    }
  }

  // Patch slack-surface-*.js: replace facade-loader stubs with inline no-ops so the
  // gateway HTTP stage for Slack skips gracefully instead of throwing on the stripped extension.
  const surfacePaths = names
    .filter((n) => /^slack-surface-.*\.js$/.test(n))
    .map((n) => join(dist, n))

  for (const filePath of surfacePaths) {
    const existing = await readFile(filePath, 'utf8')
    if (existing.includes('slack stripped — no-op surface')) continue
    await writeFile(filePath, NOOP_SURFACE, 'utf8')
    console.log(`  [patch-slack] ${basename(filePath)}: replaced with no-op surface`)
  }
}
