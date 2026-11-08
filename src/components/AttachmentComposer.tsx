import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/contexts/ThemeContext';
import { fileIcon } from '@/components/Attachments';
import { formatBytes, formatDuration, PickedItem } from '@/services/attachments';
import { MAX_MESSAGE_LENGTH } from '@/services/chats';
import { radius } from '@/constants/theme';
import { useT } from '@/i18n';

export function AttachmentComposer({
  items,
  onRemove,
  onCancel,
  onSend,
  onAddMore,
}: {
  items: PickedItem[];
  onRemove: (index: number) => void;
  onCancel: () => void;
  onSend: (caption: string, original: boolean) => void;
  onAddMore: () => void;
}) {
  const c = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [caption, setCaption] = useState('');
  const [original, setOriginal] = useState(false);
  const hasImages = items.some((i) => i.kind === 'image');
  const total = items.reduce((n, i) => n + i.size, 0);

  return (
    <Modal visible animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: c.background }}>
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={onCancel} hitSlop={12} accessibilityLabel={t('common.close')}>
            <Ionicons name="close" size={28} color={c.text} />
          </Pressable>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ color: c.text, fontSize: 19, fontWeight: '800' }}>{t('attach.selected', { n: items.length })}</Text>
            <Text style={{ color: c.textMuted, fontSize: 12 }}>{formatBytes(total)}</Text>
          </View>
          <Pressable onPress={onAddMore} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="add-circle" size={22} color={c.primary} />
            <Text style={{ color: c.primary, fontWeight: '600' }}>{t('attach.addMore')}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          {items.map((item, i) => {
            const { icon, color } = fileIcon(item.name, item.mime);
            return (
              <View key={`${item.uri}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: radius.lg, padding: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border }}>
                {item.kind === 'image' ? (
                  <Image source={{ uri: item.uri }} style={{ width: 72, height: 72, borderRadius: 12 }} contentFit="cover" />
                ) : item.kind === 'video' ? (
                  <View style={{ width: 72, height: 72, borderRadius: 12, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="videocam" size={28} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 11, marginTop: 2 }}>{formatDuration(item.dur)}</Text>
                  </View>
                ) : (
                  <View style={{ width: 72, height: 72, borderRadius: 12, backgroundColor: `${color}22`, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={icon} size={32} color={color} />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ color: c.text, fontWeight: '600' }} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 4 }}>
                    {t(`attach.kind.${item.kind}`)} · {formatBytes(item.size)}
                    {item.w && item.h ? ` · ${item.w}×${item.h}` : ''}
                  </Text>
                </View>
                <Pressable onPress={() => onRemove(i)} hitSlop={10} accessibilityLabel={t('attach.remove')} style={{ padding: 6 }}>
                  <Ionicons name="trash-outline" size={20} color={c.danger} />
                </Pressable>
              </View>
            );
          })}

          {hasImages ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: radius.lg, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border }}>
              <Ionicons name="image" size={20} color={c.primary} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: c.text, fontWeight: '600' }}>{t('attach.original')}</Text>
                <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 2 }}>{original ? t('attach.originalOn') : t('attach.originalOff')}</Text>
              </View>
              <Switch value={original} onValueChange={setOriginal} trackColor={{ true: c.primary, false: c.border }} thumbColor="#fff" />
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4 }}>
            <Ionicons name="lock-closed" size={14} color={c.neon} style={{ marginTop: 2 }} />
            <Text style={{ color: c.textMuted, fontSize: 12, flex: 1, lineHeight: 17 }}>{t('attach.e2eNotice')}</Text>
          </View>
        </ScrollView>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 10), backgroundColor: c.surface, gap: 8 }}>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder={t('attach.caption')}
            placeholderTextColor={c.textMuted}
            multiline
            maxLength={MAX_MESSAGE_LENGTH}
            style={{ flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, backgroundColor: c.surfaceAlt, color: c.text, fontSize: 16 }}
          />
          <Pressable onPress={() => onSend(caption, original)} disabled={!items.length} accessibilityLabel={t('chat.send')} style={{ opacity: items.length ? 1 : 0.4 }}>
            <LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="arrow-up" size={24} color="#fff" />
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
