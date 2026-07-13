import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Text } from '../src/components/Text';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useBills } from '../src/lib/useBills';
import { uploadBillPhoto } from '../src/lib/uploadPhoto';
import { theme } from '../src/theme';

const { colors, radius, font } = theme;

const CATEGORIES = ['visit', 'labs', 'meds', 'procedure', 'other'] as const;

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatDisplay(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function BillAddScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { addBill } = useBills();

  const [amountText, setAmountText] = useState('');
  const [categories, setCategories] = useState<string[]>(['other']);
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [note, setNote] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const pickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { setSaveError(t('billAdd.errorPhotoLibrary')); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5 });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { setSaveError(t('billAdd.errorCamera')); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.5 });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const handleSave = async () => {
    setSaveError(null);
    const amount = parseFloat(amountText.replace(',', '.'));
    if (!amountText.trim() || isNaN(amount) || amount <= 0) {
      setSaveError(t('billAdd.errorInvalidAmount'));
      return;
    }
    setSaving(true);
    let photo_path: string | null = null;
    if (photoUri) {
      const uploaded = await uploadBillPhoto(photoUri);
      if (!uploaded) console.warn('Photo upload failed, saving bill without photo.');
      else photo_path = uploaded;
    }
    const result = await addBill({
      amount,
      categories: categories.length > 0 ? categories : ['other'],
      bill_date: toYMD(date),
      merchant: merchant.trim() || null,
      note: note.trim() || null,
      photo_path, visit_id: null,
    });
    setSaving(false);
    if (result.ok) router.back();
    else setSaveError(result.error ?? t('common.failedToSave'));
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <Text style={styles.label}>{t('billAdd.amount')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('billAdd.amountPlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="decimal-pad"
          returnKeyType="done"
        />

        <Text style={styles.label}>{t('billAdd.category')}</Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map((c) => {
            const active = categories.includes(c);
            return (
              <TouchableOpacity
                key={c}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() =>
                  setCategories(prev =>
                    prev.includes(c)
                      ? prev.length > 1 ? prev.filter(x => x !== c) : prev
                      : [...prev, c],
                  )
                }
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {t(`billAdd.cat_${c}`, { defaultValue: c })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>{t('billAdd.whereOptional')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('billAdd.wherePlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={merchant} onChangeText={setMerchant} returnKeyType="next"
        />

        <Text style={styles.label}>{t('billAdd.date')}</Text>
        <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPicker(true)}>
          <Ionicons name="calendar-outline" size={18} color={colors.primary} style={{ marginRight: 8 }} />
          <Text style={styles.dateBtnText}>{formatDisplay(date)}</Text>
        </TouchableOpacity>
        {showPicker && (
          <DateTimePicker
            value={date} mode="date" display="spinner" maximumDate={new Date()}
            onChange={(_e, selected) => { setShowPicker(Platform.OS === 'ios'); if (selected) setDate(selected); }}
          />
        )}
        {showPicker && Platform.OS === 'ios' && (
          <TouchableOpacity style={styles.doneBtn} onPress={() => setShowPicker(false)}>
            <Text style={styles.doneBtnText}>{t('common.done')}</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.label}>{t('billAdd.noteOptional')}</Text>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          placeholder={t('billAdd.notePlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={note} onChangeText={setNote} multiline numberOfLines={3} textAlignVertical="top"
        />

        <Text style={styles.label}>{t('billAdd.photoOptional')}</Text>
        {photoUri ? (
          <View style={styles.photoPreviewWrap}>
            <Image source={{ uri: photoUri }} style={styles.photoPreview} />
            <TouchableOpacity style={styles.removePhoto} onPress={() => setPhotoUri(null)}>
              <Ionicons name="close-circle" size={24} color={colors.danger} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.photoButtons}>
            <TouchableOpacity style={styles.photoBtn} onPress={pickFromLibrary}>
              <Ionicons name="image-outline" size={20} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.photoBtnText}>{t('billAdd.photoLibrary')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
              <Ionicons name="camera-outline" size={20} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.photoBtnText}>{t('billAdd.photoCamera')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave} disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.saveBtnText}>{photoUri ? t('billAdd.uploading') : t('billAdd.saveExpense')}</Text>}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 48 },

  label: {
    fontFamily: font.semibold,
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 20,
  },

  input: {
    fontFamily: font.regular,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.text,
  },
  inputMulti: { height: 90, paddingTop: 11 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.tintBlue },
  chipText: { fontFamily: font.semibold, fontSize: 13, color: colors.textMuted },
  chipTextActive: { color: colors.primary },

  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateBtnText: { fontFamily: font.regular, fontSize: 15, color: colors.text },
  doneBtn: { alignSelf: 'flex-end', marginTop: 6 },
  doneBtnText: { fontFamily: font.bold, color: colors.primary, fontSize: 14 },

  photoButtons: { flexDirection: 'row', gap: 10 },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 11,
  },
  photoBtnText: { fontFamily: font.semibold, color: colors.primary, fontSize: 14 },
  photoPreviewWrap: { position: 'relative', alignSelf: 'flex-start' },
  photoPreview: { width: 120, height: 120, borderRadius: radius.sm },
  removePhoto: { position: 'absolute', top: -8, right: -8 },

  errorText: { fontFamily: font.regular, fontSize: 13, color: colors.danger, marginTop: 12 },

  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontFamily: font.bold, color: '#fff', fontSize: 16 },
});
