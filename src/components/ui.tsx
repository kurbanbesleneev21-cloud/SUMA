import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { useColors } from '@/contexts/ThemeContext';
import { gradients, radius } from '@/constants/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const colorFor = (seed: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return gradients[h % gradients.length];
};

export function Avatar({ name, seed, size = 48, online }: { name: string; seed: string; size?: number; online?: boolean }) {
  const c = useColors();
  const [a, b] = colorFor(seed);
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: a, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', right: -size * 0.3, bottom: -size * 0.3, width: size, height: size, borderRadius: size / 2, backgroundColor: b, opacity: 0.7 }} />
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.38 }}>{initials}</Text>
      </View>
      {online ? (
        <View style={{ position: 'absolute', right: 0, bottom: 0, width: size * 0.28, height: size * 0.28, borderRadius: size, backgroundColor: c.success, borderWidth: 2, borderColor: c.background }} />
      ) : null}
    </View>
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
  const bg = { primary: c.primary, secondary: c.surfaceAlt, danger: c.danger, ghost: 'transparent' }[variant];
  const fg = variant === 'secondary' ? c.text : variant === 'ghost' ? c.primary : '#fff';
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: off ? 0.5 : pressed ? 0.85 : 1 }, style]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={{ color: fg, fontSize: 16, fontWeight: '600' }}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Field({ label, error, icon, ...props }: TextInputProps & { label?: string; error?: string | null; icon?: IconName }) {
  const c = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={{ color: c.textMuted, fontSize: 13, marginBottom: 6, marginLeft: 4 }}>{label}</Text> : null}
      <View style={[styles.field, { backgroundColor: c.surface, borderColor: error ? c.danger : focused ? c.primary : c.border }]}>
        {icon ? <Ionicons name={icon} size={18} color={c.textMuted} style={{ marginRight: 10 }} /> : null}
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
      </View>
      {error ? <Text style={{ color: c.danger, fontSize: 12, marginTop: 4, marginLeft: 4 }}>{error}</Text> : null}
    </View>
  );
}

export function Header({ title, subtitle, back, right }: { title: string; subtitle?: string; back?: boolean; right?: React.ReactNode }) {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 8, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: c.background, flexDirection: 'row', alignItems: 'center' }}>
      {back ? (
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: 12 }} accessibilityLabel="Назад">
          <Ionicons name="chevron-back" size={26} color={c.text} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontSize: back ? 20 : 30, fontWeight: '800' }} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text style={{ color: c.textMuted, fontSize: 13, marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function IconButton({ icon, onPress, label, filled }: { icon: IconName; onPress: () => void; label: string; filled?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: filled ? c.primary : c.surfaceAlt, opacity: pressed ? 0.8 : 1 })}
    >
      <Ionicons name={icon} size={22} color={filled ? '#fff' : c.text} />
    </Pressable>
  );
}

export function EmptyState({ icon, title, text, children }: { icon: IconName; title: string; text?: string; children?: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
        <Ionicons name={icon} size={38} color={c.primary} />
      </View>
      <Text style={{ color: c.text, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>{title}</Text>
      {text ? <Text style={{ color: c.textMuted, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>{text}</Text> : null}
      {children ? <View style={{ marginTop: 20, alignSelf: 'stretch' }}>{children}</View> : null}
    </View>
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
  return (
    <View style={{ margin: 16, padding: 14, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.danger, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Ionicons name="alert-circle" size={20} color={c.danger} />
      <Text style={{ color: c.text, flex: 1 }}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} hitSlop={8}>
          <Text style={{ color: c.primary, fontWeight: '600' }}>Повторить</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function OfflineBanner() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);
  useEffect(() => NetInfo.addEventListener((s) => setOffline(s.isConnected === false)), []);
  if (!offline) return null;
  return (
    <View style={{ position: 'absolute', top: insets.top, left: 0, right: 0, alignItems: 'center', zIndex: 100 }} pointerEvents="none">
      <View style={{ backgroundColor: c.warning, paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name="cloud-offline" size={14} color="#000" />
        <Text style={{ color: '#000', fontSize: 13, fontWeight: '600' }}>Нет подключения к интернету</Text>
      </View>
    </View>
  );
}

export function Section({ title, children, footer }: { title?: string; children: React.ReactNode; footer?: string }) {
  const c = useColors();
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 22 }}>
      {title ? <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>{title}</Text> : null}
      <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden' }}>{children}</View>
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
}: {
  icon: IconName;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
  last?: boolean;
}) {
  const c = useColors();
  const color = danger ? c.danger : c.text;
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: c.border }}>
      <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: danger ? 'rgba(244,63,94,0.15)' : c.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
        <Ionicons name={icon} size={18} color={danger ? c.danger : c.primary} />
      </View>
      <Text style={{ color, fontSize: 16, flex: 1 }}>{label}</Text>
      {value ? <Text style={{ color: c.textMuted, fontSize: 15, marginRight: onPress ? 6 : 0 }} numberOfLines={1}>{value}</Text> : null}
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

const styles = StyleSheet.create({
  button: { height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14 },
});
