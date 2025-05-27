import * as IT from 'io-ts';
import { gql } from 'urql';

import { PublicKey } from '@hub/types/decoders/PublicKey';

export const getDabraList = gql`
  query realmDropdownList {
    realmDropdownList {
      name
      publicKey
      iconUrl
      urlId
    }
  }
`;

export const getDabraListResp = IT.type({
  realmDropdownList: IT.array(
    IT.type({
      name: IT.string,
      publicKey: PublicKey,
      iconUrl: IT.union([IT.null, IT.string]),
      urlId: IT.string,
    }),
  ),
});
