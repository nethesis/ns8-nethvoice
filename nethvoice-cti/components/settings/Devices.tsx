// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { NextPage } from 'next'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import {
  faArrowRightLong,
  faArrowUpFromBracket,
  faAward,
  faCircleArrowDown,
  faCircleCheck,
  faCircleXmark,
  faDesktop,
  faEllipsisVertical,
  faHeadset,
  faPenToSquare,
} from '@fortawesome/free-solid-svg-icons'
import React from 'react'
import {
  getDevicesPin,
  openShowEditPhysicalPhone,
  setMainDevice,
  openShowSwitchDeviceInputOutput,
  getDownloadLink,
  openShowDownloadLinkContent,
} from '../../lib/devices'
import { Badge, Button, Dropdown } from '../common'
import { useDispatch } from 'react-redux'
import { Dispatch } from '../../store'
import { eventDispatch } from '../../lib/hooks/eventDispatch'
import { getTimestamp } from '../../services/user'
import { isEmpty } from 'lodash'
import { faOfficePhone } from '@nethesis/nethesis-solid-svg-icons'
import { IconProp } from '@fortawesome/fontawesome-svg-core'
import { CustomThemedTooltip } from '../common/CustomThemedTooltip'

interface NavigatorWithUserAgentData extends Navigator {
  userAgentData?: {
    getHighEntropyValues(hints: string[]): Promise<{
      architecture: string
      [key: string]: any
    }>
  }
}

const STYLES = {
  tableCell:
    'px-6 py-3 gap-6 text-sm font-normal font-poppins text-gray-700 dark:text-gray-200 h-14',
  tableHeader:
    'text-left relative px-6 py-3 gap-2 bg-gray-100 dark:bg-gray-800 font-poppins font-medium text-sm text-gray-900 dark:text-gray-50',
  iconButton: 'text-emerald-700 dark:text-emerald-500 h-4 w-4',
  ghostButton: 'gap-3 px-3 py-2',
  skeletonBase: 'animate-pulse rounded bg-gray-300 dark:bg-gray-700',
  nameColumnWidth: 'w-[25%]',
  statusColumnWidth: 'w-[17.5%]',
  defaultColumnWidth: 'w-[17.5%]',
  actionsColumnWidth: 'w-[40%]',
}

const Devices: NextPage = () => {
  const { t } = useTranslation()
  const operators: any = useSelector((state: RootState) => state.operators)
  const profile = useSelector((state: RootState) => state.user)

  const [phoneData, setPhoneData]: any = useState([])
  const [webrtcData, setWebrtcData]: any = useState([])
  const [phoneLinkData, setPhoneLinkDataData]: any = useState([])

  const dispatch = useDispatch<Dispatch>()

  useEffect(() => {
    // filter phone and insert only physical phones
    if (profile?.endpoints) {
      let endpointsInformation = profile?.endpoints
      if (endpointsInformation?.extension) {
        setPhoneData(endpointsInformation?.extension.filter((phone) => phone?.type === 'physical'))
        setWebrtcData(endpointsInformation?.extension.filter((phone) => phone?.type === 'webrtc'))
        setPhoneLinkDataData(
          endpointsInformation?.extension.filter((phone) => phone?.type === 'nethlink'),
        )
      }
    }
  }, [profile?.endpoints])

  const [updatedDownloadLink, setUpdatedDownloadLink]: any = useState()
  const [currentOS, setCurrentOS] = useState('')
  const [macArchitecture, setMacArchitecture] = useState('x64')

  const [firstRenderDownload, setFirstRenderDownload] = useState(true)
  const [getDownloadUrlError, setGetDownloadUrlError] = useState('')

  const getMacArchitecture = async () => {
    try {
      const nav = navigator as NavigatorWithUserAgentData

      if (nav.userAgentData && typeof nav.userAgentData.getHighEntropyValues === 'function') {
        const data = await nav.userAgentData.getHighEntropyValues(['architecture'])
        if (data && data.architecture) {
          return data.architecture === 'arm' ? 'arm64' : 'x64'
        }
      }
      return 'x64'
    } catch (error) {
      console.error('Error detecting Mac architecture:', error)
      return 'x64'
    }
  }

  useEffect(() => {
    if (firstRenderDownload) {
      setFirstRenderDownload(false)
      return
    }
    const userAgent = navigator.userAgent.toLowerCase()
    if (userAgent.includes('win')) {
      setCurrentOS('windows')
    } else if (userAgent.includes('mac')) {
      setCurrentOS('mac')
      getMacArchitecture().then((arch) => {
        setMacArchitecture(arch)
      })
    } else if (userAgent.includes('linux')) {
      setCurrentOS('linux')
    }

    const initUrlDownload = async () => {
      if (profile?.lkhash !== undefined && phoneLinkData?.length !== 0) {
        try {
          setGetDownloadUrlError('')
          const response = await getDownloadLink()
          const downloadUrls = response.assets
            .filter(
              (asset: any) =>
                (asset?.content_type === 'application/octet-stream' ||
                  asset?.content_type === 'application/x-msdownload' ||
                  asset.content_type === 'application/x-ms-dos-executable') &&
                !asset?.browser_download_url.endsWith('.blockmap'),
            )
            .reduce((acc: any[], asset: any) => {
              const url = asset.browser_download_url
              if (url.includes('setup.exe')) {
                acc.push({ windowsUrl: url })
              } else if (url.includes('.AppImage')) {
                acc.push({ linuxUrl: url })
              } else if (url.includes('.dmg')) {
                if (url.includes('-arm64.dmg')) {
                  acc.push({ macArmUrl: url })
                } else if (url.includes('-x64.dmg')) {
                  acc.push({ macX64Url: url })
                } else {
                  acc.push({ macUrl: url })
                }
              }
              return acc
            }, [])

          if (downloadUrls?.length > 0) {
            setUpdatedDownloadLink(downloadUrls)
          }
        } catch (error) {
          setGetDownloadUrlError('Cannot retrieve download url')
        }
      }
    }
    initUrlDownload()
  }, [firstRenderDownload, profile?.lkhash, phoneLinkData])

  const handleDownload = () => {
    let downloadUrl = null

    if (currentOS === 'mac') {
      const macArmUrl = updatedDownloadLink?.find((link: any) => link.macArmUrl)?.macArmUrl
      const macX64Url = updatedDownloadLink?.find((link: any) => link.macX64Url)?.macX64Url
      const macDefaultUrl = updatedDownloadLink?.find((link: any) => link.macUrl)?.macUrl

      if (macArchitecture === 'arm64' && macArmUrl) {
        downloadUrl = macArmUrl
      } else if (macX64Url) {
        downloadUrl = macX64Url
      } else {
        downloadUrl = macDefaultUrl
      }
    } else if (currentOS === 'windows') {
      downloadUrl = updatedDownloadLink?.find((link: any) => link.windowsUrl)?.windowsUrl
    } else if (currentOS === 'linux') {
      downloadUrl = updatedDownloadLink?.find((link: any) => link.linuxUrl)?.linuxUrl
    }

    if (downloadUrl) {
      window.open(downloadUrl, '_blank')
    }
  }

  let phoneLinkDownloadComponent = (isInDropwdown: boolean) => {
    return (
      <div className='text-right'>
        {!isInDropwdown ? (
          <Button
            variant='ghost'
            onClick={() => handleDownload()}
            className='relative'
            data-tooltip-id='tooltip-download-app'
            data-tooltip-content={t('Devices.Download App')}
          >
            <FontAwesomeIcon icon={faCircleArrowDown} className='xl:mr-2 mr-0 h-4 w-4' />
            <CustomThemedTooltip
              id='tooltip-download-app'
              place='top'
              className='inline xl:hidden'
            />
            <span className='hidden xl:inline'>{t('Devices.Download App')}</span>
          </Button>
        ) : (
          <div>{t('Devices.All download options')}</div>
        )}
      </div>
    )
  }

  const setMainDeviceMenu = (
    deviceId: any,
    type: string,
    selectedDeviceInfo: any,
    isPhoneLinkSection: boolean,
  ) => (
    <>
      {/* check if the device is already the main device */}
      {!isPhoneLinkSection && operators?.extensions[phoneLinkData?.id]?.status !== 'online' ? (
        <Dropdown.Item
          icon={faAward}
          onClick={() => setSelectedAsMainDevice(deviceId, type, selectedDeviceInfo)}
        >
          {t('Devices.Set as main device')}
        </Dropdown.Item>
      ) : (
        <></>
      )}
      {isPhoneLinkSection && (
        <>
          <Dropdown.Item
            icon={faArrowRightLong}
            onClick={() =>
              openShowDownloadLinkContent(updatedDownloadLink, currentOS, macArchitecture)
            }
          >
            {phoneLinkDownloadComponent(true)}
          </Dropdown.Item>
        </>
      )}
    </>
  )

  const setSelectedAsMainDevice = async (
    deviceId: string,
    deviceType: string,
    deviceInformationObject: any,
  ) => {
    let deviceIdInfo: any = {}
    if (deviceId) {
      deviceIdInfo.id = deviceId
      try {
        await setMainDevice(deviceIdInfo)
        dispatch.user.updateDefaultDevice(deviceIdInfo)
        if (deviceType === 'webrtc') {
          eventDispatch('phone-island-create', {})
          eventDispatch('phone-island-attach', { deviceInformationObject })
        } else {
          eventDispatch('phone-island-detach', { deviceInformationObject })
          eventDispatch('phone-island-destroy', {})
        }
      } catch (err) {
        console.log(err)
      }
    }
  }

  const [firstRender, setFirstRender] = useState(true)
  const [getPinError, setGetPinError] = useState('')
  const [pinObject, setPinObject] = useState<any>({})

  useEffect(() => {
    if (firstRender) {
      setFirstRender(false)
      return
    }
    const retrievePinStatus = async () => {
      try {
        setGetPinError('')
        const pin = await getDevicesPin()
        setPinObject(pin)
      } catch (error) {
        setGetPinError('Cannot retrieve pin information')
      }
    }
    retrievePinStatus()
  }, [firstRender])

  const [phoneLinkFirstRender, setPhoneLinkFirstRender]: any = useState(true)
  const [phoneLinkTimeStampError, setPhoneLinkTimeStampError] = useState('')
  const [phoneLinkTimestamp, setPhoneLinkTimestamp]: any = useState({})
  const [phoneLinkTimestampLoaded, setPhoneLinkTimestampLoaded] = useState(false)

  useEffect(() => {
    if (phoneLinkFirstRender) {
      setPhoneLinkFirstRender(false)
      return
    }
    // and every time a reload is required
    // res is like this: { timestamp: '2024-03-21 10:23:44.087' }
    const getPhoneLinkValue = async () => {
      if (!phoneLinkTimestampLoaded && profile?.lkhash !== undefined) {
        try {
          setPhoneLinkTimeStampError('')
          const res = await getTimestamp()
          // Sort the speed dials and update the list
          setPhoneLinkTimestamp(res?.data)
          setPhoneLinkTimestampLoaded(true)
        } catch (error) {
          setPhoneLinkTimeStampError('Cannot retrieve timestamp information')
        }
      }
    }
    getPhoneLinkValue()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneLinkFirstRender, phoneLinkTimestampLoaded, profile?.lkhash])

  const webphoneTable = () => {
    return (
      <>
        <div>
          <span className='rounded-t-lg bg-indigo-300 dark:bg-indigo-800 pt-1 pb-3 px-6 gap-10 text-base font-normal font-poppins text-gray-900 dark:text-gray-50'>
            <FontAwesomeIcon icon={faHeadset} className='mr-2 h-4 w-4' />
            {t('Devices.Web phone')}
          </span>
          <div className='relative overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700'>
            <table className='w-full table-fixed'>
              <thead>
                <tr>
                  <th className={`${STYLES.tableHeader} ${STYLES.nameColumnWidth}`}>
                    {t('Devices.Name')}
                  </th>
                  <th className={`${STYLES.tableHeader} ${STYLES.statusColumnWidth}`}>
                    {t('Devices.Status')}
                  </th>
                  <th className={`${STYLES.tableHeader} ${STYLES.defaultColumnWidth}`}>
                    {t('Devices.Default')}
                  </th>
                  <th className={`${STYLES.tableHeader} ${STYLES.actionsColumnWidth}`}></th>
                </tr>
              </thead>
              <tbody>
                <tr className='border-t border-gray-300 dark:border-gray-700'>
                  <td className={`${STYLES.tableCell} max-w-0 overflow-hidden`}>
                    <div className='flex items-center'>
                      <CustomThemedTooltip id={`tooltip-button-web-phone`} place='top' />
                      <p
                        className='truncate'
                        data-tooltip-id={`tooltip-button-web-phone`}
                        data-tooltip-content={t('Devices.Web phone')}
                      >
                        {t('Devices.Web phone')}
                      </p>
                    </div>
                  </td>
                  <td className={STYLES.tableCell}>
                    {operators?.extensions[webrtcData[0]?.id]?.status !== 'offline' ? (
                      <div className='flex items-center'>
                        <FontAwesomeIcon
                          icon={faCircleCheck}
                          className='mr-2 h-4 w-4 text-green-700 dark:text-green-600'
                        />
                        {t('Devices.Online')}
                      </div>
                    ) : (
                      <div className='flex items-center'>
                        <FontAwesomeIcon
                          icon={faCircleXmark}
                          className='mr-2 h-4 w-4 text-gray-700 dark:text-gray-400'
                        />
                        <span className='text-gray-500 dark:text-gray-200'>
                          {t('Devices.Offline')}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className={STYLES.tableCell}>
                    {webrtcData[0]?.id === profile?.default_device?.id ? (
                      <Badge
                        size='small'
                        variant='online'
                        rounded='full'
                        className='whitespace-nowrap'
                      >
                        <span>{t('Devices.Main device')}</span>
                      </Badge>
                    ) : (
                      <span className='text-transparent cursor-default select-none'>
                        {t('Devices.Main device')}
                      </span>
                    )}
                  </td>
                  <td className={`${STYLES.tableCell} whitespace-nowrap text-right`}>
                    <div className='flex items-center justify-end'>
                      <Button
                        variant='ghost'
                        onClick={() => openShowSwitchDeviceInputOutput('')}
                        className='relative'
                        data-tooltip-id='tooltip-audio-video-settings'
                        data-tooltip-content={t('Devices.Audio and video settings')}
                      >
                        <FontAwesomeIcon icon={faPenToSquare} className='xl:mr-2 mr-0 h-4 w-4' />
                        <CustomThemedTooltip
                          id='tooltip-audio-video-settings'
                          place='top'
                          className='inline xl:hidden'
                        />
                        <span className='hidden xl:inline'>
                          {t('Devices.Audio and video settings')}
                        </span>
                      </Button>
                      {webrtcData?.[0]?.id !== profile?.default_device?.id &&
                      phoneLinkData?.[0]?.id !== profile?.default_device?.id ? (
                        <Dropdown
                          items={setMainDeviceMenu(
                            webrtcData?.[0]?.id,
                            'webrtc',
                            webrtcData?.[0],
                            false,
                          )}
                          position='leftSingleItem'
                        >
                          <Button variant='ghost'>
                            <FontAwesomeIcon
                              icon={faEllipsisVertical}
                              className='h-4 w-4 text-primary dark:text-primaryDark'
                            />
                          </Button>
                        </Dropdown>
                      ) : (
                        ''
                      )}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </>
    )
  }

  const phoneLinkTable = () => {
    return (
      <>
        <div>
          <span className='rounded-t-lg bg-indigo-300 dark:bg-indigo-800 pt-1 pb-3 px-6 gap-10 text-base font-normal font-poppins text-gray-900 dark:text-gray-50'>
            <FontAwesomeIcon icon={faDesktop} className='mr-2 h-4 w-4' />
            {t('Devices.PhoneLink')}
          </span>
          <div className='relative overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700'>
            <table className='w-full table-fixed'>
              <thead>
                <tr>
                  <th className={`${STYLES.tableHeader} ${STYLES.nameColumnWidth}`}>
                    {t('Devices.Name')}
                  </th>
                  <th className={`${STYLES.tableHeader} ${STYLES.statusColumnWidth}`}>
                    {t('Devices.Status')}
                  </th>
                  <th className={`${STYLES.tableHeader} ${STYLES.defaultColumnWidth}`}>
                    {t('Devices.Default')}
                  </th>
                  <th className={`${STYLES.tableHeader} ${STYLES.actionsColumnWidth}`}></th>
                </tr>
              </thead>
              <tbody>
                <tr className='border-t border-gray-300 dark:border-gray-700'>
                  <td className={`${STYLES.tableCell} max-w-0 overflow-hidden`}>
                    <div className='flex items-center'>
                      <CustomThemedTooltip id={`tooltip-button-desktop-phone`} place='top' />
                      <p
                        className='truncate'
                        data-tooltip-id={`tooltip-button-desktop-phone`}
                        data-tooltip-content={t('Devices.PhoneLink')}
                      >
                        {t('Devices.PhoneLink')}
                      </p>
                    </div>
                  </td>
                  <td className={STYLES.tableCell}>
                    {operators?.extensions[phoneLinkData[0]?.id]?.status !== 'offline' ? (
                      <div className='flex items-center'>
                        <FontAwesomeIcon
                          icon={faCircleCheck}
                          className='mr-2 h-4 w-4 text-green-700 dark:text-green-600'
                        />
                        {t('Devices.Online')}
                      </div>
                    ) : (
                      <div className='flex items-center'>
                        <FontAwesomeIcon
                          icon={faCircleXmark}
                          className='mr-2 h-4 w-4 text-gray-700 dark:text-gray-400'
                        />
                        <span className='text-gray-500 dark:text-gray-200'>
                          {t('Devices.Offline')}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className={STYLES.tableCell}>
                    {phoneLinkData[0]?.id === profile?.default_device?.id ? (
                      <Badge
                        size='small'
                        variant='online'
                        rounded='full'
                        className='whitespace-nowrap'
                      >
                        <span>{t('Devices.Main device')}</span>
                      </Badge>
                    ) : (
                      <span className='text-transparent cursor-default select-none'>
                        {t('Devices.Main device')}
                      </span>
                    )}
                  </td>
                  <td className={`${STYLES.tableCell} whitespace-nowrap text-right`}>
                    <div className='flex items-center justify-end'>
                      {!isEmpty(phoneLinkTimestamp) ? (
                        <a
                          href='nethlink://open'
                          target='_blank'
                          rel='noreferrer'
                          className='text-primary dark:text-primaryDark'
                        >
                          <Button
                            variant='ghost'
                            className='relative'
                            data-tooltip-id='tooltip-phonetlink-settings'
                            data-tooltip-content={t('Devices.PhoneLink settings')}
                          >
                            <FontAwesomeIcon
                              icon={faArrowUpFromBracket}
                              className='xl:mr-2 mr-0 h-4 w-4'
                            />
                            <CustomThemedTooltip
                              id='tooltip-phonetlink-settings'
                              place='top'
                              className='inline xl:hidden'
                            />
                            <span className='hidden xl:inline'>
                              {t('Devices.PhoneLink settings')}
                            </span>
                          </Button>
                        </a>
                      ) : (
                        phoneLinkDownloadComponent(false)
                      )}
                      <Dropdown
                        items={setMainDeviceMenu(
                          phoneLinkData[0]?.id,
                          'nethLink',
                          phoneLinkData[0],
                          true,
                        )}
                        position='leftSingleItem'
                      >
                        <Button variant='ghost'>
                          <FontAwesomeIcon
                            icon={faEllipsisVertical}
                            className='h-4 w-4 text-primary dark:text-primaryDark'
                          />
                        </Button>
                      </Dropdown>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </>
    )
  }

  const ipPhoneTable = () => {
    return (
      <>
        <div>
          <span className='rounded-t-lg bg-indigo-300 dark:bg-indigo-800 pt-1 pb-3 px-6 gap-10 text-base font-normal font-poppins text-gray-900 dark:text-gray-50'>
            <FontAwesomeIcon icon={faOfficePhone as IconProp} className='mr-2 h-4 w-4' />
            {phoneData?.length > 1 ? t('Devices.Physical phones') : t('Devices.Physical phone')}
          </span>
          <div className='relative overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700'>
            <table className='w-full table-fixed'>
              <thead>
                <tr>
                  <th className={`${STYLES.tableHeader} ${STYLES.nameColumnWidth}`}>
                    {t('Devices.Name')}
                  </th>
                  <th className={`${STYLES.tableHeader} ${STYLES.statusColumnWidth}`}>
                    {t('Devices.Status')}
                  </th>
                  <th className={`${STYLES.tableHeader} ${STYLES.defaultColumnWidth}`}>
                    {t('Devices.Default')}
                  </th>
                  <th className={`${STYLES.tableHeader} ${STYLES.actionsColumnWidth}`}></th>
                </tr>
              </thead>
              <tbody>
                {phoneData.map((phone: any) => (
                  <tr key={phone?.id} className='border-t border-gray-300 dark:border-gray-700'>
                    <td className={`${STYLES.tableCell} max-w-0 overflow-hidden`}>
                      <div className='flex items-center'>
                        <CustomThemedTooltip
                          id={`tooltip-button-${phone?.description}`}
                          place='top'
                        />
                        <p
                          className='truncate'
                          data-tooltip-id={`tooltip-button-${phone?.description}`}
                          data-tooltip-content={
                            phone?.description !== '' ? phone?.description : t('Devices.IP phone')
                          }
                        >
                          {phone?.description !== '' ? phone?.description : t('Devices.IP phone')}
                        </p>
                      </div>
                    </td>
                    <td className={STYLES.tableCell}>
                      {operators?.extensions[phone?.id]?.status !== 'offline' ? (
                        <div className='flex items-center'>
                          <FontAwesomeIcon
                            icon={faCircleCheck}
                            className='mr-2 h-4 w-4 text-green-700 dark:text-green-600'
                          />
                          {t('Devices.Online')}
                        </div>
                      ) : (
                        <div className='flex items-center'>
                          <FontAwesomeIcon
                            icon={faCircleXmark}
                            className='mr-2 h-4 w-4 text-gray-700 dark:text-gray-400'
                          />
                          <span className='text-gray-500 dark:text-gray-200'>
                            {t('Devices.Offline')}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className={STYLES.tableCell}>
                      {phone?.id === profile?.default_device?.id ? (
                        <Badge
                          size='small'
                          variant='online'
                          rounded='full'
                          className='whitespace-nowrap'
                        >
                          <span>{t('Devices.Main device')}</span>
                        </Badge>
                      ) : (
                        <span className='text-transparent cursor-default select-none'>
                          {t('Devices.Main device')}
                        </span>
                      )}
                    </td>
                    <td className={`${STYLES.tableCell} whitespace-nowrap text-right`}>
                      <div className='flex items-center justify-end'>
                        {profile?.profile?.macro_permissions?.nethvoice_cti?.permissions
                          ?.phone_buttons?.value && (
                          <Button
                            variant='ghost'
                            onClick={() => openShowEditPhysicalPhone(phone, pinObject)}
                            className='relative'
                            data-tooltip-id='tooltip-device-settings'
                            data-tooltip-content={t('Devices.Device settings')}
                          >
                            <FontAwesomeIcon
                              icon={faPenToSquare}
                              className='xl:mr-2 mr-0 h-4 w-4'
                            />
                            <CustomThemedTooltip
                              id='tooltip-device-settings'
                              place='top'
                              className='inline xl:hidden'
                            />
                            <span className='hidden xl:inline'>{t('Devices.Device settings')}</span>
                          </Button>
                        )}
                        {phone?.id !== profile?.default_device?.id && (
                          <Dropdown
                            items={setMainDeviceMenu(phone?.id, 'physical', phone, false)}
                            position='leftSingleItem'
                          >
                            <Button variant='ghost'>
                              <FontAwesomeIcon
                                icon={faEllipsisVertical}
                                className='h-4 w-4 text-primary dark:text-primaryDark'
                              />
                            </Button>
                          </Dropdown>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className='py-6 px-4 sm:p-6'>
        <div>
          <h2 className='text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 mb-6'>
            {t('Devices.Devices')}
          </h2>
        </div>
        <div className='gap-8 flex flex-col'>
          {/* Web phone table */}
          {webrtcData?.length !== 0 && webphoneTable()}

          {/* PhoneLink section */}
          {profile?.lkhash !== undefined && phoneLinkData?.length !== 0 && phoneLinkTable()}

          {/* Physical phones section */}
          {phoneData?.length > 0 && ipPhoneTable()}
        </div>
      </div>
    </>
  )
}
export default Devices
