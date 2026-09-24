import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../src/context/AuthContext';
import {
  User,
  Mail,
  Shield,
  Gift,
  LogOut,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Clock,
} from 'lucide-react-native';

export default function ProfileScreen() {
  const { user, profile, signOut } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogoutPress = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to end your current session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            await signOut();
            setIsLoggingOut(false);
          },
        },
      ],
      { cancelable: true }
    );
  };

  const getKycBadge = () => {
    switch (profile?.kyc_status) {
      case 'verified':
        return (
          <View style={[styles.badge, { backgroundColor: '#064E3B', borderColor: '#059669' }]}>
            <ShieldCheck size={12} color="#34D399" />
            <Text style={[styles.badgeText, { color: '#34D399' }]}>Verified</Text>
          </View>
        );
      case 'pending':
        return (
          <View style={[styles.badge, { backgroundColor: '#451A03', borderColor: '#D97706' }]}>
            <Clock size={12} color="#FBBF24" />
            <Text style={[styles.badgeText, { color: '#FBBF24' }]}>Under Review</Text>
          </View>
        );
      default:
        return (
          <View style={[styles.badge, { backgroundColor: '#450A0A', borderColor: '#DC2626' }]}>
            <AlertTriangle size={12} color="#F87171" />
            <Text style={[styles.badgeText, { color: '#F87171' }]}>Not Verified</Text>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <User size={36} color="#10B981" />
          </View>
          <Text style={styles.profileName}>{profile?.full_name || 'Growvest User'}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
          <View style={styles.badgeContainer}>{getKycBadge()}</View>
        </View>

        {/* Account Details Card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Information</Text>

          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Mail size={18} color="#94A3B8" />
                <Text style={styles.rowLabel}>Email</Text>
              </View>
              <Text style={styles.rowValue} numberOfLines={1}>
                {user?.email}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Shield size={18} color="#94A3B8" />
                <Text style={styles.rowLabel}>Account Role</Text>
              </View>
              <Text style={[styles.rowValue, { textTransform: 'capitalize' }]}>
                {profile?.role || 'user'}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Gift size={18} color="#94A3B8" />
                <Text style={styles.rowLabel}>Referral Code</Text>
              </View>
              <Text style={[styles.rowValue, styles.referralCode]}>
                {profile?.referral_code || 'N/A'}
              </Text>
            </View>
          </View>
        </View>

        {/* Security & Access Notice */}
        <View style={styles.noticeCard}>
          <Shield size={20} color="#10B981" />
          <View style={styles.noticeTextWrapper}>
            <Text style={styles.noticeTitle}>Zero-Trust Protection</Text>
            <Text style={styles.noticeSub}>
              Your account sessions and financial operations are safeguarded by PostgreSQL Row Level Security (RLS).
            </Text>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogoutPress}
          disabled={isLoggingOut}
          activeOpacity={0.8}
        >
          {isLoggingOut ? (
            <ActivityIndicator color="#EF4444" size="small" />
          ) : (
            <>
              <LogOut size={20} color="#EF4444" />
              <Text style={styles.logoutText}>Sign Out of Growvest</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0F1D',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#131B2E',
    borderWidth: 2,
    borderColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 10,
  },
  badgeContainer: {
    flexDirection: 'row',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowLabel: {
    fontSize: 14,
    color: '#E2E8F0',
    fontWeight: '500',
  },
  rowValue: {
    fontSize: 14,
    color: '#94A3B8',
    maxWidth: '55%',
  },
  referralCode: {
    color: '#10B981',
    fontWeight: '700',
    letterSpacing: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#1E293B',
  },
  noticeCard: {
    flexDirection: 'row',
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    marginBottom: 28,
    gap: 12,
    alignItems: 'center',
  },
  noticeTextWrapper: {
    flex: 1,
  },
  noticeTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  noticeSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 14,
    height: 52,
    gap: 8,
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '700',
  },
});
