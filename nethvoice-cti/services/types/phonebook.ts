// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

export interface SpeedDialType {
  id?: string | number
  owner_id?: string
  type?: string
  homeemail?: string
  workemail?: string
  homephone?: string
  workphone?: string
  cellphone?: string
  fax?: string
  title?: string
  company?: string
  notes?: string
  name?: string
  homestreet?: string
  homepob?: string
  homecity?: string
  homeprovince?: string
  homepostalcode?: string
  homecountry?: string
  workstreet?: string
  workpob?: string
  workcity?: string
  workprovince?: string
  workpostalcode?: string
  workcountry?: string
  url?: string
  extension?: string
  speeddial_num?: string
}

export interface NewSpeedDialType {
  name: string
  privacy?: string
  favorite?: boolean
  selectedPrefNum?: string
  setInput?: string
  type?: string
  speeddial_num?: string,
  notes?: string,
  company?: string
}
