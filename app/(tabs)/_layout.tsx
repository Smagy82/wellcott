import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import { useEffect } from 'react';
import { Text } from '../../src/components/Text';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import {
  FirstAidKit,
  MapTrifold,
  Wallet,
  UserCircle,
} from 'phosphor-react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { theme } from '../../src/theme';

const { colors, font } = theme;
const SCREEN_WIDTH = Dimensions.get('window').width;
const BAR_H = 58;
const BAR_MX = 16;
const BAR_W = SCREEN_WIDTH - BAR_MX * 2;
const TAB_W = BAR_W / 4;
const INDICATOR_H = 50;
const SPRING = { mass: 1, damping: 14, stiffness: 180 } as const;
const PRESS_SPRING = { mass: 0.6, damping: 10, stiffness: 200 } as const;

const TABS = [
  { name: 'index',   labelKey: 'tabs.clinics', Icon: FirstAidKit },
  { name: 'map',     labelKey: 'tabs.map',     Icon: MapTrifold  },
  { name: 'help',    labelKey: 'tabs.help',    Icon: Wallet      },
  { name: 'profile', labelKey: 'tabs.profile', Icon: UserCircle  },
] as const;

type TabEntry = typeof TABS[number];

function TabButton({
  entry,
  active,
  onPress,
}: {
  entry: TabEntry;
  active: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSpring(0.88, PRESS_SPRING, () => {
      scale.value = withSpring(1, SPRING);
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const { Icon } = entry;

  return (
    <Pressable
      style={styles.tab}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Animated.View style={[styles.tabInner, animStyle]}>
        <Icon
          weight={active ? 'fill' : 'regular'}
          size={23}
          color={active ? colors.primary : colors.iconIdle}
        />
        <Text
          style={[styles.tabLabel, active && styles.tabLabelActive]}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {t(entry.labelKey)}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const indicatorX = useSharedValue(state.index * TAB_W);

  useEffect(() => {
    indicatorX.value = withSpring(state.index * TAB_W, SPRING);
  }, [state.index]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  return (
    <View
      style={[
        styles.barWrap,
        { bottom: Math.max(insets.bottom, 16) + 10 },
      ]}
      pointerEvents="box-none"
    >
      <BlurView intensity={72} tint="light" style={styles.blur}>
        <View style={styles.innerBorder} />
        <Animated.View style={[styles.indicator, indicatorStyle]} />
        {TABS.map((entry, i) => (
          <TabButton
            key={entry.name}
            entry={entry}
            active={state.index === i}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: state.routes[i]?.key ?? '',
                canPreventDefault: true,
              });
              if (!event.defaultPrevented) {
                navigation.navigate(entry.name);
              }
            }}
          />
        ))}
      </BlurView>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index"   options={{ title: 'Clinics' }} />
      <Tabs.Screen name="map"     options={{ title: 'Map'     }} />
      <Tabs.Screen name="help"    options={{ title: 'Help'    }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  barWrap: {
    position: 'absolute',
    left: BAR_MX,
    right: BAR_MX,
    height: BAR_H,
    borderRadius: 999,
    shadowColor: '#134E4A',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  blur: {
    flex: 1,
    borderRadius: 999,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  innerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    zIndex: 2,
    pointerEvents: 'none',
  },
  indicator: {
    position: 'absolute',
    left: 0,
    top: (BAR_H - INDICATOR_H) / 2,
    width: TAB_W,
    height: INDICATOR_H,
    borderRadius: 999,
    backgroundColor: colors.tabPill,
  },
  tab: {
    width: TAB_W,
    height: BAR_H,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: {
    fontFamily: font.semibold,
    fontSize: 10,
    color: colors.iconIdle,
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    fontFamily: font.bold,
    color: colors.primary,
  },
});
