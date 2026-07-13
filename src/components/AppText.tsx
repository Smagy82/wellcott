import { Text as RNText, TextProps as RNTextProps } from 'react-native';
import { theme } from '../theme';

const { colors, font } = theme;

export type TextVariant =
  | 'largeTitle'   // 32 / bold   / text    / ls -0.6
  | 'heading'      // 22 / bold   / text
  | 'screenTitle'  // 17 / bold   / text
  | 'cardTitle'    // 16 / bold   / text
  | 'sectionHead'  // 15 / semibold / text
  | 'body'         // 14 / medium / text
  | 'secondary'    // 13 / regular / muted
  | 'button'       // 13 / bold   / text   (color overridden by caller)
  | 'caption'      // 12 / regular / muted
  | 'chip'         // 11 / bold   / text   (color overridden by caller)
  | 'tabLabel'     // 10 / semibold / iconIdle
  | 'price';       // 27 / bold   / primary / ls -0.4

const VARIANT_STYLES: Record<TextVariant, object> = {
  largeTitle:  { fontFamily: font.bold,     fontSize: 32, color: colors.text,    letterSpacing: -0.6 },
  heading:     { fontFamily: font.bold,     fontSize: 22, color: colors.text },
  screenTitle: { fontFamily: font.bold,     fontSize: 17, color: colors.text },
  cardTitle:   { fontFamily: font.bold,     fontSize: 16, color: colors.text },
  sectionHead: { fontFamily: font.semibold, fontSize: 15, color: colors.text },
  body:        { fontFamily: font.medium,   fontSize: 14, color: colors.text },
  secondary:   { fontFamily: font.regular,  fontSize: 13, color: colors.muted },
  button:      { fontFamily: font.bold,     fontSize: 13, color: colors.text },
  caption:     { fontFamily: font.regular,  fontSize: 12, color: colors.muted },
  chip:        { fontFamily: font.bold,     fontSize: 11, color: colors.text },
  tabLabel:    { fontFamily: font.semibold, fontSize: 10, color: colors.iconIdle },
  price:       { fontFamily: font.bold,     fontSize: 27, color: colors.primary, letterSpacing: -0.4 },
};

type AppTextProps = RNTextProps & {
  variant?: TextVariant;
};

export function AppText({ variant = 'body', style, ...props }: AppTextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={1.1}
      style={[VARIANT_STYLES[variant], style]}
      {...props}
    />
  );
}
