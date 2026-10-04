export async function copyLatestIntoSchoolPack({
  classFolderId,
  packFolderName,
  studentFolderName,
  previousPackFileIds = [],
  files = [],
  findOrCreateSchoolPackStudentFolder,
  copyDriveFile,
  deleteDriveFile,
}) {
  const { packFolderId, studentFolderId } = await findOrCreateSchoolPackStudentFolder(
    classFolderId,
    packFolderName,
    studentFolderName,
  );
  const removed = [...new Set(previousPackFileIds.map((id) => String(id || '').trim()).filter(Boolean))];
  for (const fileId of removed) {
    try {
      await deleteDriveFile(fileId);
    } catch (error) {
      if (error?.status !== 404) throw error;
    }
  }
  const copiedIds = [];
  for (const file of files) {
    const copied = await copyDriveFile({
      fileId: file.driveFileId,
      folderId: studentFolderId,
      name: file.storedFileName,
    });
    copiedIds.push(copied.id);
  }
  return { packFolderId, studentFolderId, copiedIds };
}
