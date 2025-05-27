import * as localforage from 'localforage';

export const getName = (jwt: string | null) => {
  if (!jwt) {
    return 'dabra-anon';
  }

  return `dabra-${jwt}`;
};

export const create = (jwt: string | null) => {
  const name = getName(jwt);
  return localforage.createInstance({ name });
};

export const destroy = (jwt: string | null) => {
  const name = getName(jwt);
  return localforage.dropInstance({ name });
};
