import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../src/context/ThemeContext';

export default function TabLayout() {
  const { dark } = useAppTheme();
  const insets = useSafeAreaInsets();

  // Floating dock bottom margin with safe area
  const bottomMargin = Platform.OS === 'ios' ? Math.max(insets.bottom, 16) : 16;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: bottomMargin,
          height: 68,
          borderRadius: 28,
          backgroundColor: dark
            ? 'rgba(15, 23, 42, 0.92)'
            : 'rgba(255, 255, 255, 0.95)',
          borderWidth: 1.2,
          borderColor: dark
            ? 'rgba(255, 255, 255, 0.12)'
            : 'rgba(226, 232, 240, 0.95)',
          borderTopWidth: 1.2,
          borderTopColor: dark
            ? 'rgba(255, 255, 255, 0.16)'
            : 'rgba(255, 255, 255, 0.95)',
          shadowColor: dark ? '#000000' : '#312E81',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: dark ? 0.45 : 0.12,
          shadowRadius: 24,
          elevation: 10,
          paddingHorizontal: 8,
          paddingVertical: 0,
          ...Platform.select({
            web: {
              backdropFilter: 'blur(24px)',
              maxWidth: 500,
              width: '100%',
              marginHorizontal: 'auto',
              left: 0,
              right: 0,
            },
            default: {
              left: 16,
              right: 16,
            },
          }),
        },
        tabBarItemStyle: {
          height: 68,
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name="home-variant-outline"
              focusedName="home-variant"
              label="Home"
              focused={focused}
              dark={dark}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="meetings"
        options={{
          title: 'Meetings',
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name="video-outline"
              focusedName="video"
              label="Meetings"
              focused={focused}
              dark={dark}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name="compass-outline"
              focusedName="compass"
              label="Explore"
              focused={focused}
              dark={dark}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name="calendar-month-outline"
              focusedName="calendar-month"
              label="Calendar"
              focused={focused}
              dark={dark}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name="account-circle-outline"
              focusedName="account-circle"
              label="Profile"
              focused={focused}
              dark={dark}
            />
          ),
        }}
      />
    </Tabs>
  );
}

// ── Custom Tab Item with Capsule Pill & Micro-Typography ─────────────────────
function TabIcon({
  name,
  focusedName,
  label,
  focused,
  dark,
}: {
  name: keyof typeof MaterialCommunityIcons.glyphMap;
  focusedName: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  focused: boolean;
  dark: boolean;
}) {
  return (
    <View style={styles.tabItem}>
      <View
        style={[
          styles.iconPill,
          focused && {
            backgroundColor: dark
              ? 'rgba(99, 102, 241, 0.22)'
              : '#EEF2FF',
            borderColor: dark
              ? 'rgba(99, 102, 241, 0.45)'
              : 'rgba(99, 102, 241, 0.30)',
            borderWidth: 1,
            shadowColor: '#4F46E5',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: dark ? 0.35 : 0.18,
            shadowRadius: 6,
            elevation: 3,
          },
        ]}
      >
        <MaterialCommunityIcons
          name={focused ? focusedName : name}
          size={21}
          color={focused ? (dark ? '#818CF8' : '#4F46E5') : (dark ? '#94A3B8' : '#64748B')}
        />
      </View>
      <Text
        style={[
          styles.tabLabel,
          {
            color: focused
              ? (dark ? '#818CF8' : '#4F46E5')
              : (dark ? '#64748B' : '#94A3B8'),
            fontWeight: focused ? '800' : '600',
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    width: '100%',
  },
  iconPill: {
    width: 44,
    height: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
});
