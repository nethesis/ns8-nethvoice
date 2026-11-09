import { Html, Head, Main, NextScript } from 'next/document'
import Script from 'next/script'

export default function Document() {
  return (
    <Html>
      <Head>
        <link rel='icon' href='/favicon.ico' />
        <link
          href='https://fonts.googleapis.com/css?family=Poppins&display=swap'
          rel='stylesheet'
        />
      </Head>
      <body className=' text-gray-700 dark:text-gray-100'>
        <Main />
        <NextScript />
        <Script
          src={`config/config.${process.env.NODE_ENV}.js`}
          strategy='beforeInteractive'
        ></Script>
      </body>
    </Html>
  )
}
