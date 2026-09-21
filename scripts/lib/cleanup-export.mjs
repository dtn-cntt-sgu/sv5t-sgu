// Database completion is deliberately last: errors retain rows and quota usage.
export async function cleanupExport({
  verifyBackup,
  renewLease,
  listObjects,
  deleteObjects,
  finish,
  signal,
}) {
  await verifyBackup();
  while (true) {
    signal?.throwIfAborted();
    await renewLease();
    const objects = await listObjects();
    if (!objects.length) break;
    const result = await deleteObjects(objects);
    if (result.Errors?.length) throw new Error("Partial delete");
  }
  signal?.throwIfAborted();
  await finish();
}
