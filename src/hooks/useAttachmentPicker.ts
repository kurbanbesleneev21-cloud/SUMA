import { Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { MAX_ATTACHMENTS } from '@/services/payload';
import type { PickedItem } from '@/services/attachments';
import { t } from '@/i18n';

const askSettings = (message: string) =>
  Alert.alert(t('attach.permissionTitle'), message, [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('attach.openSettings'), onPress: () => Linking.openSettings() },
  ]);

const fromAsset = (a: ImagePicker.ImagePickerAsset): PickedItem => {
  const kind = a.type === 'video' ? 'video' : 'image';
  const fallbackName = kind === 'video' ? `video-${Date.now()}.mp4` : `photo-${Date.now()}.jpg`;
  return {
    uri: a.uri,
    kind,
    name: a.fileName || fallbackName,
    mime: a.mimeType || (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
    size: a.fileSize ?? new File(a.uri).size ?? 0,
    w: a.width || undefined,
    h: a.height || undefined,
    dur: a.duration ? a.duration / 1000 : undefined,
  };
};

export async function pickFromGallery(): Promise<PickedItem[]> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: true,
    selectionLimit: MAX_ATTACHMENTS,
    quality: 1,
    videoMaxDuration: 0,
  });
  return res.canceled ? [] : res.assets.map(fromAsset);
}

export async function captureWithCamera(mode: 'photo' | 'video'): Promise<PickedItem[]> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    askSettings(t('attach.cameraDenied'));
    return [];
  }
  const res = await ImagePicker.launchCameraAsync({
    mediaTypes: mode === 'video' ? ['videos'] : ['images'],
    quality: 1,
    videoMaxDuration: 180,
  });
  return res.canceled ? [] : res.assets.map(fromAsset);
}

export async function pickDocuments(): Promise<PickedItem[]> {
  const res = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, type: '*/*' });
  if (res.canceled) return [];
  return res.assets.slice(0, MAX_ATTACHMENTS).map((a) => {
    const mime = a.mimeType ?? 'application/octet-stream';
    const kind = mime.startsWith('image/') && !mime.includes('svg') ? 'image' : mime.startsWith('video/') ? 'video' : 'file';
    // Documents picked as files are sent untouched even when they are images.
    return { uri: a.uri, kind: kind === 'image' ? 'file' : kind, name: a.name, mime, size: a.size ?? new File(a.uri).size ?? 0 };
  });
}
