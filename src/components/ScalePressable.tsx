import { Pressable, type PressableProps } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const SPRING = { mass: 0.5, damping: 10, stiffness: 220 };

interface ScalePressableProps extends PressableProps {
  scale?: number;
  haptics?: boolean;
  children: React.ReactNode;
}

export function ScalePressable({
  scale = 0.96,
  haptics = true,
  onPress,
  children,
  style,
  ...rest
}: ScalePressableProps) {
  const s = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));

  return (
    <Animated.View style={[animStyle, style as object]}>
      <Pressable
        onPressIn={() => { s.value = withSpring(scale, SPRING); }}
        onPressOut={() => { s.value = withSpring(1, SPRING); }}
        onPress={(e) => {
          if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress?.(e);
        }}
        {...rest}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
