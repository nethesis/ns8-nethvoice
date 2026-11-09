// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { NextPage } from 'next'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCameraSecurity } from '@nethesis/nethesis-solid-svg-icons'
import {
  faVideo,
  faChartSimple,
  faPhoneVolume,
  faArrowRight,
  faArrowUpRightFromSquare,
} from '@fortawesome/free-solid-svg-icons'
import { Button } from '../components/common'
import { getApiVoiceEndpoint, getApiScheme } from '../lib/utils'
import Link from 'next/link'
import { useSelector } from 'react-redux'
import { RootState } from '../store'
import { IconDefinition } from '@fortawesome/fontawesome-svg-core'

type ApplicationType = 'coming-soon' | 'pbx' | 'lines' | 'streaming'

type ApplicationCardProps = {
  icon: IconDefinition
  title: string
  description: string
  type: ApplicationType
  pbxReportUrl?: string
}

type ApplicationSectionProps = {
  title: string
  applications: ApplicationCardProps[]
}

const ApplicationCard = ({
  icon,
  title,
  description,
  type,
  pbxReportUrl,
}: ApplicationCardProps) => {
  const { t } = useTranslation()

  return (
    <div className='mt-5 border-gray-100 dark:border-gray-700 rounded-2xl shadow dark:shadow-md'>
      {/* Header */}
      <div className='bg-surfaceTableTag dark:bg-surfaceTableTagDark flex flex-col rounded-t-2xl justify-center items-center text-primaryNeutral dark:text-primaryNeutralDark'>
        <span className='h-10 w-10 overflow-hiddenflex relative'>
          <FontAwesomeIcon icon={icon} className='h-6 w-6 mt-4 ' aria-hidden='true' />
        </span>
        <div className='pb-2 pt-2'>
          <h5 className='flex mb-2 font-medium text-lg leading-7'>{t(`Applications.${title}`)}</h5>
        </div>
      </div>

      {/* Body */}
      <div className='bg-elevationL2Invert dark:bg-elevationL2InvertDark rounded-b-2xl pt-5 pb-8 px-12 flex flex-col justify-center'>
        <p className='mb-4 font-normal justify-center items-center text-center text-sm leading-5 text-secondaryNeutral dark:text-secondaryNeutralDark cursor-default'>
          {t(`Applications.${description}`)}
        </p>

        {type === 'coming-soon' && (
          <div className='flex items-center justify-center text-center text-sm text-gray-600 dark:text-gray-300 cursor-default leading-5'>
            {t('Common.Coming soon')}...
          </div>
        )}

        {type === 'pbx' && pbxReportUrl && (
          <div className='flex items-center justify-center'>
            <Button size='small' variant='white'>
              <FontAwesomeIcon icon={faArrowUpRightFromSquare} className='mr-2 h-5 w-4' />{' '}
              <a href={pbxReportUrl} target='_blank' rel='noreferrer'>
                {t('Applications.Open PBX Report')}
              </a>
            </Button>
          </div>
        )}

        {type === 'lines' && (
          <div className='flex items-center justify-center'>
            <Link href={'/lines'}>
              <div className='flex justify-center items-center text-sm leading-5 font-medium text-primaryActive dark:text-primaryActiveDark'>
                <span>{t('Applications.Go to Phone lines and announcements')}</span>
                <FontAwesomeIcon icon={faArrowRight} className='h-4 w-4 m-3 rounded-lg' />
              </div>
            </Link>
          </div>
        )}

        {type === 'streaming' && (
          <div className='flex items-center justify-center'>
            <Link href={'/streaming'}>
              <div className='flex justify-center items-center text-sm leading-5 font-medium text-primaryActive dark:text-primaryActiveDark'>
                <span>{t('Applications.Go to video sources')}</span>
                <FontAwesomeIcon icon={faArrowRight} className='h-4 w-4 m-3 rounded-lg' />
              </div>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

const ApplicationSection = ({ title, applications }: ApplicationSectionProps) => {
  const { t } = useTranslation()

  return (
    <div className='pt-8 first:pt-0'>
      <span className='text-sm font-normal mb-4 text-primaryNeutral dark:text-primaryNeutralDark leading-6'>
        {t(`Applications.${title}`)}
      </span>
      <div className='grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-3'>
        {applications.map((app, index) => (
          <ApplicationCard key={index} {...app} />
        ))}
      </div>
    </div>
  )
}

const Applications: NextPage = () => {
  const { t } = useTranslation()
  const apiVoiceEnpoint = getApiVoiceEndpoint()
  const apiScheme = getApiScheme()
  const pbxReportUrl = apiScheme + apiVoiceEnpoint + '/pbx-report/'
  const { profile } = useSelector((state: RootState) => state.user)

  const internalApplications: ApplicationCardProps[] = []

  if (profile?.macro_permissions?.off_hour?.value) {
    internalApplications.push({
      icon: faPhoneVolume,
      title: 'Phone lines and announcements',
      description: 'Manage your phone lines, activate announcements, voicemail or forward calls',
      type: 'lines',
    })
  }

  if (profile?.macro_permissions?.streaming?.value) {
    internalApplications.push({
      icon: faCameraSecurity as any,
      title: 'Video sources',
      description: 'Display video streams from various sources such as IP cameras or video intercoms',
      type: 'streaming',
    })
  }

  if (profile?.macro_permissions?.settings?.permissions?.video_conference?.value) {
    internalApplications.push({
      icon: faVideo,
      title: 'Video conference',
      description:
        'Start a conference with the ability to share audio, video or your screen with multiple contacts',
      type: 'coming-soon',
    })
  }

  // External applications
  const externalApplications: ApplicationCardProps[] = [
    {
      icon: faChartSimple,
      title: 'PBX Report',
      description: 'Access the complete tool for consulting reports',
      type: 'pbx',
      pbxReportUrl,
    },
  ]

  return (
    <>
      <div>
        {/* Page title */}
        <h1 className='text-2xl font-medium mb-6 text-primaryNeutral dark:text-primaryNeutralDark'>
          {t('Applications.Applications')}
        </h1>

        {/* Show internal application only if available */}
        {internalApplications?.length > 0 && (
          <ApplicationSection title='Internal' applications={internalApplications} />
        )}

        {/* External applications */}
        <ApplicationSection title='External' applications={externalApplications} />
      </div>
    </>
  )
}

export default Applications
