import React, { useState } from 'react';
import {
  KeyboardTypeOptions,
  Platform,
  Pressable,
  ReturnKeyTypeOptions,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';

interface AuthInputFieldProps {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  showPasswordToggle?: boolean;
  isPasswordVisible?: boolean;
  onTogglePasswordVisibility?: () => void;
  showClearButton?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: any;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  trailingHeader?: React.ReactNode;
}

export function AuthInputField({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  showPasswordToggle = false,
  isPasswordVisible = false,
  onTogglePasswordVisibility,
  showClearButton = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoComplete,
  returnKeyType,
  onSubmitEditing,
  trailingHeader,
}: AuthInputFieldProps) {
  const { colors, dark } = useAppTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.inputGroup}>
      <View style={styles.headerRow}>
        <Text style={[styles.inputLabel, { color: dark ? '#94A3B8' : '#64748B' }]}>
          {label}
        </Text>
        {trailingHeader}
      </View>

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: dark ? '#0F172A' : '#FFFFFF',
            borderColor: focused
              ? '#6366F1'
              : dark
              ? 'rgba(255, 255, 255, 0.1)'
              : '#E2E8F0',
          },
          focused && styles.inputContainerFocused,
        ]}
      >
        {/* Left Icon Pill */}
        <View
          style={[
            styles.iconBadge,
            {
              backgroundColor: focused
                ? (dark ? 'rgba(99, 102, 241, 0.24)' : '#EEF2FF')
                : (dark ? 'rgba(255, 255, 255, 0.06)' : '#F8FAFC'),
            },
          ]}
        >
          <MaterialCommunityIcons
            name={icon}
            size={18}
            color={focused ? '#4F46E5' : (dark ? '#94A3B8' : '#64748B')}
          />
        </View>

        {/* Text Input */}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={dark ? '#64748B' : '#94A3B8'}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.textInput, { color: colors.text }]}
        />

        {/* Clear Button */}
        {showClearButton && value.length > 0 && (
          <Pressable
            onPress={() => onChangeText('')}
            hitSlop={8}
            style={styles.actionBtn}
          >
            <MaterialCommunityIcons
              name="close-circle"
              size={18}
              color={dark ? '#64748B' : '#94A3B8'}
            />
          </Pressable>
        )}

        {/* Password Eye Toggle */}
        {showPasswordToggle && onTogglePasswordVisibility && (
          <Pressable
            onPress={onTogglePasswordVisibility}
            hitSlop={8}
            style={styles.actionBtn}
          >
            <MaterialCommunityIcons
              name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={dark ? '#94A3B8' : '#64748B'}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inputGroup: {
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  inputContainerFocused: {
    borderWidth: 1.5,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
    ...Platform.select({
      web: {
        outlineWidth: 0,
      },
    }),
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: Platform.OS === 'ios' ? 4 : 2,
    ...Platform.select({
      web: {
        outlineWidth: 0,
      },
    }),
  },
  actionBtn: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
