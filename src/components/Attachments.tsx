import React, { useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/contexts/ThemeContext';
import { IconName } from '@/components/ui';
import { useDecryptedFile } from '@/hooks/useDecryptedFile';
import { fetchDecrypted, formatBytes, formatDuration, PickedItem } from '@/services/attachments';
import { openFile, saveToGallery, shareFile } from '@/services/fileActions';
import { AttachmentRef, extensionOf } from '@/services/payload';
import { humanError } from '@/utils/errors';
import { timeShort } from '@/utils/format';
import { useT } from '@/i18n';

const GRID = 252;

export const fileIcon = (name: string, mime: string): { icon: IconName; color: string } => {
  const ext = extensionOf(name);
  if (ext === 'pdf') return { icon: 'document-text', color: '#EF4444' };
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext)) return { icon: 'document', color: '#3B82F6' };
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return { icon: 'grid', color: '#22C55E' };
  if (['ppt', 'pptx', 'odp', 'key'].includes(ext)) return { icon: 'easel', color: '#F97316' };
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return { icon: 'archive', color: '#F59E0B' };
  if (['txt', 'md', 'log', 'json'].includes(ext)) return { icon: 'reader', color: '#94A3B8' };
  if (mime.startsWith('audio/')) return { icon: 'musical-notes', color: '#EC4899' };
  if (mime.startsWith('image/')) return { icon: 'image', color: '#8B5CF6' };
  if (mime.startsWith('video/')) return { icon: 'film', color: '#8B5CF6' };
  return { icon: 'document-attach', color: '#8B5CF6' };
};

// Upload progress shown on the sender's own pending attachments.
export interface UploadState {
  progress: number[];
  error?: string | null;
}

function ProgressBadge({ fraction }: { fraction: number }) {
  return (
    <View style={styles.badge}>
      <ActivityIndicator size="small" color="#fff" />
      <Text style={styles.badgeText}>{Math.round(fraction * 100)}%</Text>
    </View>
  );
}

function ImageTile({ refItem, local, size, upload, onOpen, onLongPress }: { refItem?: AttachmentRef; local?: string; size: { w: number; h: number }; upload?: number; onOpen: () => void; onLongPress: () => void }) {
  const c = useColors();
  const t = useT();
  const file = useDecryptedFile(refItem ?? null, 'main', true);
  const uri = local ?? file.uri;
  return (
    <Pressable onPress={uri ? onOpen : () => file.start()} onLongPress={onLongPress} delayLongPress={280} style={{ width: size.w, height: size.h, borderRadius: 14, overflow: 'hidden', backgroundColor: c.surfaceAlt }}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} /> : null}
      {upload !== undefined && upload < 1 ? <ProgressBadge fraction={upload} /> : null}
      {!uri && file.progress !== null ? <ProgressBadge fraction={file.progress} /> : null}
      {!uri && file.error ? (
        <View style={styles.center}>
          <Ionicons name="refresh-circle" size={36} color={c.text} accessibilityLabel={t('common.retry')} />
        </View>
      ) : null}
    </Pressable>
  );
}

function VideoTile({ refItem, local, size, upload, onOpen, onLongPress }: { refItem?: AttachmentRef; local?: PickedItem; size: { w: number; h: number }; upload?: number; onOpen: () => void; onLongPress: () => void }) {
  const c = useColors();
  const thumb = useDecryptedFile(refItem?.thumb ? refItem : null, 'thumb', true);
  const dur = refItem?.dur ?? local?.dur;
  const bytes = refItem?.size ?? local?.size ?? 0;
  return (
    <Pressable onPress={onOpen} onLongPress={onLongPress} delayLongPress={280} style={{ width: size.w, height: size.h, borderRadius: 14, overflow: 'hidden', backgroundColor: '#000' }}>
      {thumb.uri ? <Image source={{ uri: thumb.uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      <View style={styles.center}>
        {upload !== undefined && upload < 1 ? (
          <ProgressBadge fraction={upload} />
        ) : (
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="play" size={26} color="#fff" style={{ marginLeft: 3 }} />
          </View>
        )}
      </View>
      <View style={{ position: 'absolute', left: 8, bottom: 8, right: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={styles.chipText}>{formatDuration(dur)}</Text>
        <Text style={styles.chipText}>{formatBytes(bytes)}</Text>
      </View>
      {!thumb.uri && !local ? <Ionicons name="film" size={30} color={c.textMuted} style={{ position: 'absolute', top: 10, left: 10 }} /> : null}
    </Pressable>
  );
}

function FileCard({ refItem, local, own, createdAt, upload, onLongPress }: { refItem?: AttachmentRef; local?: PickedItem; own: boolean; createdAt: string; upload?: number; onLongPress: () => void }) {
  const c = useColors();
  const t = useT();
  const file = useDecryptedFile(refItem ?? null, 'main', false);
  const name = refItem?.name ?? local?.name ?? 'file';
  const mime = refItem?.mime ?? local?.mime ?? 'application/octet-stream';
  const size = refItem?.size ?? local?.size ?? 0;
  const { icon, color } = fileIcon(name, mime);
  const uri = local?.uri ?? file.uri;
  const fg = own ? '#fff' : c.text;
  const muted = own ? 'rgba(255,255,255,0.75)' : c.textMuted;
  const ext = extensionOf(name).toUpperCase() || t('attach.fileType');

  const run = async (action: 'open' | 'share') => {
    try {
      const local2 = uri ?? (await file.start());
      if (!local2) return;
      if (action === 'open') await openFile(local2, mime, name);
      else await shareFile(local2, mime, name);
    } catch (e) {
      Alert.alert(t('common.error'), humanError(e));
    }
  };

  const status =
    upload !== undefined && upload < 1
      ? t('attach.uploading', { p: Math.round(upload * 100) })
      : file.progress !== null
        ? t('attach.downloading', { p: Math.round(file.progress * 100) })
        : file.error
          ? file.error
          : uri
            ? t('attach.ready')
            : t('attach.tapToDownload');

  return (
    <Pressable onPress={() => run('open')} onLongPress={onLongPress} delayLongPress={280} style={{ flexDirection: 'row', alignItems: 'center', width: GRID, paddingVertical: 4 }}>
      <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: own ? 'rgba(255,255,255,0.18)' : `${color}22`, alignItems: 'center', justifyContent: 'center' }}>
        {file.progress !== null || (upload !== undefined && upload < 1) ? (
          <ActivityIndicator color={own ? '#fff' : color} />
        ) : (
          <Ionicons name={uri ? icon : 'arrow-down-circle'} size={26} color={own ? '#fff' : color} />
        )}
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={{ color: fg, fontWeight: '600', fontSize: 15 }} numberOfLines={2}>
          {name}
        </Text>
        <Text style={{ color: muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
          {ext} · {formatBytes(size)} · {timeShort(createdAt)}
        </Text>
        <Text style={{ color: file.error ? c.danger : muted, fontSize: 12, marginTop: 1 }} numberOfLines={1}>
          {status}
        </Text>
      </View>
      {uri ? (
        <Pressable onPress={() => run('share')} hitSlop={10} accessibilityLabel={t('attach.share')} style={{ padding: 6 }}>
          <Ionicons name="share-outline" size={22} color={fg} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const tileSize = (count: number, item?: { w?: number; h?: number }) => {
  if (count === 1) {
    const ratio = item?.w && item?.h ? item.h / item.w : 0.75;
    return { w: GRID, h: Math.max(140, Math.min(340, GRID * ratio)) };
  }
  const s = (GRID - 4) / 2;
  return { w: s, h: s };
};

export function MessageAttachments({
  refs,
  pending,
  upload,
  own,
  createdAt,
  onLongPress,
}: {
  refs: AttachmentRef[];
  pending?: PickedItem[];
  upload?: UploadState;
  own: boolean;
  createdAt: string;
  onLongPress: () => void;
}) {
  const [viewer, setViewer] = useState<number | null>(null);
  const items: { ref?: AttachmentRef; local?: PickedItem; i: number }[] = pending ? pending.map((p, i) => ({ local: p, ref: refs[i], i })) : refs.map((r, i) => ({ ref: r, i }));
  const media = items.filter((x) => (x.ref?.kind ?? x.local?.kind) !== 'file');
  const files = items.filter((x) => (x.ref?.kind ?? x.local?.kind) === 'file');
  const viewable = media.filter((x) => x.ref).map((x) => x.ref!);

  return (
    <View style={{ gap: 6, marginBottom: 4 }}>
      {media.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, width: GRID }}>
          {media.map((x, idx) => {
            const kind = x.ref?.kind ?? x.local?.kind;
            const size = tileSize(media.length, x.ref ?? x.local);
            const open = () => {
              const vi = viewable.findIndex((r) => r.id === x.ref?.id);
              if (vi >= 0) setViewer(vi);
            };
            return kind === 'video' ? (
              <VideoTile key={idx} refItem={x.ref} local={x.local} size={size} upload={upload?.progress[x.i]} onOpen={open} onLongPress={onLongPress} />
            ) : (
              <ImageTile key={idx} refItem={x.ref} local={x.local?.uri} size={size} upload={upload?.progress[x.i]} onOpen={open} onLongPress={onLongPress} />
            );
          })}
        </View>
      ) : null}
      {files.map((x) => (
        <FileCard key={x.i} refItem={x.ref} local={x.local} own={own} createdAt={createdAt} upload={upload?.progress[x.i]} onLongPress={onLongPress} />
      ))}
      {viewer !== null ? <MediaViewer items={viewable} start={viewer} onClose={() => setViewer(null)} /> : null}
    </View>
  );
}

function VideoPage({ uri, active }: { uri: string; active: boolean }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  React.useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls allowsPictureInPicture={false} />;
}

function ViewerPage({ item, active, width, height }: { item: AttachmentRef; active: boolean; width: number; height: number }) {
  const t = useT();
  const file = useDecryptedFile(item, 'main', active);
  const thumb = useDecryptedFile(item.kind === 'video' && item.thumb ? item : null, 'thumb', true);
  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      {file.uri ? (
        item.kind === 'video' ? (
          <VideoPage uri={file.uri} active={active} />
        ) : (
          <Image source={{ uri: file.uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
        )
      ) : (
        <>
          {thumb.uri ? <Image source={{ uri: thumb.uri }} style={[StyleSheet.absoluteFill, { opacity: 0.5 }]} contentFit="contain" blurRadius={8} /> : null}
          {file.error ? (
            <Pressable onPress={() => file.start()} style={{ alignItems: 'center' }}>
              <Ionicons name="refresh-circle" size={56} color="#fff" />
              <Text style={{ color: '#fff', marginTop: 8, textAlign: 'center', paddingHorizontal: 24 }}>{file.error}</Text>
            </Pressable>
          ) : (
            <View style={{ alignItems: 'center' }}>
              <ActivityIndicator color="#fff" size="large" />
              <Text style={{ color: '#fff', marginTop: 10 }}>{t('attach.decrypting', { p: Math.round((file.progress ?? 0) * 100) })}</Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

export function MediaViewer({ items, start, onClose }: { items: AttachmentRef[]; start: number; onClose: () => void }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width, height } = Dimensions.get('window');
  const [index, setIndex] = useState(start);
  const current = items[index];

  const withFile = async (fn: (uri: string) => Promise<void>) => {
    try {
      await fn(await fetchDecrypted(current, 'main'));
    } catch (e) {
      Alert.alert(t('common.error'), humanError(e));
    }
  };

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent supportedOrientations={['portrait', 'landscape']}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <FlatList
          data={items}
          horizontal
          pagingEnabled
          initialScrollIndex={start}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(r) => r.id}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item, index: i }) => <ViewerPage item={item} active={i === index} width={width} height={height} />}
        />
        <View style={{ position: 'absolute', top: insets.top + 8, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel={t('common.close')} style={styles.viewerBtn}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
          <Text style={{ color: '#fff', flex: 1, textAlign: 'center', fontWeight: '600' }}>{items.length > 1 ? `${index + 1} / ${items.length}` : ''}</Text>
          <Pressable onPress={() => withFile((u) => shareFile(u, current.mime, current.name))} hitSlop={12} accessibilityLabel={t('attach.share')} style={styles.viewerBtn}>
            <Ionicons name="share-outline" size={24} color="#fff" />
          </Pressable>
          <Pressable
            onPress={() => withFile(async (u) => {
              await saveToGallery(u);
              Alert.alert(t('common.done'), t('attach.savedToGallery'));
            })}
            hitSlop={12}
            accessibilityLabel={t('attach.saveToGallery')}
            style={styles.viewerBtn}
          >
            <Ionicons name="download-outline" size={24} color="#fff" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', alignSelf: 'center', top: '40%', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  chipText: { color: '#fff', fontSize: 11, fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  viewerBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
});
