import React from 'react'
import Link from 'next/link'
import Head from 'next/head'
import useQueryContext from '@hooks/useQueryContext'

import Header from '@components/Header'
import Text from '@components/Text'
import WalletIcon from '@components/icons/WalletIcon'
import NftIcon from '@components/icons/NftIcon'
import TokenIcon from '@components/icons/TokenIcon'

const New: React.FC = () => {
  const { fmtUrlWithCluster } = useQueryContext()
  const DAO_TYPES = [
    {
      title: 'Multi-Signature Wallet',
      description: 'Create a shared wallet that requires multiple signatures to approve transactions.',
      url: '/dabra/new/multisig',
      icon: <WalletIcon />,
    },
    {
      title: 'NFT Community DAO',
      description: 'Create a DAO for an NFT collection where each NFT represents one vote.',
      url: '/dabra/new/nft',
      icon: <NftIcon />,
    },
    {
      title: 'Community Token DAO',
      description: 'Create a DAO where voting power is determined by the amount of tokens held.',
      url: '/dabra/new/community-token',
      icon: <TokenIcon />,
    },
  ]
  return (
    <>
      <Head>
        <title>Create new DAO | Dabra</title>
      </Head>
      <Header as="h2" className="mt-8 ">
        What type of DAO <br />
        would you like to create?
      </Header>
      <div className="pt-5 pb-4 mx-auto mt-8 rounded lg:mt-16">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {DAO_TYPES.map(({ url, title, description, icon }) => (
            <Link key={title} href={fmtUrlWithCluster(url)}>
              <a className="flex flex-col items-start px-12 py-12 border rounded cursor-pointer border-bkg-2 hover:border hover:border-fgd-1 bg-bkg-3">
                <div className="mb-4">{icon}</div>
                <Header as="h4" className="mb-6">
                  {title}
                </Header>
                <Text level="2" className="text-left text-fgd-2">
                  {description}
                </Text>
              </a>
            </Link>
          ))}
        </div>
        <div className="flex items-center justify-center px-4 mt-10 space-x-8">
          <a
            href="https://governance-docs.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="rounded px-3 py-1.5 hover:text-primary-dark default-transition cursor-pointer underline">
              <span className="text-sm font-semibold">Tutorial Docs</span>
            </div>
          </a>
        </div>
      </div>
    </>
  )
}

export default New
