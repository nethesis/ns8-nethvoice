//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'
import { compareNatural } from '@/lib/common'
import { toProfileIdNumbers } from './lookups'
import { type FieldIssues, HttpUrlSchema, validateForm } from './validation'

export const VIDEO_SOURCES_KEY = 'videoSources'

export const VIDEO_SOURCE_NAME_MAX_LENGTH = 50

export const VIDEO_SOURCE_OPEN_CODE_MAX_LENGTH = 10

type VideoSourceInput = components['schemas']['IntegrationsVideoSourceInput']

const IdSchema = v.pipe(v.union([v.number(), v.string()]), v.transform(String))

const VideoSourcesResponseSchema = v.array(
  v.object({
    descr: v.string(),
    url: v.string(),
    exten: v.pipe(
      v.nullish(v.union([v.number(), v.string()]), ''),
      v.transform((exten) => (exten === 0 || exten === '0' ? '' : String(exten))),
    ),
    open: v.nullish(v.string(), ''),
    profiles: v.nullish(v.array(IdSchema), []),
  }),
)

export type VideoSource = {
  name: string
  url: string
  extension: string
  openCode: string
  profileIds: string[]
}

export type VideoSourceForm = {
  name: string
  url: string
  extension: string
  openCode: string
  profileIds: string[]
}

export const parseVideoSources = (raw: unknown): VideoSource[] =>
  v
    .parse(VideoSourcesResponseSchema, raw)
    .map((source) => ({
      name: source.descr,
      url: source.url,
      extension: source.exten,
      openCode: source.open,
      profileIds: source.profiles,
    }))
    .sort((a, b) => compareNatural(a.name, b.name))

export const getVideoSourcePermissionName = (name: string): string =>
  `vs_${name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/ /g, '_')
    .toLowerCase()}`

export const emptyVideoSourceForm = (): VideoSourceForm => ({
  name: '',
  url: '',
  extension: '',
  openCode: '',
  profileIds: [],
})

export const toVideoSourceForm = (source: VideoSource): VideoSourceForm => ({
  name: source.name,
  url: source.url,
  extension: source.extension,
  openCode: source.openCode,
  profileIds: [...source.profileIds],
})

const VideoSourceFormSchema = v.object({
  name: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty('integrations.video.name_required'),
    v.maxLength(VIDEO_SOURCE_NAME_MAX_LENGTH, 'integrations.video.name_too_long'),
    v.regex(/^[^/\\]+$/, 'integrations.video.name_invalid'),
    v.regex(/[a-zA-Z0-9]/, 'integrations.video.name_invalid'),
  ),
  url: HttpUrlSchema('integrations.url_required', 'integrations.url_invalid'),
  openCode: v.union([
    v.literal(''),
    v.pipe(
      v.string(),
      v.maxLength(VIDEO_SOURCE_OPEN_CODE_MAX_LENGTH, 'integrations.video.open_code_invalid'),
      v.regex(/^[*+#]*[0-9]+[*#]*$/, 'integrations.video.open_code_invalid'),
    ),
  ]),
  profileIds: v.pipe(v.array(v.string()), v.minLength(1, 'integrations.profiles_required')),
})

export const validateVideoSourceForm = (
  form: VideoSourceForm,
  otherSources: VideoSource[],
): FieldIssues => {
  const issues = validateForm(VideoSourceFormSchema, form)
  const permissionName = getVideoSourcePermissionName(form.name.trim())

  if (
    !issues.name &&
    otherSources.some((source) => getVideoSourcePermissionName(source.name) === permissionName)
  ) {
    issues.name = 'integrations.video.name_already_used'
  }
  return issues
}

export const buildVideoSourcePayload = (
  form: VideoSourceForm,
  existing?: VideoSource,
): VideoSourceInput => ({
  ...(existing ? { currentDescr: existing.name } : {}),
  descr: form.name.trim(),
  url: form.url.trim(),
  exten: form.extension || null,
  open: form.openCode.trim(),
  profiles: toProfileIdNumbers(form.profileIds),
})

const IMAGE_SIGNATURES = [
  { prefix: 'iVBOR', mimeType: 'image/png' },
  { prefix: 'R0lGOD', mimeType: 'image/gif' },
  { prefix: '/9j/', mimeType: 'image/jpeg' },
]

export const buildSnapshotDataUrl = (base64: string): string => {
  const data = base64.replace(/\s+/g, '')
  const signature = IMAGE_SIGNATURES.find(({ prefix }) => data.startsWith(prefix))

  return signature ? `data:${signature.mimeType};base64,${data}` : ''
}

export const getVideoSources = async (): Promise<VideoSource[]> => {
  const { data } = await api.GET('/cti/streaming')
  return parseVideoSources(data)
}

export const saveVideoSource = async (
  payload: VideoSourceInput,
  existing?: VideoSource,
): Promise<void> => {
  if (existing) {
    await api.PUT('/cti/streaming/{descr}', {
      params: { path: { descr: existing.name } },
      body: payload,
    })
  } else {
    await api.POST('/cti/streaming', { body: payload })
  }
}

export const deleteVideoSource = async (name: string): Promise<void> => {
  await api.DELETE('/cti/streaming/{name}', { params: { path: { name } } })
}

export const testVideoSource = async (url: string): Promise<string> => {
  const { data } = await api.POST('/cti/sources/test', { body: { url: url.trim() } })
  return buildSnapshotDataUrl(v.parse(v.string(), data))
}
