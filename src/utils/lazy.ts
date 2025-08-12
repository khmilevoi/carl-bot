export function createLazy<T>(loader: () => Promise<T>): () => Promise<T> {
  let cache: T | undefined;
  let promise: Promise<T> | null = null;
  return async () => {
    if (cache !== undefined) {
      return cache;
    }
    if (!promise) {
      promise = loader().then((value) => {
        cache = value;
        return value;
      });
    }
    return promise;
  };
}
