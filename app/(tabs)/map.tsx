import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import MapView from 'react-native-map-clustering';
import { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useNearbyClinics } from '../../src/lib/useNearbyClinics';

const TINT = '#0F6E56';

export default function MapScreen() {
  const { clinics, status, retry } = useNearbyClinics(25);
  const router = useRouter();

  const requestLocation = async () => {
    await Location.requestForegroundPermissionsAsync();
    retry();
  };

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={TINT} />
        <Text style={styles.statusText}>Finding clinics near you…</Text>
      </View>
    );
  }

  if (status === 'no-permission') {
    return (
      <View style={styles.center}>
        <Text style={styles.permTitle}>Location is off</Text>
        <Text style={styles.statusText}>Turn on location to see the map.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestLocation}>
          <Text style={styles.primaryBtnText}>Enable location</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.permTitle}>Something went wrong</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={retry}>
          <Text style={styles.primaryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (clinics.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.statusText}>No clinics nearby.</Text>
      </View>
    );
  }

  const first = clinics[0];
  const initialRegion = {
    latitude: first.latitude,
    longitude: first.longitude,
    latitudeDelta: 0.2,
    longitudeDelta: 0.2,
  };

  return (
    <MapView
      style={styles.map}
      provider={PROVIDER_DEFAULT}
      initialRegion={initialRegion}
      showsUserLocation
      clusterColor={TINT}
      clusterTextColor="#ffffff"
      radius={50}
    >
      {clinics.map((clinic) => (
        <Marker
          key={clinic.id}
          coordinate={{ latitude: clinic.latitude, longitude: clinic.longitude }}
          title={clinic.name}
          description={`${clinic.address}, ${clinic.city}`}
          onCalloutPress={() => router.push(`/clinic/${encodeURIComponent(clinic.id)}`)}
          pinColor={TINT}
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F7F9F8',
  },
  permTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 6 },
  statusText: { fontSize: 14, color: '#555', textAlign: 'center', marginBottom: 18 },
  primaryBtn: {
    backgroundColor: TINT,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 28,
    marginTop: 4,
  },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
