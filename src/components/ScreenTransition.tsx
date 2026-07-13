import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { useIsFocused } from '@react-navigation/native';

type Props = { children: React.ReactNode };

export function ScreenTransition({ children }: Props) {
  const focused = useIsFocused();
  const p = useSharedValue(0);

  useEffect(() => {
    if (focused) {
      p.value = 0;
      p.value = withTiming(1, { duration: 240, easing: Easing.bezier(0.2, 0, 0, 1) });
    }
  }, [focused]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [
      { translateY: interpolate(p.value, [0, 1], [10, 0]) },
      { scale: interpolate(p.value, [0, 1], [0.985, 1]) },
    ],
  }));

  return (
    <Animated.View style={[styles.root, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
