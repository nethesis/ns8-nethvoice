import type { NextPage } from 'next'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import { useSelector } from 'react-redux'
import { RootState } from '../store'
import { CustomerCardsCustomerData } from '../components/customerCards/CustomerCards'
import { getCustomerCards } from '../lib/customerCard'
import CustomerCardsDynamicTab from '../components/customerCards/CustomerCardsDynamicTab'
import { isEmpty } from 'lodash'
import { getPhonebook } from '../lib/phonebook'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExclamationTriangle, faPhone } from '@fortawesome/free-solid-svg-icons'
import { callPhoneNumber } from '../lib/utils'
import { MissingPermission } from '../components/common/MissingPermissionsPage'

const CustomerCards: NextPage = () => {
  const { t } = useTranslation()
  const [currentTab, setCurrentTab] = useState('generalInfo')
  const [dynamicTabs, setDynamicTabs] = useState<any[]>([])
  const { profile } = useSelector((state: RootState) => state.user)

  //Get user information from store
  const userInformation = useSelector((state: RootState) => state.user)
  const customerCardsInformation = useSelector((state: RootState) => state.customerCards)

  //Get ccard list from store
  // "ccard_order": [
  //    "example1",
  //    "example2",
  //    ................
  // ],

  const [ccardList, setCCardList]: any = useState([])
  const [customerCardsList, setCustomerCardsList]: any = useState({})
  const [urlSynced, setUrlSynced] = useState(false)

  useEffect(() => {
    if (!urlSynced && customerCardsInformation?.settings?.caller_info) {
      const currentQuery = window.location.search
      const storeQuery = customerCardsInformation.settings.caller_info

      // Only update URL if it's different from store or missing
      if (currentQuery !== storeQuery) {
        const newUrl = `${window.location.pathname}${storeQuery}`
        window.history.replaceState({ path: newUrl }, '', newUrl)
      }
      setUrlSynced(true)
    }
  }, [customerCardsInformation, urlSynced])

  //Get extension and contact type value from URL path or if it's empty get from store
  //(Is empty on redirect after phone-island events)
  const getCurrentUrlParts = () => {
    const urlQuery = window.location.search
    const storeQuery = customerCardsInformation?.settings?.caller_info

    const queryToUse = urlQuery || storeQuery || ''
    return queryToUse.replace('?', '').split('-')
  }

  const urlParts = getCurrentUrlParts()
  //Is user or company main extension
  const companyExtension = urlParts[0]

  //ContactType can be "company" or "person"
  const contactType = urlParts[1]

  const [isCustomerCardsListLoaded, setIsCustomerCardsListLoaded] = useState(false)

  const [companyInformation, setCompanyInformations]: any = useState()

  const [firstRender, setFirstRender]: any = useState(true)

  // If company api call company contacType else person contactType
  useEffect(() => {
    if (firstRender) {
      setFirstRender(false)
      return
    }
    async function searchCompanyExtensionInformation() {
      if (companyExtension !== '' && contactType) {
        try {
          //remove space and slash characters
          let noSlashCharactersCompanyExtension = companyExtension?.replace(/\//g, '')
          const res = await getPhonebook(1, noSlashCharactersCompanyExtension, contactType, 'name')

          const result = res?.rows?.filter((item: any) => {
            const normalize = (str: string) => (str || '').replace(/\s+/g, '')
            if (
              normalize(item.workphone) === noSlashCharactersCompanyExtension ||
              normalize(item.homephone) === noSlashCharactersCompanyExtension ||
              normalize(item.cellphone) === noSlashCharactersCompanyExtension ||
              normalize(item.extension) === noSlashCharactersCompanyExtension
            ) {
              return item
            }
          })

          setCompanyInformations({ rows: result })
        } catch (e) {
          console.error(e)
          return []
        }
      }
    }
    searchCompanyExtensionInformation()
  }, [companyExtension, firstRender, contactType])

  // retrieve customer cards
  useEffect(() => {
    async function getCustomerCardsTemplate() {
      if (
        !isCustomerCardsListLoaded &&
        companyExtension &&
        profile?.macro_permissions?.customer_card?.value
      ) {
        try {
          const res = await getCustomerCards(companyExtension)
          setCustomerCardsList(res)
          if (userInformation?.settings?.ccard_order?.length > 0) {
            setCCardList(userInformation?.settings?.ccard_order)
          } else {
            const initialOrder = Object.keys(res)
            setCCardList(initialOrder)
          }
        } catch (e) {
          console.error(e)
        }
        setIsCustomerCardsListLoaded(true)
      }
    }
    getCustomerCardsTemplate()
  }, [isCustomerCardsListLoaded, customerCardsList, companyExtension, profile?.macro_permissions])

  const changeTab = (tabName: string) => {
    setCurrentTab(tabName)
  }

  useEffect(() => {
    if (
      !isEmpty(customerCardsList) &&
      ccardList &&
      ccardList?.length > 0 &&
      dynamicTabs?.length === 0
    ) {
      const tabs = [
        { name: t('CustomerCards.General info'), value: 'generalInfo' },
        ...ccardList
          .map((ccard: any) => {
            const cardData = customerCardsList[ccard]
            if (cardData) {
              return {
                name: cardData?.descr,
                value: ccard,
              }
            }
            return null
          })
          .filter(Boolean),
      ]
      setDynamicTabs(tabs)
    }
  }, [ccardList, customerCardsList, dynamicTabs, isCustomerCardsListLoaded])

  return (
    <>
      {profile?.macro_permissions?.customer_card?.value ? (
        <div>
          <div>
            {/* If contact type is equal to company show company name else user name */}
            <h1 className='flex text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100'>
              {contactType === 'company'
                ? companyInformation?.rows[0]?.company
                : companyInformation?.rows[0]?.name}
            </h1>
            <div className='flex items-center text-sm text-primary dark:text-primaryDark'>
              <FontAwesomeIcon
                icon={faPhone}
                className='mr-2 h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500'
                aria-hidden='true'
              />
              <span
                className='truncate cursor-pointer hover:underline'
                onClick={() => (companyExtension ? callPhoneNumber(companyExtension) : '')}
              >
                {companyExtension || '-'}
              </span>
            </div>

            <div className='mt-1 flex '></div>
          </div>
          {/* tabs */}
          <>
            <div className='mb-6'>
              {/* mobile tabs */}
              <div className='sm:hidden'>
                <label htmlFor='tabs' className='sr-only'>
                  {t('CustomerCards.Select a tab')}
                </label>
                <select
                  id='tabs'
                  name='tabs'
                  className='block w-full rounded-md py-2 pl-3 pr-10 text-base focus:outline-none sm:text-sm border-gray-300 focus:border-primary focus:ring-primary dark:border-gray-600 dark:focus:border-primary dark:focus:ring-primary dark:bg-gray-900'
                  value={currentTab}
                  onChange={(event) => changeTab(event.target.value)}
                >
                  {dynamicTabs.map((tab) => (
                    <option key={tab.value} value={tab.value}>
                      {tab.name}
                    </option>
                  ))}
                </select>
              </div>
              {/* desktop tabs */}
              <div className='hidden sm:block'>
                <div className='border-b border-gray-300 dark:border-gray-600'>
                  <nav className='-mb-px flex space-x-8' aria-label='Tabs'>
                    {!isEmpty(customerCardsList) ? (
                      // Render real tabs when customerCardList is defined
                      dynamicTabs.map((tab) => (
                        <a
                          key={tab.value}
                          onClick={() => changeTab(tab.value)}
                          className={classNames(
                            tab.value === currentTab
                              ? 'border-primary text-primary dark:text-primaryDark'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600',
                            'cursor-pointer whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm',
                          )}
                          aria-current={tab.value === currentTab ? 'page' : undefined}
                        >
                          {tab.name}
                        </a>
                      ))
                    ) : (
                      // Render "General info" tab and loading skeleton when customerCardList is undefined
                      <>
                        <a
                          className={classNames(
                            'border-primary text-primary dark:text-primaryDark',
                            'cursor-pointer whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm',
                          )}
                          onClick={() => changeTab('generalInfo')}
                          aria-current='page'
                        >
                          {t('CustomerCards.General info')}
                        </a>
                      </>
                    )}
                  </nav>
                </div>
              </div>
            </div>
            <div>
              {currentTab === 'generalInfo' ? (
                <CustomerCardsCustomerData
                  companyInformation={companyInformation?.rows[0]}
                  companyExtension={companyExtension}
                  contactType={contactType}
                />
              ) : customerCardsList[currentTab] ? (
                <CustomerCardsDynamicTab htmlContent={customerCardsList[currentTab]?.data} />
              ) : null}
            </div>
          </>
        </div>
      ) : (
        <MissingPermission />
      )}
    </>
  )
}
export default CustomerCards
