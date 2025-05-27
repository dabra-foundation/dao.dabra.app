import * as IT from 'io-ts';
import { gql } from 'urql';

import { PublicKey } from '@hub/types/decoders/PublicKey';

export const followedDabra = gql`
  query {
    me {
      publicKey
      followedDabra {
        displayName
        name
        publicKey
        iconUrl
        urlId
      }
    }
  }
`;

export const follow = gql`
  mutation ($realm: PublicKey!) {
    followRealm(publicKey: $realm) {
      publicKey
      followedDabra {
        displayName
        name
        publicKey
        iconUrl
        urlId
      }
    }
  }
`;

export const unfollow = gql`
  mutation ($realm: PublicKey!) {
    unfollowRealm(publicKey: $realm) {
      publicKey
      followedDabra {
        displayName
        name
        publicKey
        iconUrl
        urlId
      }
    }
  }
`;

export const followedDabraResp = IT.type({
  me: IT.union([
    IT.null,
    IT.type({
      publicKey: PublicKey,
      followedDabra: IT.array(
        IT.type({
          displayName: IT.union([IT.null, IT.string]),
          name: IT.string,
          publicKey: PublicKey,
          iconUrl: IT.union([IT.null, IT.string]),
          urlId: IT.string,
        }),
      ),
    }),
  ]),
});

export const followResp = IT.type({
  followRealm: IT.type({
    publicKey: PublicKey,
    followedDabra: IT.array(
      IT.type({
        displayName: IT.union([IT.null, IT.string]),
        name: IT.string,
        publicKey: PublicKey,
        iconUrl: IT.union([IT.null, IT.string]),
        urlId: IT.string,
      }),
    ),
  }),
});

export const unfollowResp = IT.type({
  unfollowRealm: IT.type({
    publicKey: PublicKey,
    followedDabra: IT.array(
      IT.type({
        displayName: IT.union([IT.null, IT.string]),
        name: IT.string,
        publicKey: PublicKey,
        iconUrl: IT.union([IT.null, IT.string]),
        urlId: IT.string,
      }),
    ),
  }),
});
