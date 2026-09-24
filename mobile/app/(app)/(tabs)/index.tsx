import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../src/context/AuthContext';
import { useWallet } from '../../../src/hooks/useWallet';
import { useBanners } from '../../../src/hooks/useBanners';
import { useFeaturedPlans } from '../../../src/hooks/useFeaturedPlans';
import { useUserInvestments } from '../../../src/hooks/useUserInvestments';
import { useRecentTransactions } from '../../../src/hooks/useRecentTransactions';
import { useNotificationsCount } from '../../../src/hooks/useNotificationsCount';
import {
  Bell,
  Eye,
  EyeOff,
  ArrowDownLeft,
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
  Clock,
  Layers,
  Sparkles,
  ArrowRight,
  CircleDollarSign,
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();

  // Realtime hooks
  const { data: wallet, isLoading: walletLoading, refetch: refetchWallet } = useWallet();
  const { data: banners, isLoading: bannersLoading, refetch: refetchBanners } = useBanners();
  const { data: plans, isLoading: plansLoading, refetch: refetchPlans } = useFeaturedPlans(5);
  const { data: userInvestments, isLoading: investmentsLoading, refetch: refetchInvestments } = useUserInvestments();
  const { data: recentTransactions, isLoading: txLoading, refetch: refetchTx } = useRecentTransactions(4);
  const { data: unreadNotifications = 0, refetch: refetchNotifications } = useNotificationsCount();

  const [refreshing, setRefreshing] = useState(false);
  const [hideBalances, setHideBalances] = useState(false);

  // Time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refreshProfile(),
      refetchWallet(),
      refetchBanners(),
      refetchPlans(),
      refetchInvestments(),
      refetchTx(),
      refetchNotifications(),
    ]);
    setRefreshing(false);
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Investor';

  const formatCurrency = (val: number | undefined) => {
    if (hideBalances) return '••••••';
    const amount = Number(val || 0);
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const totalPortfolioValue = (Number(wallet?.available_balance || 0) + Number(wallet?.invested_balance || 0));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#10B981"
            colors={['#10B981']}
            progressBackgroundColor="#131B2E"
          />
        }
      >
        {/* ================= 1. USER HEADER ================= */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.greetingText}>{getGreeting()},</Text>
              <Text style={styles.userNameText} numberOfLines={1}>
                {displayName}
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.push('/(app)/(tabs)/profile')}
              activeOpacity={0.7}
              accessibilityLabel="Notifications"
            >
              <Bell size={20} color="#E2E8F0" />
              {unreadNotifications > 0 && (
                <View style={styles.badgeCount}>
                  <Text style={styles.badgeCountText}>
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ================= 2. KYC ALERT (CONDITIONAL) ================= */}
        {profile && profile.kyc_status !== 'verified' && (
          <TouchableOpacity
            style={styles.kycCard}
            onPress={() => router.push('/(app)/(tabs)/profile')}
            activeOpacity={0.85}
          >
            <View style={styles.kycIconWrapper}>
              {profile.kyc_status === 'pending' ? (
                <Clock size={20} color="#FBBF24" />
              ) : (
                <AlertTriangle size={20} color="#F59E0B" />
              )}
            </View>
            <View style={styles.kycTextCol}>
              <Text style={styles.kycHeading}>
                {profile.kyc_status === 'pending' ? 'KYC Verification In Review' : 'Identity Verification Required'}
              </Text>
              <Text style={styles.kycSub}>
                {profile.kyc_status === 'pending'
                  ? 'Our compliance team is verifying your documents.'
                  : 'Complete verification to activate full withdrawals & investments.'}
              </Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}

        {/* ================= 3. HERO PORTFOLIO BALANCE CARD ================= */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.portfolioLabelGroup}>
              <Text style={styles.portfolioLabel}>TOTAL PORTFOLIO VALUE</Text>
              <TouchableOpacity
                onPress={() => setHideBalances(!hideBalances)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {hideBalances ? (
                  <EyeOff size={16} color="#64748B" />
                ) : (
                  <Eye size={16} color="#64748B" />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.realtimePill}>
              <View style={styles.liveIndicator} />
              <Text style={styles.realtimeText}>REALTIME</Text>
            </View>
          </View>

          {walletLoading ? (
            <View style={styles.loadingBalance}>
              <ActivityIndicator color="#10B981" size="small" />
            </View>
          ) : (
            <Text style={styles.balanceMainText}>
              {formatCurrency(totalPortfolioValue)}
            </Text>
          )}

          {/* Tri-stat row */}
          <View style={styles.triStatContainer}>
            <View style={styles.triStatItem}>
              <Text style={styles.triStatLabel}>Available Cash</Text>
              <Text style={styles.triStatValue}>{formatCurrency(wallet?.available_balance)}</Text>
            </View>
            <View style={styles.triStatDivider} />
            <View style={styles.triStatItem}>
              <Text style={styles.triStatLabel}>Invested Capital</Text>
              <Text style={styles.triStatValue}>{formatCurrency(wallet?.invested_balance)}</Text>
            </View>
            <View style={styles.triStatDivider} />
            <View style={styles.triStatItem}>
              <Text style={styles.triStatLabel}>Total Profit</Text>
              <Text style={[styles.triStatValue, styles.emeraldText]}>
                +{formatCurrency(wallet?.total_profit)}
              </Text>
            </View>
          </View>

          {/* Quick Actions Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.primaryAction}
              onPress={() => router.push('/(app)/(tabs)/wallet')}
              activeOpacity={0.8}
            >
              <ArrowDownLeft size={18} color="#0A0F1D" />
              <Text style={styles.primaryActionText}>Deposit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() => router.push('/(app)/(tabs)/investments')}
              activeOpacity={0.8}
            >
              <TrendingUp size={18} color="#10B981" />
              <Text style={styles.secondaryActionText}>Invest</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() => router.push('/(app)/(tabs)/wallet')}
              activeOpacity={0.8}
            >
              <ArrowUpRight size={18} color="#F8FAFC" />
              <Text style={[styles.secondaryActionText, { color: '#F8FAFC' }]}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ================= 4. PROMOTIONAL BANNERS ================= */}
        {banners && banners.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bannersTrack}
            snapToInterval={width - 48}
            decelerationRate="fast"
          >
            {banners.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={styles.bannerSlide}
                activeOpacity={0.9}
                onPress={() => {
                  if (b.target_screen) router.push(b.target_screen as any);
                }}
              >
                <View style={styles.bannerContent}>
                  <View style={styles.bannerTag}>
                    <Sparkles size={12} color="#34D399" />
                    <Text style={styles.bannerTagText}>FEATURED INITIATIVE</Text>
                  </View>
                  <Text style={styles.bannerTitle} numberOfLines={2}>
                    {b.title}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.defaultPromoBanner}>
            <View style={styles.defaultPromoBadge}>
              <ShieldCheck size={14} color="#10B981" />
              <Text style={styles.defaultPromoBadgeText}>VERIFIED REAL-ASSETS</Text>
            </View>
            <Text style={styles.defaultPromoTitle}>Grow Wealth with Real-World Yields</Text>
            <Text style={styles.defaultPromoSub}>
              Diversified projects in sustainable agriculture, renewable energy, and asset-backed securities.
            </Text>
          </View>
        )}

        {/* ================= 5. FEATURED INVESTMENT PLANS ================= */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Curated Opportunities</Text>
            <Text style={styles.sectionSub}>Audited & ready for capital allocation</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(app)/(tabs)/investments')}
            style={styles.seeAllBtn}
          >
            <Text style={styles.seeAllText}>Explore</Text>
            <ChevronRight size={16} color="#10B981" />
          </TouchableOpacity>
        </View>

        {plansLoading ? (
          <View style={styles.sectionLoading}>
            <ActivityIndicator color="#10B981" size="small" />
          </View>
        ) : plans && plans.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.plansTrack}
          >
            {plans.map((p) => {
              const progressPct = Math.min(
                100,
                Math.round((Number(p.total_funded || 0) / Number(p.funding_goal || 1)) * 100)
              );

              return (
                <View key={p.id} style={styles.planCard}>
                  {/* Category Pill */}
                  <View style={styles.planCategoryRow}>
                    <View style={styles.categoryPill}>
                      <Text style={styles.categoryPillText}>{p.category.toUpperCase()}</Text>
                    </View>
                    <View style={styles.roiPill}>
                      <Text style={styles.roiPillText}>+{p.expected_return_rate}% ROI</Text>
                    </View>
                  </View>

                  <Text style={styles.planTitle} numberOfLines={2}>
                    {p.title}
                  </Text>

                  {/* Plan Details */}
                  <View style={styles.planMetricsGrid}>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Duration</Text>
                      <Text style={styles.metricVal}>{p.duration_days} Days</Text>
                    </View>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Payout</Text>
                      <Text style={styles.metricVal}>{p.return_period}</Text>
                    </View>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Min Entry</Text>
                      <Text style={styles.metricVal}>${p.min_investment}</Text>
                    </View>
                  </View>

                  {/* Funding Progress Bar */}
                  <View style={styles.progressContainer}>
                    <View style={styles.progressLabelRow}>
                      <Text style={styles.progressLabel}>Funded</Text>
                      <Text style={styles.progressPercent}>{progressPct}%</Text>
                    </View>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
                    </View>
                  </View>

                  {/* Action */}
                  <TouchableOpacity
                    style={styles.planInvestBtn}
                    onPress={() => router.push('/(app)/(tabs)/investments')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.planInvestBtnText}>Invest Now</Text>
                    <ArrowRight size={14} color="#10B981" />
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.emptyPlansCard}>
            <Layers size={36} color="#64748B" />
            <Text style={styles.emptyCardTitle}>No Open Plans Currently</Text>
            <Text style={styles.emptyCardSub}>
              New agricultural and fixed yield opportunities are verified regularly by the administration.
            </Text>
          </View>
        )}

        {/* ================= 6. USER ACTIVE INVESTMENTS SUMMARY ================= */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Your Active Portfolio</Text>
            <Text style={styles.sectionSub}>Contracts currently earning returns</Text>
          </View>
        </View>

        {investmentsLoading ? (
          <View style={styles.sectionLoading}>
            <ActivityIndicator color="#10B981" size="small" />
          </View>
        ) : userInvestments && userInvestments.length > 0 ? (
          <View style={styles.investmentsList}>
            {userInvestments.slice(0, 3).map((inv) => (
              <View key={inv.id} style={styles.invCard}>
                <View style={styles.invLeft}>
                  <View style={styles.invIcon}>
                    <TrendingUp size={20} color="#10B981" />
                  </View>
                  <View style={styles.invTextCol}>
                    <Text style={styles.invTitle} numberOfLines={1}>
                      {inv.investment_plans?.title || 'Active Investment'}
                    </Text>
                    <Text style={styles.invMaturity}>
                      Matures: {new Date(inv.maturity_date).toLocaleDateString()}
                    </Text>
                  </View>
                </View>

                <View style={styles.invRight}>
                  <Text style={styles.invPrincipal}>${Number(inv.invested_amount).toFixed(2)}</Text>
                  <Text style={styles.invReturn}>
                    Return: ${Number(inv.expected_return_amount).toFixed(2)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyPortfolioCard}>
            <CircleDollarSign size={36} color="#10B981" />
            <Text style={styles.emptyCardTitle}>Start Building Your Assets</Text>
            <Text style={styles.emptyCardSub}>
              You have no active investments yet. Put your idle funds to work in high-yield verified projects.
            </Text>
            <TouchableOpacity
              style={styles.emptyCtaBtn}
              onPress={() => router.push('/(app)/(tabs)/investments')}
            >
              <Text style={styles.emptyCtaBtnText}>Browse Opportunities</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ================= 7. RECENT TRANSACTIONS FEED ================= */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Recent Ledger Activity</Text>
            <Text style={styles.sectionSub}>Live updates from your Supabase wallet</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(app)/(tabs)/wallet')}>
            <Text style={styles.seeAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {txLoading ? (
          <View style={styles.sectionLoading}>
            <ActivityIndicator color="#10B981" size="small" />
          </View>
        ) : recentTransactions && recentTransactions.length > 0 ? (
          <View style={styles.txList}>
            {recentTransactions.map((tx) => {
              const isPositive = ['deposit', 'profit_payout', 'principal_return', 'referral_bonus'].includes(tx.type);

              return (
                <View key={tx.id} style={styles.txRow}>
                  <View style={styles.txIconWrapper}>
                    {tx.type === 'deposit' ? (
                      <ArrowDownLeft size={18} color="#10B981" />
                    ) : tx.type === 'withdrawal' ? (
                      <ArrowUpRight size={18} color="#EF4444" />
                    ) : (
                      <TrendingUp size={18} color="#3B82F6" />
                    )}
                  </View>

                  <View style={styles.txInfo}>
                    <Text style={styles.txTypeTitle}>
                      {tx.type.replace('_', ' ').toUpperCase()}
                    </Text>
                    <Text style={styles.txDate}>
                      {new Date(tx.created_at).toLocaleDateString()} • Ref: {tx.reference_id.substring(0, 10)}
                    </Text>
                  </View>

                  <View style={styles.txAmountCol}>
                    <Text style={[styles.txAmount, isPositive ? styles.emeraldText : styles.txAmountNeutral]}>
                      {isPositive ? '+' : '-'}${Number(tx.amount).toFixed(2)}
                    </Text>
                    <View style={[styles.statusBadge, tx.status === 'approved' || tx.status === 'completed' ? styles.statusBadgeApproved : styles.statusBadgePending]}>
                      <Text style={styles.statusBadgeText}>{tx.status}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyTxCard}>
            <Text style={styles.emptyTxText}>No transactions recorded yet.</Text>
          </View>
        )}
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
    paddingTop: 12,
    paddingBottom: 48,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#131B2E',
    borderWidth: 2,
    borderColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#10B981',
    fontSize: 18,
    fontWeight: '800',
  },
  greetingText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  userNameText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeCount: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeCountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },

  /* KYC Alert */
  kycCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
    gap: 12,
  },
  kycIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  kycTextCol: {
    flex: 1,
  },
  kycHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FBBF24',
  },
  kycSub: {
    fontSize: 11,
    color: '#CBD5E1',
    marginTop: 2,
    lineHeight: 16,
  },

  /* Hero Portfolio Card */
  heroCard: {
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 22,
    padding: 22,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  portfolioLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  portfolioLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1.2,
  },
  realtimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#064E3B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 5,
  },
  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
  },
  realtimeText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
  },
  loadingBalance: {
    marginVertical: 18,
    alignItems: 'flex-start',
  },
  balanceMainText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#F8FAFC',
    marginVertical: 14,
    letterSpacing: -0.5,
  },
  triStatContainer: {
    flexDirection: 'row',
    backgroundColor: '#0A0F1D',
    borderRadius: 14,
    padding: 12,
    marginBottom: 20,
  },
  triStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  triStatDivider: {
    width: 1,
    backgroundColor: '#1E293B',
  },
  triStatLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
  },
  triStatValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  emeraldText: {
    color: '#10B981',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryAction: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 12,
    height: 48,
    gap: 6,
  },
  primaryActionText: {
    color: '#0A0F1D',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    height: 48,
    gap: 6,
  },
  secondaryActionText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '700',
  },

  /* Banners */
  bannersTrack: {
    gap: 12,
    marginBottom: 26,
  },
  bannerSlide: {
    width: width - 48,
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
    justifyContent: 'center',
  },
  bannerContent: {
    gap: 8,
  },
  bannerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bannerTagText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    lineHeight: 22,
  },
  defaultPromoBanner: {
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
    marginBottom: 26,
    gap: 6,
  },
  defaultPromoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  defaultPromoBadgeText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  defaultPromoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 2,
  },
  defaultPromoSub: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
  },

  /* Section Header */
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  sectionSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionLoading: {
    padding: 24,
    alignItems: 'center',
  },

  /* Featured Plans */
  plansTrack: {
    gap: 14,
    paddingRight: 10,
    marginBottom: 26,
  },
  planCard: {
    width: 250,
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 18,
    padding: 16,
  },
  planCategoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryPill: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryPillText: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  roiPill: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roiPillText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '800',
  },
  planTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
    lineHeight: 20,
    marginBottom: 12,
    height: 40,
  },
  planMetricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0A0F1D',
    borderRadius: 10,
    padding: 8,
    marginBottom: 12,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  metricVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  progressContainer: {
    marginBottom: 14,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  progressPercent: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#0A0F1D',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  planInvestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 10,
    height: 38,
    gap: 6,
  },
  planInvestBtnText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyPlansCard: {
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },

  /* User Investments */
  investmentsList: {
    gap: 10,
    marginBottom: 26,
  },
  invCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
  },
  invLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  invIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#064E3B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  invTextCol: {
    flex: 1,
  },
  invTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  invMaturity: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  invRight: {
    alignItems: 'flex-end',
  },
  invPrincipal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  invReturn: {
    fontSize: 11,
    color: '#10B981',
    marginTop: 2,
    fontWeight: '600',
  },
  emptyPortfolioCard: {
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    marginBottom: 26,
  },
  emptyCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  emptyCardSub: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyCtaBtn: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#064E3B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#059669',
  },
  emptyCtaBtnText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
  },

  /* Transactions */
  txList: {
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  txIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#0A0F1D',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txInfo: {
    flex: 1,
  },
  txTypeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  txDate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  txAmountCol: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  txAmountNeutral: {
    color: '#F8FAFC',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 3,
  },
  statusBadgeApproved: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  statusBadgePending: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  emptyTxCard: {
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
  },
  emptyTxText: {
    fontSize: 13,
    color: '#64748B',
  },
});
