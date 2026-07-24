import { describe, expect, it } from 'vitest'
import {
  bareModelId,
  qualifyModelRef,
  resolvePrimaryModelRef,
  toPrimaryModelRef,
} from './model-ref.js'
import type { OpenClawConfig } from '../../shared/types.js'

describe('bareModelId', () => {
  it('returns empty for blank input', () => {
    expect(bareModelId('')).toBe('')
    expect(bareModelId('   ')).toBe('')
  })

  it('strips a single provider prefix', () => {
    expect(bareModelId('nesa/auto')).toBe('auto')
    expect(bareModelId('  deepseek/deepseek-v4-flash  ')).toBe('deepseek-v4-flash')
  })

  it('leaves bare ids unchanged', () => {
    expect(bareModelId('auto')).toBe('auto')
  })
})

describe('qualifyModelRef', () => {
  it('returns already-qualified refs as-is', () => {
    expect(qualifyModelRef('nesa', 'nesa/auto')).toBe('nesa/auto')
  })

  it('prefixes bare ids with provider', () => {
    expect(qualifyModelRef('nesa', 'auto')).toBe('nesa/auto')
  })

  it('returns bare id when provider missing', () => {
    expect(qualifyModelRef(undefined, 'auto')).toBe('auto')
    expect(qualifyModelRef('  ', 'auto')).toBe('auto')
  })
})

describe('toPrimaryModelRef', () => {
  it('does not double-prefix already-qualified ids', () => {
    expect(toPrimaryModelRef('nesa', 'nesa/auto')).toBe('nesa/auto')
  })

  it('qualifies bare ids', () => {
    expect(toPrimaryModelRef('nesa', 'auto')).toBe('nesa/auto')
  })

  it('keeps minimax as bare id', () => {
    expect(toPrimaryModelRef('minimax', 'MiniMax-M2.1')).toBe('MiniMax-M2.1')
    expect(toPrimaryModelRef('minimax', 'minimax/MiniMax-M2.1')).toBe('MiniMax-M2.1')
  })
})

describe('resolvePrimaryModelRef', () => {
  const configWithNesa: OpenClawConfig = {
    models: {
      providers: {
        nesa: {
          baseUrl: 'https://example.test',
          api: 'openai-completions',
          models: [{ id: 'auto', name: 'Nesa Free' }],
        },
        deepseek: {
          baseUrl: 'https://api.deepseek.com',
          api: 'openai-completions',
          models: [{ id: 'deepseek-v4-flash', name: 'Flash' }],
        },
      },
    },
  }

  it('maps nesa-free aliases to nesa/auto when nesa is configured', () => {
    expect(resolvePrimaryModelRef(configWithNesa, 'nesa-free')).toBe('nesa/auto')
    expect(resolvePrimaryModelRef(configWithNesa, 'openai/nesa-free')).toBe('nesa/auto')
    expect(resolvePrimaryModelRef(configWithNesa, 'nesa/nesa-free')).toBe('nesa/auto')
  })

  it('returns already-qualified refs unchanged', () => {
    expect(resolvePrimaryModelRef(configWithNesa, 'deepseek/deepseek-v4-flash')).toBe(
      'deepseek/deepseek-v4-flash',
    )
  })

  it('qualifies a unique bare model id', () => {
    expect(resolvePrimaryModelRef(configWithNesa, 'deepseek-v4-flash')).toBe(
      'deepseek/deepseek-v4-flash',
    )
  })

  it('leaves ambiguous bare ids unchanged', () => {
    const ambiguous: OpenClawConfig = {
      models: {
        providers: {
          a: {
            baseUrl: 'https://a.test',
            api: 'openai-completions',
            models: [{ id: 'shared', name: 'A' }],
          },
          b: {
            baseUrl: 'https://b.test',
            api: 'openai-completions',
            models: [{ id: 'shared', name: 'B' }],
          },
        },
      },
    }
    expect(resolvePrimaryModelRef(ambiguous, 'shared')).toBe('shared')
  })
})
