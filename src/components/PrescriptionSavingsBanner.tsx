import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Pill, CaretRight } from 'phosphor-react-native';
import { useTranslation } from 'react-i18next';
import { openPrescriptionSavings } from '../config/partners';
import { theme } from '../theme';
import { useEffect, useRef } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const { colors, font, radius, shadow } = theme;

function Shimmer() {
  const x = useSharedValue(-1);

  useEffect(() => {
    x.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 900 }),
          withDelay(2700, withTiming(-1, { duration: 0 })),
        ),
        -1,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value * 260 }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <LinearGradient
        colors={['transparent', 'rgba(255,255,255,0.12)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}

export function PrescriptionSavingsBanner({ isShareGuarded }: { isShareGuarded?: () => boolean }) {
  const { t } = useTranslation();

  return (
    <Pressable
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      onPress={() => { if (isShareGuarded?.()) return; openPrescriptionSavings(); }}
    >
      <Shimmer />

      <View style={styles.iconBox}>
        <Pill weight="fill" size={22} color={colors.bannerAccent} />
      </View>

      <View style={styles.textBlock}>
        <Text style={styles.title}>{t('prescriptions.bannerTitle')}</Text>
        <Text style={styles.body}>{t('prescriptions.bannerSub')}</Text>
      </View>

      <CaretRight size={16} color={colors.bannerAccent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.banner,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 10,
    overflow: 'hidden',
    ...shadow,
  },
  pressed: { opacity: 0.88 },

  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(94,234,212,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  textBlock: { flex: 1 },
  title: { fontFamily: font.bold, fontSize: 14, color: '#fff', marginBottom: 2 },
  body:  { fontFamily: font.regular, fontSize: 12, color: colors.bannerSub, lineHeight: 17 },
});
