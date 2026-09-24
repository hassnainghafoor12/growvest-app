import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../src/context/AuthContext';
import { useRouter } from 'expo-router';
import {
  Bell,
  ArrowUpRight,
  ArrowDownLeft,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react-native';

export default function HomeScreen() {
  const { profile, user, refreshProfile } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Investor';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />
        }
      >
        {/* Top Header */}
        <View style={styles.topHeader}>
          <View>
            <Text style={styles.greetingText}>Welcome back,</Text>
            <Text style={styles.userNameText}>{displayName}</Text>
          </View>
          <TouchableOpacity style={styles.notificationBtn} activeOpacity={0.8}>
            <Bell size={20} color="#E2E8F0" />
            <View style={styles.unreadDot} />
          </TouchableOpacity>
        </View>

        {/* KYC Verification Alert if not verified */}
        {profile?.kyc_status !== 'verified' && (
          <TouchableOpacity
            style={styles.kycBanner}
            onPress={() => router.push('/(app)/(tabs)/profile')}
            activeOpacity={0.9}
          >
            <AlertTriangle size={20} color="#F59E0B" />
            <View style={styles.kycTextContainer}>
              <Text style={styles.kycTitle}>Complete Identity Verification</Text>
              <Text style={styles.kycSubtitle}>Unlock full investment and withdrawal access</Text>
            </View>
            <ChevronRight size={18} color="#F59E0B" />
          </TouchableOpacity>
        )}

        {/* Portfolio Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>TOTAL PORTFOLIO VALUE</Text>
            <View style={styles.liveBadge}>
              <View style={styles.pulseDot} />
              <Text style={styles.liveText}>REALTIME</Text>
            </View>
          </View>

          <Text style={styles.balanceAmount}>$0.00</Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Available</Text>
              <Text style={styles.statValue}>$0.00</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Invested</Text>
              <Text style={styles.statValue}>$0.00</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Total Profit</Text>
              <Text style={[styles.statValue, { color: '#10B981' }]}>+$0.00</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={styles.actionBtnPrimary}
              onPress={() => router.push('/(app)/(tabs)/wallet')}
              activeOpacity={0.8}
            >
              <ArrowDownLeft size={18} color="#0A0F1D" />
              <Text style={styles.actionBtnPrimaryText}>Deposit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtnSecondary}
              onPress={() => router.push('/(app)/(tabs)/investments')}
              activeOpacity={0.8}
            >
              <TrendingUp size={18} color="#10B981" />
              <Text style={styles.actionBtnSecondaryText}>Invest</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtnSecondary}
              onPress={() => router.push('/(app)/(tabs)/wallet')}
              activeOpacity={0.8}
            >
              <ArrowUpRight size={18} color="#E2E8F0" />
              <Text style={[styles.actionBtnSecondaryText, { color: '#E2E8F0' }]}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Insights Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Featured Opportunities</Text>
          <TouchableOpacity onPress={() => router.push('/(app)/(tabs)/investments')}>
            <Text style={styles.seeAllText}>See all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.emptyFeaturedCard}>
          <ShieldCheck size={32} color="#10B981" />
          <Text style={styles.emptyFeaturedTitle}>Real-Asset Backed Investments</Text>
          <Text style={styles.emptyFeaturedSub}>
            Discover verified agriculture, green energy, and fixed return plans managed by Growvest.
          </Text>
          <TouchableOpacity
            style={styles.exploreBtn}
            onPress={() => router.push('/(app)/(tabs)/investments')}
          >
            <Text style={styles.exploreBtnText}>Explore Plans</Text>
          </TouchableOpacity>
        </View>
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
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greetingText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  userNameText: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 2,
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  kycBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    gap: 12,
  },
  kycTextContainer: {
    flex: 1,
  },
  kycTitle: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '700',
  },
  kycSubtitle: {
    color: '#CBD5E1',
    fontSize: 11,
    marginTop: 2,
  },
  balanceCard: {
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#064E3B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 5,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
  },
  liveText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '700',
  },
  balanceAmount: {
    color: '#F8FAFC',
    fontSize: 34,
    fontWeight: '800',
    marginVertical: 14,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0A0F1D',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#1E293B',
  },
  statLabel: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 4,
  },
  statValue: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 12,
    height: 44,
    gap: 6,
  },
  actionBtnPrimaryText: {
    color: '#0A0F1D',
    fontSize: 14,
    fontWeight: '700',
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    height: 44,
    gap: 6,
  },
  actionBtnSecondaryText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  seeAllText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyFeaturedCard: {
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  emptyFeaturedTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyFeaturedSub: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  exploreBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#064E3B',
    borderWidth: 1,
    borderColor: '#059669',
    borderRadius: 10,
  },
  exploreBtnText: {
    color: '#34D399',
    fontSize: 13,
    fontWeight: '700',
  },
});
