import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, SlideInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { useColors, useTheme } from '@/contexts/ThemeContext';
import { avatarGradients, radius } from '@/constants/theme';
import { useT } from '@/i18n';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

export const tap = () => {
  Haptics.selectionAsync().catch(() => {});
};

// Entering animation that respects the "animations" setting.
export const useEntering = () => {
  const { animations } = useTheme();
  return (delay = 0) => (animations ? FadeInDown.duration(320).delay(Math.min(delay, 400)) : undefined);
};

const gradientFor = (seed: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return avatarGradients[h % avatarGradients.length];
};

export function Avatar({ name, seed, size = 48, online }: { name: string; seed: string; size?: number; online?: boolean | null }) {
  const c = useColors();
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
  return (
    <View style={{ width: size, height: size }}>
      <LinearGradient colors={gradientFor(seed)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.38 }}>{initials}</Text>
      </LinearGradient>
      {online ? (
        <View style={{ position: 'absolute', right: 0, bottom: 0, width: size * 0.28, height: size * 0.28, borderRadius: size, backgroundColor: c.success, borderWidth: 2.5, borderColor: c.background }} />
      ) : null}
    </View>
  );
}

export function Logo({ size = 40, wordmark = true }: { size?: number; wordmark?: boolean }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size * 0.3, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontSize: size * 0.52, fontWeight: '900' }}>N</Text>
      </LinearGradient>
      {wordmark ? <Text style={{ color: c.text, fontSize: size * 0.6, fontWeight: '900', marginLeft: size * 0.28, letterSpacing: size * 0.1 }}>NEXO</Text> : null}
    </View>
  );
}

function PressScale({ children, onPress, disabled, style, onLongPress }: { children: React.ReactNode; onPress?: () => void; onLongPress?: () => void; disabled?: boolean; style?: ViewStyle | ViewStyle[] }) {
  const { animations } = useTheme();
  const s = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      onPressIn={() => {
        if (animations) s.value = withSpring(0.96, { damping: 18, stiffness: 400 });
      }}
      onPressOut={() => {
        s.value = withSpring(1, { damping: 14, stiffness: 300 });
      }}
    >
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: IconName;
  style?: ViewStyle;
}) {
  const c = useColors();
  const off = disabled || loading;
  const fg = variant === 'secondary' ? c.text : variant === 'ghost' ? c.primary : '#fff';
  const content = loading ? (
    <ActivityIndicator color={fg} />
  ) : (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 16, fontWeight: '700' }}>{title}</Text>
    </View>
  );
  return (
    <PressScale onPress={onPress} disabled={off} style={[{ opacity: off ? 0.5 : 1, borderRadius: radius.md, overflow: 'hidden' }, style ?? {}]}>
      {variant === 'primary' ? (
        <LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.button}>
          {content}
        </LinearGradient>
      ) : (
        <View style={[styles.button, { backgroundColor: variant === 'danger' ? c.danger : variant === 'secondary' ? c.surfaceAlt : 'transparent' }]}>{content}</View>
      )}
    </PressScale>
  );
}

export function Field({ label, error, icon, right, ...props }: TextInputProps & { label?: string; error?: string | null; icon?: IconName; right?: React.ReactNode }) {
  const c = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={{ color: c.textMuted, fontSize: 13, marginBottom: 6, marginLeft: 4 }}>{label}</Text> : null}
      <View style={[styles.field, { backgroundColor: c.surface, borderColor: error ? c.danger : focused ? c.primary : c.border }]}>
        {icon ? <Ionicons name={icon} size={18} color={focused ? c.primary : c.textMuted} style={{ marginRight: 10 }} /> : null}
        <TextInput
          placeholderTextColor={c.textMuted}
          {...props}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[{ flex: 1, color: c.text, fontSize: 16, paddingVertical: 12 }, props.style]}
        />
        {right}
      </View>
      {error ? <Text style={{ color: c.danger, fontSize: 12, marginTop: 4, marginLeft: 4 }}>{error}</Text> : null}
    </View>
  );
}

export function Header({ title, subtitle, back, right, logo }: { title?: string; subtitle?: string; back?: boolean; right?: React.ReactNode; logo?: boolean }) {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useT();
  return (
    <View style={{ paddingTop: insets.top + 8, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: c.background, flexDirection: 'row', alignItems: 'center' }}>
      {back ? (
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: 12 }} accessibilityLabel={t('common.back')}>
          <Ionicons name="chevron-back" size={26} color={c.text} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        {logo ? (
          <Logo size={34} />
        ) : (
          <Text style={{ color: c.text, fontSize: back ? 20 : 30, fontWeight: '800' }} numberOfLines={1}>
            {title}
          </Text>
        )}
        {subtitle ? <Text style={{ color: c.textMuted, fontSize: 13, marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>{right}</View>
    </View>
  );
}

export function IconButton({ icon, onPress, label, filled, color }: { icon: IconName; onPress: () => void; label: string; filled?: boolean; color?: string }) {
  const c = useColors();
  return (
    <PressScale onPress={onPress} style={{ width: 42, height: 42, borderRadius: 21, overflow: 'hidden' }}>
      <View accessibilityLabel={label} accessibilityRole="button">
        {filled ? (
          <LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconBtn}>
            <Ionicons name={icon} size={21} color="#fff" />
          </LinearGradient>
        ) : (
          <View style={[styles.iconBtn, { backgroundColor: c.surfaceAlt }]}>
            <Ionicons name={icon} size={21} color={color ?? c.text} />
          </View>
        )}
      </View>
    </PressScale>
  );
}

export function Chip({ label, active, onPress, count }: { label: string; active: boolean; onPress: () => void; count?: number }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} style={{ borderRadius: radius.pill, overflow: 'hidden' }}>
      {active ? (
        <LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chip}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{label}</Text>
          {count ? <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12, marginLeft: 6, opacity: 0.85 }}>{count}</Text> : null}
        </LinearGradient>
      ) : (
        <View style={[styles.chip, { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }]}>
          <Text style={{ color: c.textMuted, fontWeight: '600', fontSize: 14 }}>{label}</Text>
          {count ? <Text style={{ color: c.primary, fontWeight: '700', fontSize: 12, marginLeft: 6 }}>{count}</Text> : null}
        </View>
      )}
    </Pressable>
  );
}

export function EmptyState({ icon, title, text, children }: { icon: IconName; title: string; text?: string; children?: React.ReactNode }) {
  const c = useColors();
  const entering = useEntering();
  return (
    <Animated.View entering={entering()} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <LinearGradient colors={[c.primarySoft, 'transparent']} style={{ width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
        <Ionicons name={icon} size={40} color={c.primary} />
      </LinearGradient>
      <Text style={{ color: c.text, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>{title}</Text>
      {text ? <Text style={{ color: c.textMuted, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>{text}</Text> : null}
      {children ? <View style={{ marginTop: 20, alignSelf: 'stretch' }}>{children}</View> : null}
    </Animated.View>
  );
}

export function Loading() {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background }}>
      <ActivityIndicator size="large" color={c.primary} />
    </View>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const c = useColors();
  const t = useT();
  return (
    <Animated.View entering={FadeIn} style={{ margin: 16, padding: 14, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.danger, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Ionicons name="alert-circle" size={20} color={c.danger} />
      <Text style={{ color: c.text, flex: 1 }}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} hitSlop={8}>
          <Text style={{ color: c.primary, fontWeight: '600' }}>{t('common.retry')}</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

export function OfflineBanner() {
  const c = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);
  useEffect(() => NetInfo.addEventListener((s) => setOffline(s.isConnected === false)), []);
  if (!offline) return null;
  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={{ position: 'absolute', top: insets.top + 4, left: 0, right: 0, alignItems: 'center', zIndex: 100 }} pointerEvents="none">
      <View style={{ backgroundColor: c.warning, paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name="cloud-offline" size={14} color="#000" />
        <Text style={{ color: '#000', fontSize: 13, fontWeight: '600' }}>{t('common.offline')}</Text>
      </View>
    </Animated.View>
  );
}

export function Section({ title, children, footer }: { title?: string; children: React.ReactNode; footer?: string }) {
  const c = useColors();
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 22 }}>
      {title ? <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>{title}</Text> : null}
      <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: c.border }}>{children}</View>
      {footer ? <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 8, marginHorizontal: 4, lineHeight: 17 }}>{footer}</Text> : null}
    </View>
  );
}

export function Row({
  icon,
  label,
  value,
  onPress,
  danger,
  right,
  last,
  hint,
}: {
  icon: IconName;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
  last?: boolean;
  hint?: string;
}) {
  const c = useColors();
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: c.border }}>
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: danger ? 'rgba(244,63,94,0.15)' : c.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
        <Ionicons name={icon} size={18} color={danger ? c.danger : c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: danger ? c.danger : c.text, fontSize: 16 }}>{label}</Text>
        {hint ? <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 2 }}>{hint}</Text> : null}
      </View>
      {value ? <Text style={{ color: c.textMuted, fontSize: 15, marginLeft: 8, marginRight: onPress ? 6 : 0, maxWidth: '45%' }} numberOfLines={1}>{value}</Text> : null}
      {right}
      {onPress && !right ? <Ionicons name="chevron-forward" size={18} color={c.textMuted} /> : null}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => ({ backgroundColor: pressed ? c.surfaceAlt : 'transparent' })}>
      {content}
    </Pressable>
  ) : (
    content
  );
}

export function OptionList<T extends string>({ options, value, onChange }: { options: { value: T; label: string; hint?: string }[]; value: T; onChange: (v: T) => void }) {
  const c = useColors();
  return (
    <>
      {options.map((o, i) => (
        <Pressable
          key={o.value}
          onPress={() => {
            tap();
            onChange(o.value);
          }}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: pressed ? c.surfaceAlt : 'transparent', borderBottomWidth: i === options.length - 1 ? 0 : StyleSheet.hairlineWidth, borderBottomColor: c.border })}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontSize: 16 }}>{o.label}</Text>
            {o.hint ? <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 2 }}>{o.hint}</Text> : null}
          </View>
          <Ionicons name={value === o.value ? 'radio-button-on' : 'radio-button-off'} size={22} color={value === o.value ? c.primary : c.textMuted} />
        </Pressable>
      ))}
    </>
  );
}

export interface SheetAction {
  label: string;
  icon: IconName;
  danger?: boolean;
  onPress: () => void;
}

export function ActionSheet({ visible, title, actions, onClose }: { visible: boolean; title?: string; actions: SheetAction[]; onClose: () => void }) {
  const c = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { animations } = useTheme();
  return (
    // Closing is animated by the Modal itself: exit animations inside a Modal can leave an invisible
    // backdrop on screen that swallows touches.
    <Modal visible={visible} transparent animationType={animations ? 'fade' : 'none'} onRequestClose={onClose} statusBarTranslucent>
      {visible ? (
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]}>
            <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel={t('common.close')} />
          </View>
          <Animated.View
            entering={animations ? SlideInDown.springify().damping(20) : undefined}
            style={{ backgroundColor: c.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingBottom: insets.bottom + 10, paddingTop: 8 }}
          >
            <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: c.border, marginBottom: 8 }} />
            {title ? <Text style={{ color: c.textMuted, fontSize: 13, textAlign: 'center', marginBottom: 6, paddingHorizontal: 20 }} numberOfLines={2}>{title}</Text> : null}
            {actions.map((a) => (
              <Pressable
                key={a.label}
                onPress={() => {
                  tap();
                  onClose();
                  a.onPress();
                }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 15, backgroundColor: pressed ? c.surfaceAlt : 'transparent' })}
              >
                <Ionicons name={a.icon} size={22} color={a.danger ? c.danger : c.primary} />
                <Text style={{ color: a.danger ? c.danger : c.text, fontSize: 16, marginLeft: 16 }}>{a.label}</Text>
              </Pressable>
            ))}
          </Animated.View>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  button: { height: 54, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill },
});
