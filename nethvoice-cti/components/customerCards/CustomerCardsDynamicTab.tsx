import React from 'react'
import { useTranslation } from 'react-i18next'

interface CustomerCardsDynamicTabProps {
  htmlContent?: string
}

const CustomerCardsDynamicTab: React.FC<CustomerCardsDynamicTabProps> = ({
  htmlContent,
}) => {
  const { t } = useTranslation()

  // Convert from 64 base formatto html
  const base64ToHtml = (base64String: string) => {
    try {
      const decodedString = atob(base64String)
      return { __html: decodedString }
    } catch (error) {
      console.error('Error during conversion', error)
      return { __html: '' }
    }
  }

  return <div dangerouslySetInnerHTML={base64ToHtml(htmlContent || '')} />
}

export default CustomerCardsDynamicTab
