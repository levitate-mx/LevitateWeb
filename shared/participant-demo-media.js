// The only archival demo images permitted on the unauthenticated demo route.
// No participant IDs, Drive IDs or provider URLs belong in this allowlist.
export const participantDemoMediaDefinitions = Object.freeze([
  Object.freeze({
    slot: "foto-1",
    publicPath: "/media/mi-levitate-demo/foto-1.jpg",
    sourcePath: "/assets/participant-demo-photo-prepared.jpg",
    storageKey: "participant-demo/v2/foto-1/2018965137d0164f6f98a31fbece7134388735d10f7071b1033fdd7862cbf408",
    sha256: "2018965137d0164f6f98a31fbece7134388735d10f7071b1033fdd7862cbf408",
    width: 1066,
    height: 1600,
    byteSize: 257663,
  }),
  Object.freeze({
    slot: "foto-2",
    publicPath: "/media/mi-levitate-demo/foto-2.jpg",
    sourcePath: "/assets/participant-demo-photo-blurred-prepared.jpg",
    storageKey: "participant-demo/v2/foto-2/3892e7cba4d8550d3f4ac9b0accc4c85b092895cda22e20bbf840d0bed53a8a8",
    sha256: "3892e7cba4d8550d3f4ac9b0accc4c85b092895cda22e20bbf840d0bed53a8a8",
    width: 720,
    height: 480,
    byteSize: 36895,
  }),
]);

export function getParticipantDemoMediaByPath(pathname) {
  return participantDemoMediaDefinitions.find(photo => photo.publicPath === pathname) || null;
}

export function getParticipantDemoMediaBySlot(slot) {
  return participantDemoMediaDefinitions.find(photo => photo.slot === slot) || null;
}
