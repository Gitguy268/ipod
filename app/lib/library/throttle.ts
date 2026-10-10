/**
 * Calls `work` at most once per interval. Calls that arrive in between are
 * collapsed into one trailing call with the most recent arguments.
 */
export const throttle = <TArgs extends unknown[]>(
  work: (...args: TArgs) => void,
  intervalMs: number
) => {
  let lastRun = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: TArgs | undefined;

  const run = () => {
    timer = undefined;
    lastRun = performance.now();

    if (pending) {
      const args = pending;
      pending = undefined;
      work(...args);
    }
  };

  return (...args: TArgs) => {
    pending = args;

    const wait = intervalMs - (performance.now() - lastRun);

    if (wait <= 0) {
      run();
    } else {
      timer ??= setTimeout(run, wait);
    }
  };
};
