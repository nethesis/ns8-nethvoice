//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import { compareNatural } from '@/lib/common'
import { splitCodecs, type Trunk } from './trunks'

export const TRUNK_PROVIDERS_KEY = 'trunkProviders'
export const TRUNK_CODECS_KEY = 'trunkCodecs'

const CODEC_LABELS: Record<string, string> = {
  alaw: 'G.711 A-law',
  ulaw: 'G.711 μ-law',
  g729: 'G.729',
  g722: 'G.722',
  g726: 'G.726',
  gsm: 'GSM',
}

const ProvidersResponseSchema = v.array(
  v.object({
    provider: v.string(),
    description: v.nullish(v.string(), ''),
    codecs: v.nullish(v.string(), ''),
    sip_server: v.nullish(v.string(), ''),
  }),
)

const CodecsResponseSchema = v.array(
  v.object({
    codec: v.string(),
    enabled: v.nullish(v.boolean(), true),
  }),
)

export type TrunkProvider = {
  id: string
  name: string
  defaultCodecs: string[]
  sipServer: string
}

export const parseTrunkProviders = (raw: unknown): TrunkProvider[] =>
  v
    .parse(ProvidersResponseSchema, raw)
    .map((provider) => ({
      id: provider.provider,
      name: provider.description.trim() || provider.provider,
      defaultCodecs: splitCodecs(provider.codecs),
      sipServer: provider.sip_server.trim(),
    }))
    .sort((a, b) => compareNatural(a.name, b.name))

export const getTrunkProviders = async (): Promise<TrunkProvider[]> => {
  const { data } = await api.GET('/providers')
  return parseTrunkProviders(data)
}

export const parseTrunkCodecs = (raw: unknown): string[] =>
  v
    .parse(CodecsResponseSchema, raw)
    .filter((codec) => codec.enabled)
    .map((codec) => codec.codec)

export const getTrunkCodecs = async (): Promise<string[]> => {
  const { data } = await api.GET('/codecs/voip')
  return parseTrunkCodecs(data)
}

export const findTrunkProvider = (
  trunk: Trunk,
  providers: TrunkProvider[],
): TrunkProvider | undefined => {
  if (trunk.provider) {
    return providers.find((provider) => provider.id === trunk.provider)
  }
  const sipServer = trunk.sipServer.trim().toLowerCase()

  if (!sipServer) {
    return undefined
  }
  const matches = providers.filter(
    (provider) => provider.sipServer !== '' && provider.sipServer.toLowerCase() === sipServer,
  )

  return matches.length === 1 ? matches[0] : undefined
}

export const getProviderName = (trunk: Trunk, providers: TrunkProvider[]): string =>
  findTrunkProvider(trunk, providers)?.name ?? ''

export const getTrunkLabelById = (trunkId: number, fallback: string, trunks: Trunk[]): string =>
  trunks.find((item) => item.id === trunkId)?.name || fallback

export const getCodecLabel = (codec: string): string => CODEC_LABELS[codec.toLowerCase()] ?? codec

export const getSelectableCodecs = (
  availableCodecs: string[],
  provider: TrunkProvider | undefined,
  selectedCodecs: string[],
): string[] => [
  ...new Set([...availableCodecs, ...(provider?.defaultCodecs ?? []), ...selectedCodecs]),
]
