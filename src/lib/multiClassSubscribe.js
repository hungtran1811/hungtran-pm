/**
 * Gộp realtime từ nhiều lớp — mỗi lớp một subscription, merge kết quả.
 * @param {string[]} classCodes
 * @param {(classCode: string, onData: Function, onError?: Function) => () => void} subscribeFn
 */
export function subscribeManyByClass(classCodes, subscribeFn, onData, onError) {
  if (!classCodes.length) {
    onData([]);
    return () => {};
  }
  const buckets = Object.fromEntries(classCodes.map((code) => [code, []]));
  const unsubs = classCodes.map((code) =>
    subscribeFn(
      code,
      (items) => {
        buckets[code] = items;
        onData(classCodes.flatMap((c) => buckets[c] || []));
      },
      onError,
    ),
  );
  return () => unsubs.forEach((unsub) => unsub());
}
