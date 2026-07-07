// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  faUsers as faUsersSolid,
  faChartLine as faChartLineSolid,
  faHeadset as faHeadsetSolid,
  faAddressBook as faAddressBookSolid,
  faGear as faGearSolid,
  faClockRotateLeft as faClockRotateLeftSolid,
  faCubes as faCubesSolid,
  IconDefinition as SolidIconDefinition,
} from '@fortawesome/free-solid-svg-icons'

import {
  faClockRotateLeft as faClockRotateLeftLight,
  faHeadset as faHeadsetLight,
  faAddressBook as faAddressBookLight,
  faGear as faGearLight,
  faCubes as faCubesLight,
  faUsers as faUsersLight,
  faChartLine as faChartLineLight,
  IconDefinition as LightIconDefinition,
} from '@nethesis/nethesis-light-svg-icons'

type IconDefinition = SolidIconDefinition | LightIconDefinition

export type NavItemsProps = {
  name: string
  href: string
  icon: IconDefinition
  iconActive: IconDefinition
  current: boolean
}

export const navItems: NavItemsProps[] = [
  {
    name: 'Operators',
    href: '/operators',
    icon: faHeadsetLight,
    iconActive: faHeadsetSolid,
    current: false,
  },
  { name: 'Queues', href: '/queues', icon: faUsersLight, iconActive: faUsersSolid, current: false },
  {
    name: 'Phonebook',
    href: '/phonebook',
    icon: faAddressBookLight,
    iconActive: faAddressBookSolid,
    current: false,
  },
  {
    name: 'History',
    href: '/history',
    icon: faClockRotateLeftLight,
    iconActive: faClockRotateLeftSolid,
    current: false,
  },
  {
    name: 'Queuemanager',
    href: '/queuemanager',
    icon: faChartLineLight,
    iconActive: faChartLineSolid,
    current: false,
  },
  {
    name: 'Applications',
    href: '/applications',
    icon: faCubesLight,
    iconActive: faCubesSolid,
    current: false,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: faGearLight,
    iconActive: faGearSolid,
    current: false,
  },
]
