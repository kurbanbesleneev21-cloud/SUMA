import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import * as MediaLibrary from 'expo-media-library';
import { File } from 'expo-file-system';
import { AttachmentError } from './attachments';
import { t } from '@/i18n';

const FLAG_GRANT_READ_URI_PERMISSION = 1;

export async function shareFile(uri: string, mime: string, name: string) {
  if (!(await Sharing.isAvailableAsync())) throw new AttachmentError(t('attach.shareUnavailable'));
  await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: name, UTI: undefined });
}

// Android: opens the file in a suitable app; elsewhere (or when no app handles it) falls back to the share sheet.
export async function openFile(uri: string, mime: string, name: string) {
  if (Platform.OS === 'android') {
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: new File(uri).contentUri,
        flags: FLAG_GRANT_READ_URI_PERMISSION,
        type: mime,
      });
      return;
    } catch {
      // No app for this type: let the user choose in the share sheet.
    }
  }
  await shareFile(uri, mime, name);
}

export async function saveToGallery(uri: string) {
  const perm = await MediaLibrary.requestPermissionsAsync(true);
  if (!perm.granted) throw new AttachmentError(t('attach.galleryDenied'));
  await MediaLibrary.saveToLibraryAsync(uri);
}
