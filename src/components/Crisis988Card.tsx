import { Linking, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from './AppText';
import { theme } from '../theme';

const { colors, radius, shadow } = theme;

export function Crisis988Card() {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <AppText variant="sectionHead" style={styles.title}>{t('mh.crisis988Title')}</AppText>
      <AppText variant="secondary" style={styles.sub}>{t('mh.crisis988Sub')}</AppText>
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.btnCall}
          onPress={() => Linking.openURL('tel:988')}
          activeOpacity={0.82}
        >
          <AppText variant="button" style={styles.btnCallText}>{t('mh.crisis988Call')}</AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnSms}
          onPress={() => Linking.openURL('sms:988')}
          activeOpacity={0.82}
        >
          <AppText variant="button" style={styles.btnSmsText}>{t('mh.crisis988Text')}</AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.dangerBg,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    ...shadow,
  },
  title: {
    color: colors.dangerText,
    marginBottom: 4,
  },
  sub: {
    marginBottom: 14,
    lineHeight: 18,
  },
  row: { flexDirection: 'row', gap: 10 },
  btnCall: {
    flex: 1,
    backgroundColor: colors.danger,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnCallText: { color: '#fff' },
  btnSms: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.danger,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnSmsText: { color: colors.danger },
});
