import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useIsFocused } from '@react-navigation/native';

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

type Props = { children: React.ReactNode };

export function ScreenTransition({ children }: Props) {
  const focused = useIsFocused();
  const p = useSharedValue(0);

  useEffect(() => {
    if (focused) {
      p.value = 0;
      p.value = withTiming(1, { duration: 300, easing: Easing.bezier(0.2, 0, 0, 1) });
    }
  }, [focused]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scale: interpolate(p.value, [0, 1], [1.06, 1]) }],
  }));

  const blurProps = useAnimatedProps(() => ({
    intensity: (1 - p.value) * 20,
  }));

  return (
    <Animated.View style={[styles.root, animatedStyle]}>
      {children}
      <AnimatedBlurView
        style={StyleSheet.absoluteFill}
        tint="light"
        animatedProps={blurProps}
        pointerEvents="none"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
