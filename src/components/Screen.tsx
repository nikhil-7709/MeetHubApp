import React from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/ThemeContext';

type Props = ScrollViewProps & { children: React.ReactNode; contentStyle?: ViewStyle; scroll?: boolean };

export function Screen({ children, contentStyle, scroll = true, ...props }: Props) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  if (!scroll) {
    return <View style={[styles.fill, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }, contentStyle]}>{children}</View>;
  }
  return (
    <ScrollView
      style={[styles.fill, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 28 }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...props}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 }, content: { paddingHorizontal: 22, flexGrow: 1 } });
