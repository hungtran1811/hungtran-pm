import { describe, expect, it, vi } from 'vitest';
import { copyLatestIntoSchoolPack } from './schoolPack.js';

describe('copyLatestIntoSchoolPack', () => {
  it('copies the latest files into Lesson_14/student and deletes the previous copies', async () => {
    const findOrCreateSchoolPackStudentFolder = vi.fn(async () => ({
      packFolderId: 'pack-1',
      studentFolderId: 'student-pack-1',
    }));
    const deleteDriveFile = vi.fn(async () => {});
    const copyDriveFile = vi.fn(async ({ fileId }) => ({ id: `copy-${fileId}` }));

    const result = await copyLatestIntoSchoolPack({
      classFolderId: 'class-1',
      packFolderName: 'Lesson_14',
      studentFolderName: 'NguyenVanAn',
      previousPackFileIds: ['old-1', 'old-1'],
      files: [
        { driveFileId: 'new-1', storedFileName: 'a.zip' },
        { driveFileId: 'new-2', storedFileName: 'b.py' },
      ],
      findOrCreateSchoolPackStudentFolder,
      copyDriveFile,
      deleteDriveFile,
    });

    expect(findOrCreateSchoolPackStudentFolder).toHaveBeenCalledWith(
      'class-1',
      'Lesson_14',
      'NguyenVanAn',
    );
    expect(deleteDriveFile).toHaveBeenCalledTimes(1);
    expect(deleteDriveFile).toHaveBeenCalledWith('old-1');
    expect(copyDriveFile).toHaveBeenNthCalledWith(1, {
      fileId: 'new-1',
      folderId: 'student-pack-1',
      name: 'a.zip',
    });
    expect(result).toEqual({
      packFolderId: 'pack-1',
      studentFolderId: 'student-pack-1',
      copiedIds: ['copy-new-1', 'copy-new-2'],
    });
  });

  it('keeps copying when a previous pack file is already gone', async () => {
    const missing = new Error('not found');
    missing.status = 404;
    const deleteDriveFile = vi.fn(async () => {
      throw missing;
    });
    const copyDriveFile = vi.fn(async () => ({ id: 'copy-new' }));

    const result = await copyLatestIntoSchoolPack({
      classFolderId: 'class-1',
      packFolderName: 'Lesson_14',
      studentFolderName: 'NguyenVanAn',
      previousPackFileIds: ['old-1'],
      files: [{ driveFileId: 'new-1', storedFileName: 'a.zip' }],
      findOrCreateSchoolPackStudentFolder: async () => ({
        packFolderId: 'pack-1',
        studentFolderId: 'student-pack-1',
      }),
      copyDriveFile,
      deleteDriveFile,
    });

    expect(copyDriveFile).toHaveBeenCalledTimes(1);
    expect(result.copiedIds).toEqual(['copy-new']);
  });
});