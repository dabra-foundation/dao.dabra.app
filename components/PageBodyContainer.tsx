import { useRouter } from 'next/router'
import Footer from '@components/Footer'
import { PluginDebug } from '../VoterWeightPlugins/lib/PluginDebug'
import React from 'react'

const PageBodyContainer = ({ children }) => {
  const { pathname, query } = useRouter()
  const isNewDabraWizard = /\/dabra\/new\/\w+/.test(pathname)

  // TODO TEMP DEBUG - REMOVE BEFORE MERGE
  if (query['debug'] !== undefined) {
    return <PluginDebug />
  }

  return (
    <>
      <div
        className={`grid grid-cols-12 gap-4 pt-4 ${
          isNewDabraWizard ? '' : 'min-h-[calc(100vh_-_80px)] pb-12 sm:pb-64'
        }`}
      >
        <div className="z-[1] fixed top-0 left-0 w-[100vw] h-[100vh] bg-bkg-1">

        </div>
        <div className="relative z-[2] col-span-12 px-4 md:px-8 xl:px-4 xl:col-start-2 xl:col-span-10">
          {children}
        </div>
      </div>
      {isNewDabraWizard ? <></> : <Footer />}
    </>
  )
}

export default PageBodyContainer
