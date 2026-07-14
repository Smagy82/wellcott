import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useEffect, useState } from 'react';
import { Text } from '../src/components/Text';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Check, CalendarBlank } from 'phosphor-react-native';
import { useVisits } from '../src/lib/useVisits';
import { getSaved, getSavedSync, isStoreReady, subscribe as subscribeSaved, type SavedClinic } from '../src/store/savedClinics';
import { theme } from '../src/theme';

const { colors, radius, font, shadow } = theme;

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatDisplay(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type ClinicSource = 'saved' | 'manual' | 'none';

export default function VisitAddScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { addVisit } = useVisits();
  const [favorites, setFavorites] = useState<SavedClinic[]>(() => isStoreReady() ? getSavedSync() : []);

  useEffect(() => { getSaved().then(setFavorites).catch(() => {}); return subscribeSaved(() => { getSaved().then(setFavorites).catch(() => {}); }); }, []);

  const [clinicSource, setClinicSource] = useState<ClinicSource>('none');
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [selectedClinicName, setSelectedClinicName] = useState<string | null>(null);
  const [manualClinicName, setManualClinicName] = useState('');
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const sourceLabels: Record<ClinicSource, string> = {
    none:   t('visitAdd.sourceNone'),
    saved:  t('visitAdd.sourceSaved'),
    manual: t('visitAdd.sourceManual'),
  };

  const handleSave = async () => {
    setSaveError(null);
    setSaving(true);
    let clinic_id: string | null = null;
    let clinic_name: string | null = null;
    if (clinicSource === 'saved') { clinic_id = selectedClinicId; clinic_name = selectedClinicName; }
    else if (clinicSource === 'manual') { clinic_name = manualClinicName.trim() || null; }
    const result = await addVisit({
      clinic_id, clinic_name, visit_date: toYMD(date),
      reason: reason.trim() || null, note: note.trim() || null,
    });
    setSaving(false);
    if (result.ok) router.back();
    else setSaveError(result.error ?? t('common.failedToSave'));
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title={t('visitAdd.navTitle')} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <Text style={styles.label}>{t('visitAdd.clinicOptional')}</Text>
        <View style={styles.segmentRow}>
          {(['none', 'saved', 'manual'] as ClinicSource[]).map((src) => {
            const active = clinicSource === src;
            return (
              <TouchableOpacity
                key={src}
                style={[styles.segment, active && styles.segmentActive]}
                onPress={() => { setClinicSource(src); setSelectedClinicId(null); setSelectedClinicName(null); }}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{sourceLabels[src]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {clinicSource === 'saved' && (
          favorites.length === 0 ? (
            <Text style={styles.hintText}>{t('visitAdd.noSavedClinics')}</Text>
          ) : (
            <View style={styles.savedList}>
              {favorites.map((fav) => {
                const selected = selectedClinicId === fav.id;
                return (
                  <TouchableOpacity
                    key={fav.id}
                    style={[styles.favRow, selected && styles.favRowSelected]}
                    onPress={() => { setSelectedClinicId(fav.id); setSelectedClinicName(fav.name); }}
                  >
                    <Text style={[styles.favName, selected && styles.favNameSelected]} numberOfLines={1}>
                      {fav.name}
                    </Text>
                    {selected && <Check size={18} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )
        )}

        {clinicSource === 'manual' && (
          <TextInput
            style={styles.input}
            placeholder={t('visitAdd.clinicNamePlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={manualClinicName}
            onChangeText={setManualClinicName}
            returnKeyType="done"
          />
        )}

        <Text style={styles.label}>{t('visitAdd.visitDate')}</Text>
        <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPicker(true)}>
          <CalendarBlank size={18} color={colors.primary} style={{ marginRight: 8 }} />
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

        <Text style={styles.label}>{t('visitAdd.reasonOptional')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('visitAdd.reasonPlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={reason} onChangeText={setReason} returnKeyType="next"
        />

        <Text style={styles.label}>{t('visitAdd.noteOptional')}</Text>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          placeholder={t('visitAdd.notePlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={note} onChangeText={setNote} multiline numberOfLines={4} textAlignVertical="top"
        />

        {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave} disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.saveBtnText}>{t('visitAdd.saveVisit')}</Text>}
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

  segmentRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  segment: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  segmentActive: { borderColor: colors.primary, backgroundColor: colors.tintBlue },
  segmentText: { fontFamily: font.semibold, fontSize: 13, color: colors.textMuted },
  segmentTextActive: { color: colors.primary },

  hintText: { fontFamily: font.regular, fontSize: 13, color: colors.textMuted, marginTop: 6 },

  savedList: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    marginTop: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  favRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  favRowSelected: { backgroundColor: colors.tintBlue },
  favName: { fontFamily: font.regular, flex: 1, fontSize: 14, color: colors.text },
  favNameSelected: { fontFamily: font.semibold, color: colors.primary },

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
  inputMulti: { height: 100, paddingTop: 11 },

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
