#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const load = (locale) => JSON.parse(readFileSync(join(root, 'src/i18n', locale, 'translation.json'), 'utf8'))

const flatten = (value, prefix = '') =>
  Object.entries(value).flatMap(([key, item]) =>
    item && typeof item === 'object' ? flatten(item, `${prefix}${key}.`) : [[`${prefix}${key}`, item]],
  )

const placeholders = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()

const walk = (directory) =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })

const en = new Map(flatten(load('en')))
const it = new Map(flatten(load('it')))
const problems = []

for (const key of en.keys()) {
  if (!it.has(key)) problems.push(`missing in it: ${key}`)
}

for (const key of it.keys()) {
  if (!en.has(key)) problems.push(`missing in en: ${key}`)
}

for (const [key, value] of en) {
  if (typeof value !== 'string' || !value.trim()) problems.push(`empty in en: ${key}`)

  const translated = it.get(key)

  if (translated === undefined) continue
  if (typeof translated !== 'string' || !translated.trim()) problems.push(`empty in it: ${key}`)

  if (placeholders(value).join() !== placeholders(translated).join()) {
    problems.push(`placeholders differ: ${key}`)
  }
}

if ([...en.keys()].join('\n') !== [...it.keys()].join('\n')) {
  problems.push('en and it do not list their keys in the same order')
}

const sources = walk(join(root, 'src'))
  .filter((path) => /\.(vue|ts)$/.test(path) && !/\.test\.ts$/.test(path) && !path.endsWith('schema.d.ts'))
  .map((path) => [path.slice(root.length), readFileSync(path, 'utf8')])

for (const [path, source] of sources) {
  for (const match of source.matchAll(/(?<![\w.])\$?t\(\s*'([a-z0-9_]+(?:\.[a-z0-9_]+)+)'/g)) {
    if (!en.has(match[1])) problems.push(`unknown key ${match[1]} in ${path}`)
  }
}

if (problems.length) {
  console.error(problems.join('\n'))
  console.error(`\n${problems.length} translation problem(s)`)
  process.exit(1)
}
console.log(`${en.size} translation keys, en and it aligned`)
