import * as IT from 'io-ts';
import { gql } from 'urql';

import { PublicKey } from '@hub/types/decoders/PublicKey';
import { RealmCategory } from '@hub/types/decoders/RealmCategory';
import { RichTextDocument } from '@hub/types/decoders/RichTextDocument';

export const getDabraList = gql`
  query dabra {
    realmDropdownList {
      bannerImageUrl
      category
      displayName
      iconUrl
      name
      publicKey
      shortDescription
      twitterFollowerCount
      urlId
      clippedHeading(charLimit: 100) {
        document
        isClipped
      }
    }
  }
`;

export const getDabraListResp = IT.type({
  realmDropdownList: IT.array(
    IT.type({
      bannerImageUrl: IT.union([IT.null, IT.string]),
      category: RealmCategory,
      displayName: IT.union([IT.null, IT.string]),
      iconUrl: IT.union([IT.null, IT.string]),
      name: IT.string,
      publicKey: PublicKey,
      shortDescription: IT.union([IT.null, IT.string]),
      twitterFollowerCount: IT.number,
      urlId: IT.string,
      clippedHeading: IT.union([
        IT.null,
        IT.type({
          document: RichTextDocument,
          isClipped: IT.boolean,
        }),
      ]),
    }),
  ),
});
