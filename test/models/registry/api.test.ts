import { getCertifiedRealmInfo } from 'models/registry/api'
import { getConnectionContext } from 'utils/connection'
import dabra from 'public/dabra/mainnet-beta.json'

test('getCertifiedRealmInfo', async () => {
  const mango = dabra.find(({ symbol }) => symbol === 'MNGO')!

  const realmInfo = await getCertifiedRealmInfo(
    mango.symbol,
    getConnectionContext('mainnet'),
  )

  expect(realmInfo!.realmId.toBase58()).toEqual(mango.realmId)
})
