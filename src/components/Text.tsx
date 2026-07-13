import { Text as RNText, type TextProps } from 'react-native';
import { theme } from '../theme';

const { colors, font } = theme;

export function Text({ style, ...props }: TextProps) {
  return (
    <RNText
      style={[{ fontFamily: font.regular, color: colors.text }, style]}
      {...props}
    />
  );
}
