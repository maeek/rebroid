export const filterResolved = <T>(promises: PromiseSettledResult<T>[]): T[] => {
  return promises
    .filter(result => result.status === 'fulfilled')
    .map(result => (result as PromiseFulfilledResult<T>).value)
}
