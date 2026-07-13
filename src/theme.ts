export const theme = {
  colors: {
    // Core palette (spec)
    primary:       '#0891B2',
    primaryDark:   '#0F766E',
    bg:            '#F0FDFA',
    card:          '#FFFFFF',
    text:          '#134E4A',
    muted:         '#64748B',
    iconIdle:      '#8CA3A0',
    heartIdle:     '#9CB5B2',
    banner:        '#134E4A',
    bannerAccent:  '#5EEAD4',
    bannerSub:     '#99F6E4',
    tagGreenBg:    '#DCFCE7',
    tagGreenText:  '#16A34A',
    tagTealBg:     '#CCFBF1',
    tagTealText:   '#0F766E',
    tabPill:       '#CCFBF1',
    danger:        '#DC2626',

    // Compatibility aliases (used by secondary screens)
    textMuted:     '#64748B',
    textLight:     '#8CA3A0',
    border:        'rgba(19,78,74,0.08)',
    checkboxBorder:'rgba(19,78,74,0.15)',
    surfaceAlt:    '#E6FAF7',
    dangerBg:      '#FEF2F2',
    promoBg:       '#F0FDFA',

    // Semantic status tokens
    warningBg:     '#FEF3C7',
    warningText:   '#B45309',
    warningIcon:   '#D97706',
    dangerBorder:  '#FECACA',
    dangerText:    '#DC2626',
    infoBg:        '#CCFBF1',
    infoText:      '#0F766E',
    successBg:     '#DCFCE7',
    successText:   '#16A34A',

    // Old tint tokens mapped to new palette
    tintBlue:      '#CCFBF1',
    tintBlueIcon:  '#0F766E',
    tintMint:      '#DCFCE7',
    tintMintIcon:  '#16A34A',
    tintPeach:     '#FEF3C7',
    tintPeachIcon: '#D97706',
    tintYellow:    '#FEF3C7',
    tintYellowIcon:'#D97706',
    tintLilac:     '#EDE9FE',
    tintLilacIcon: '#7C3AED',
    tintSky:       '#E0F2FE',
    tintSkyIcon:   '#0369A1',
  },

  font: {
    regular:  'Figtree_400Regular',
    medium:   'Figtree_500Medium',
    semibold: 'Figtree_600SemiBold',
    bold:     'Figtree_700Bold',
  },

  radius: {
    sm:   12,
    md:   14,
    lg:   16,
    pill: 999,
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },

  shadow: {
    shadowColor:   '#134E4A',
    shadowOpacity: 0.08,
    shadowRadius:  4,
    shadowOffset:  { width: 0, height: 2 },
    elevation:     2,
  },
} as const;
