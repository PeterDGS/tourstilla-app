import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, addDays, startOfWeek, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../../src/context/AuthContext';
import { getMyTours, updateTour, Tour } from '../../src/api/api';

export default function GuideHomeScreen() {
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const { user, logout } = useAuth();
  const router = useRouter();

  const loadTours = useCallback(async () => {
    try {
      const response = await getMyTours();
      setTours(response.data);
    } catch (error) {
      console.error('Error loading tours:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTours();
  }, [loadTours]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadTours();
  };

  const handleLogout = () => {
    Alert.alert('Cerrar Sesión', '¿Estás seguro de que deseas salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/');
        },
      },
    ]);
  };

  const handleAcceptTour = async (tour: Tour) => {
    try {
      await updateTour(tour.id, { accepted: !tour.accepted });
      loadTours();
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el tour');
    }
  };

  const getDates = () => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  };

  const filteredTours = tours.filter((tour) => {
    try {
      const tourDate = parseISO(tour.date);
      return isSameDay(tourDate, selectedDate);
    } catch {
      return false;
    }
  });

  const hasTours = (date: Date) => {
    return tours.some((tour) => {
      try {
        return isSameDay(parseISO(tour.date), date);
      } catch {
        return false;
      }
    });
  };

  const goToPreviousWeek = () => {
    setWeekStart(addDays(weekStart, -7));
  };

  const goToNextWeek = () => {
    setWeekStart(addDays(weekStart, 7));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00d9c0" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hola, {user?.name}</Text>
          <Text style={styles.subtitle}>Tours Asignados</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#ff6b6b" />
        </TouchableOpacity>
      </View>

      {/* Calendar Strip */}
      <View style={styles.calendarContainer}>
        <TouchableOpacity onPress={goToPreviousWeek} style={styles.arrowButton}>
          <Ionicons name="chevron-back" size={24} color="#00d9c0" />
        </TouchableOpacity>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.calendarStrip}>
          {getDates().map((date, index) => {
            const isSelected = isSameDay(date, selectedDate);
            const hasToursOnDay = hasTours(date);
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dateItem,
                  isSelected && styles.dateItemSelected,
                ]}
                onPress={() => setSelectedDate(date)}
              >
                <Text style={[styles.monthText, isSelected && styles.dateTextSelected]}>
                  {format(date, 'MMM', { locale: es }).toUpperCase()}
                </Text>
                <Text style={[styles.dayNumber, isSelected && styles.dateTextSelected]}>
                  {format(date, 'd')}
                </Text>
                <Text style={[styles.dayName, isSelected && styles.dateTextSelected]}>
                  {format(date, 'EEE', { locale: es }).toUpperCase()}
                </Text>
                {hasToursOnDay && <View style={styles.tourIndicator} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity onPress={goToNextWeek} style={styles.arrowButton}>
          <Ionicons name="chevron-forward" size={24} color="#00d9c0" />
        </TouchableOpacity>
      </View>

      {/* Tours List */}
      <ScrollView
        style={styles.toursList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#00d9c0" />
        }
      >
        {filteredTours.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color="#444" />
            <Text style={styles.emptyText}>No hay tours para este día</Text>
          </View>
        ) : (
          filteredTours.map((tour) => (
            <View key={tour.id} style={styles.tourCard}>
              <View style={styles.timeContainer}>
                <Text style={styles.tourTime}>{tour.time}</Text>
              </View>
              <View style={styles.tourInfo}>
                <Text style={styles.tourName}>{tour.tour_name}</Text>
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={14} color="#888" />
                  <Text style={styles.tourLocation}>{tour.location}</Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.acceptButton,
                    tour.accepted && styles.acceptedButton,
                  ]}
                  onPress={() => handleAcceptTour(tour)}
                >
                  <Ionicons
                    name={tour.accepted ? 'checkmark-circle' : 'checkmark-circle-outline'}
                    size={18}
                    color={tour.accepted ? '#1a1a2e' : '#00d9c0'}
                  />
                  <Text
                    style={[
                      styles.acceptButtonText,
                      tour.accepted && styles.acceptedButtonText,
                    ]}
                  >
                    {tour.accepted ? 'Aceptado' : 'Aceptar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Stats Footer */}
      <View style={styles.footer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{tours.length}</Text>
          <Text style={styles.statLabel}>Total Tours</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{tours.filter((t) => t.accepted).length}</Text>
          <Text style={styles.statLabel}>Aceptados</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{tours.filter((t) => !t.accepted).length}</Text>
          <Text style={styles.statLabel}>Pendientes</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  greeting: {
    fontSize: 14,
    color: '#888',
  },
  subtitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  logoutButton: {
    padding: 8,
  },
  calendarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  arrowButton: {
    padding: 8,
  },
  calendarStrip: {
    flex: 1,
  },
  dateItem: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginHorizontal: 4,
    borderRadius: 12,
    backgroundColor: '#16213e',
    minWidth: 60,
  },
  dateItemSelected: {
    backgroundColor: '#00d9c0',
  },
  monthText: {
    fontSize: 10,
    color: '#888',
    marginBottom: 2,
  },
  dayNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  dayName: {
    fontSize: 10,
    color: '#888',
    marginTop: 2,
  },
  dateTextSelected: {
    color: '#1a1a2e',
  },
  tourIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00d9c0',
    marginTop: 4,
  },
  toursList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
  },
  tourCard: {
    flexDirection: 'row',
    backgroundColor: '#16213e',
    borderRadius: 16,
    marginVertical: 8,
    overflow: 'hidden',
  },
  timeContainer: {
    backgroundColor: '#2a2a4a',
    paddingHorizontal: 16,
    paddingVertical: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  tourTime: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  tourInfo: {
    flex: 1,
    padding: 16,
  },
  tourName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00d9c0',
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tourLocation: {
    fontSize: 14,
    color: '#888',
    marginLeft: 4,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00d9c0',
  },
  acceptedButton: {
    backgroundColor: '#00d9c0',
    borderColor: '#00d9c0',
  },
  acceptButtonText: {
    color: '#00d9c0',
    marginLeft: 6,
    fontWeight: '600',
  },
  acceptedButtonText: {
    color: '#1a1a2e',
  },
  footer: {
    flexDirection: 'row',
    backgroundColor: '#16213e',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00d9c0',
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#2a2a4a',
  },
});
