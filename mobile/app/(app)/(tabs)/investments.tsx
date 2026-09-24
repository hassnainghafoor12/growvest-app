import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  TrendingUp,
  Layers,
  Search,
  Filter,
  Clock,
  ShieldCheck,
  ChevronRight,
  X,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Users,
  Percent,
} from 'lucide-react-native';
import { useFeaturedPlans } from '../../../src/hooks/useFeaturedPlans';
import { useUserInvestments } from '../../../src/hooks/useUserInvestments';
import { useWallet } from '../../../src/hooks/useWallet';
import { supabase } from '../../../src/lib/supabase';
import { InvestmentPlan } from '../../../src/types/database.types';

const CATEGORIES = [
  { id: 'all', label: 'All Assets' },
  { id: 'agriculture', label: 'Agriculture' },
  { id: 'livestock', label: 'Livestock' },
  { id: 'real_estate', label: 'Real Estate' },
  { id: 'fixed_income', label: 'Fixed Income' },
  { id: 'green_energy', label: 'Green Energy' },
  { id: 'technology', label: 'Technology' },
];

export default function InvestmentsScreen() {
  const [activeTab, setActiveTab] = useState<'explore' | 'my_investments'>('explore');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Modals
  const [selectedPlan, setSelectedPlan] = useState<InvestmentPlan | null>(null);
  const [investAmount, setInvestAmount] = useState<string>('');
  const [autoReinvest, setAutoReinvest] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [investSuccess, setInvestSuccess] = useState<boolean>(false);

  // Realtime Data Hooks
  const { data: plans = [], isLoading: isLoadingPlans, refetch: refetchPlans } = useFeaturedPlans(50);
  const { data: myInvestments = [], isLoading: isLoadingInvestments, refetch: refetchInvestments } = useUserInvestments();
  const { data: wallet, refetch: refetchWallet } = useWallet();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchPlans(), refetchInvestments(), refetchWallet()]);
    setRefreshing(false);
  };

  // Filter plans
  const filteredPlans = plans.filter((p) => {
    const matchesCat = selectedCategory === 'all' || p.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesQuery =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  // Calculate projected return
  const parsedAmount = parseFloat(investAmount) || 0;
  const projectedProfit = selectedPlan
    ? (parsedAmount * (Number(selectedPlan.expected_return_rate) / 100)).toFixed(2)
    : '0.00';
  const totalPayout = selectedPlan
    ? (parsedAmount + parseFloat(projectedProfit)).toFixed(2)
    : '0.00';

  const handleOpenInvest = (plan: InvestmentPlan) => {
    setSelectedPlan(plan);
    setInvestAmount(String(plan.min_investment));
    setAutoReinvest(false);
    setInvestSuccess(false);
  };

  const handleExecuteInvestment = async () => {
    if (!selectedPlan) return;
    const amount = parseFloat(investAmount);

    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid investment amount.');
      return;
    }

    if (amount < Number(selectedPlan.min_investment)) {
      Alert.alert('Minimum Limit', `The minimum investment for this plan is $${selectedPlan.min_investment}.`);
      return;
    }

    if (selectedPlan.max_investment && amount > Number(selectedPlan.max_investment)) {
      Alert.alert('Maximum Limit', `The maximum investment for this plan is $${selectedPlan.max_investment}.`);
      return;
    }

    const availableBal = Number(wallet?.available_balance || 0);
    if (amount > availableBal) {
      Alert.alert('Insufficient Balance', `Your available balance is $${availableBal.toFixed(2)}. Please deposit funds first.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('invest_in_plan', {
        p_plan_id: selectedPlan.id,
        p_amount: amount,
        p_auto_reinvest: autoReinvest,
      });

      if (error) throw error;

      setInvestSuccess(true);
      await Promise.all([refetchWallet(), refetchInvestments(), refetchPlans()]);
    } catch (err: any) {
      Alert.alert('Investment Error', err.message || 'Could not complete investment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Investment Hub</Text>
          <Text style={styles.subtitle}>Curated assets backed by real economics</Text>
        </View>
        <View style={styles.walletBadge}>
          <Wallet size={16} color="#10B981" />
          <Text style={styles.walletBadgeText}>
            ${Number(wallet?.available_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </Text>
        </View>
      </View>

      {/* Segmented Control */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'explore' && styles.tabButtonActive]}
          onPress={() => setActiveTab('explore')}
        >
          <TrendingUp size={16} color={activeTab === 'explore' ? '#10B981' : '#94A3B8'} />
          <Text style={[styles.tabButtonText, activeTab === 'explore' && styles.tabButtonTextActive]}>
            Explore Plans ({plans.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'my_investments' && styles.tabButtonActive]}
          onPress={() => setActiveTab('my_investments')}
        >
          <Layers size={16} color={activeTab === 'my_investments' ? '#10B981' : '#94A3B8'} />
          <Text style={[styles.tabButtonText, activeTab === 'my_investments' && styles.tabButtonTextActive]}>
            My Portfolio ({myInvestments.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />}
      >
        {activeTab === 'explore' ? (
          <>
            {/* Search Input */}
            <View style={styles.searchBox}>
              <Search size={18} color="#64748B" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search plans by name, sector..."
                placeholderTextColor="#64748B"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={16} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Category Filter Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesBar}>
              {CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.catPill, isActive && styles.catPillActive]}
                    onPress={() => setSelectedCategory(cat.id)}
                  >
                    <Text style={[styles.catPillText, isActive && styles.catPillTextActive]}>{cat.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Plans List */}
            {isLoadingPlans ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={styles.loadingText}>Fetching investment plans...</Text>
              </View>
            ) : filteredPlans.length === 0 ? (
              <View style={styles.emptyCard}>
                <Layers size={40} color="#64748B" />
                <Text style={styles.emptyTitle}>No Plans Found</Text>
                <Text style={styles.emptySub}>
                  No investment plans match your criteria right now. Check back soon!
                </Text>
              </View>
            ) : (
              filteredPlans.map((plan) => {
                const fundedPct = Math.min(
                  100,
                  Math.round((Number(plan.total_funded) / Number(plan.funding_goal || 1)) * 100)
                );

                return (
                  <View key={plan.id} style={styles.planCard}>
                    {/* Image / Header */}
                    <View style={styles.planImageWrap}>
                      <Image
                        source={{
                          uri:
                            plan.image_url ||
                            'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&auto=format&fit=crop&q=60',
                        }}
                        style={styles.planImage}
                      />
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>{plan.category.replace('_', ' ').toUpperCase()}</Text>
                      </View>
                      <View style={[styles.statusBadge, plan.status === 'funded' ? styles.statusFunded : styles.statusOpen]}>
                        <Text style={styles.statusBadgeText}>{plan.status.toUpperCase()}</Text>
                      </View>
                    </View>

                    {/* Card Content */}
                    <View style={styles.planBody}>
                      <View style={styles.planTitleRow}>
                        <Text style={styles.planTitle}>{plan.title}</Text>
                        <View style={styles.roiTag}>
                          <TrendingUp size={14} color="#10B981" />
                          <Text style={styles.roiTagText}>+{plan.expected_return_rate}%</Text>
                        </View>
                      </View>

                      <Text style={styles.planDescription} numberOfLines={2}>
                        {plan.description || 'Verified institutional project backed by real economic yield.'}
                      </Text>

                      {/* Funding Progress Bar */}
                      <View style={styles.progressContainer}>
                        <View style={styles.progressHeader}>
                          <Text style={styles.progressLabel}>Funding Progress</Text>
                          <Text style={styles.progressValue}>
                            ${Number(plan.total_funded).toLocaleString()} / ${Number(plan.funding_goal).toLocaleString()} ({fundedPct}%)
                          </Text>
                        </View>
                        <View style={styles.progressBar}>
                          <View style={[styles.progressFill, { width: `${fundedPct}%` }]} />
                        </View>
                      </View>

                      {/* Metric Triplet */}
                      <View style={styles.metricGrid}>
                        <View style={styles.metricCol}>
                          <Text style={styles.metricLabel}>Duration</Text>
                          <View style={styles.metricValRow}>
                            <Clock size={12} color="#94A3B8" />
                            <Text style={styles.metricVal}>{plan.duration_days} Days</Text>
                          </View>
                        </View>

                        <View style={styles.metricCol}>
                          <Text style={styles.metricLabel}>Min Entry</Text>
                          <Text style={styles.metricVal}>${Number(plan.min_investment).toLocaleString()}</Text>
                        </View>

                        <View style={styles.metricCol}>
                          <Text style={styles.metricLabel}>Risk Level</Text>
                          <Text style={[styles.metricVal, { color: plan.risk_level === 'low' ? '#10B981' : '#F59E0B' }]}>
                            {plan.risk_level?.toUpperCase() || 'MODERATE'}
                          </Text>
                        </View>
                      </View>

                      {/* Invest Action */}
                      <TouchableOpacity
                        style={[styles.investBtn, plan.status !== 'open' && styles.investBtnDisabled]}
                        disabled={plan.status !== 'open'}
                        onPress={() => handleOpenInvest(plan)}
                      >
                        <Text style={styles.investBtnText}>
                          {plan.status === 'open' ? 'Invest In This Plan' : 'Plan Funded'}
                        </Text>
                        <ChevronRight size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </>
        ) : (
          /* My Portfolio / Active Investments View */
          <>
            {isLoadingInvestments ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={styles.loadingText}>Loading your active contracts...</Text>
              </View>
            ) : myInvestments.length === 0 ? (
              <View style={styles.emptyCard}>
                <TrendingUp size={44} color="#64748B" />
                <Text style={styles.emptyTitle}>No Investments Yet</Text>
                <Text style={styles.emptySub}>
                  You haven't invested in any assets yet. Explore the available plans to start earning yields.
                </Text>
                <TouchableOpacity style={styles.exploreCta} onPress={() => setActiveTab('explore')}>
                  <Text style={styles.exploreCtaText}>Browse Available Plans</Text>
                </TouchableOpacity>
              </View>
            ) : (
              myInvestments.map((inv) => {
                const plan = inv.investment_plans as any;
                const daysRemaining = Math.max(
                  0,
                  Math.ceil(
                    (new Date(inv.maturity_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                  )
                );

                return (
                  <View key={inv.id} style={styles.portfolioCard}>
                    <View style={styles.portfolioHeader}>
                      <View>
                        <Text style={styles.portfolioTitle}>{plan?.title || 'Investment Plan'}</Text>
                        <Text style={styles.portfolioCategory}>
                          {plan?.category ? plan.category.replace('_', ' ').toUpperCase() : 'ASSET'}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.contractStatusBadge,
                          inv.status === 'active' ? styles.statusActive : styles.statusMatured,
                        ]}
                      >
                        <Text style={styles.contractStatusText}>{inv.status.toUpperCase()}</Text>
                      </View>
                    </View>

                    <View style={styles.portfolioDivider} />

                    <View style={styles.portfolioMetricsRow}>
                      <View>
                        <Text style={styles.portfolioLabel}>Invested Capital</Text>
                        <Text style={styles.portfolioPrincipal}>
                          ${Number(inv.invested_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </Text>
                      </View>

                      <View>
                        <Text style={styles.portfolioLabel}>Expected Payout</Text>
                        <Text style={styles.portfolioExpected}>
                          ${Number(inv.expected_return_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.portfolioFooter}>
                      <View style={styles.footerInfoRow}>
                        <Calendar size={14} color="#94A3B8" />
                        <Text style={styles.footerInfoText}>
                          Matures: {new Date(inv.maturity_date).toLocaleDateString()} ({daysRemaining} days left)
                        </Text>
                      </View>
                      {inv.auto_reinvest && (
                        <View style={styles.autoReinvestBadge}>
                          <Text style={styles.autoReinvestBadgeText}>Auto-Reinvest ON</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      {/* Invest Execution Modal */}
      <Modal visible={!!selectedPlan} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Confirm Investment</Text>
                <Text style={styles.modalSub}>{selectedPlan?.title}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedPlan(null)} style={styles.closeBtn}>
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {investSuccess ? (
              <View style={styles.successView}>
                <CheckCircle2 size={60} color="#10B981" />
                <Text style={styles.successTitle}>Investment Successful!</Text>
                <Text style={styles.successDesc}>
                  Your investment contract has been registered in real time. Capital has been deployed to the plan.
                </Text>
                <TouchableOpacity
                  style={styles.doneBtn}
                  onPress={() => {
                    setSelectedPlan(null);
                    setActiveTab('my_investments');
                  }}
                >
                  <Text style={styles.doneBtnText}>View My Portfolio</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Available Balance Box */}
                <View style={styles.availableBox}>
                  <Text style={styles.availableLabel}>Available Balance</Text>
                  <Text style={styles.availableAmount}>
                    ${Number(wallet?.available_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Text>
                </View>

                {/* Amount Input */}
                <Text style={styles.fieldLabel}>Investment Amount (USD)</Text>
                <View style={styles.amountInputRow}>
                  <Text style={styles.currencyPrefix}>$</Text>
                  <TextInput
                    style={styles.amountInput}
                    keyboardType="numeric"
                    value={investAmount}
                    onChangeText={setInvestAmount}
                    placeholder="0.00"
                    placeholderTextColor="#64748B"
                  />
                </View>

                {/* Quick Select Chips */}
                <View style={styles.chipRow}>
                  {[50, 100, 250, 500].map((inc) => (
                    <TouchableOpacity
                      key={inc}
                      style={styles.chip}
                      onPress={() => {
                        const cur = parseFloat(investAmount) || 0;
                        setInvestAmount(String(cur + inc));
                      }}
                    >
                      <Text style={styles.chipText}>+${inc}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[styles.chip, styles.chipMax]}
                    onPress={() => setInvestAmount(String(Math.floor(Number(wallet?.available_balance || 0))))}
                  >
                    <Text style={styles.chipMaxText}>MAX</Text>
                  </TouchableOpacity>
                </View>

                {/* Projected Return Calculation */}
                <View style={styles.calcCard}>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Expected ROI</Text>
                    <Text style={styles.calcRoi}>+{selectedPlan?.expected_return_rate}%</Text>
                  </View>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Duration</Text>
                    <Text style={styles.calcVal}>{selectedPlan?.duration_days} Days</Text>
                  </View>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Estimated Profit</Text>
                    <Text style={styles.calcProfit}>+${projectedProfit}</Text>
                  </View>
                  <View style={styles.calcDivider} />
                  <View style={styles.calcRow}>
                    <Text style={styles.calcTotalLabel}>Total Projected Payout</Text>
                    <Text style={styles.calcTotal}>${totalPayout}</Text>
                  </View>
                </View>

                {/* Auto Reinvest Option */}
                <TouchableOpacity
                  style={styles.toggleRow}
                  onPress={() => setAutoReinvest(!autoReinvest)}
                  activeOpacity={0.8}
                >
                  <View>
                    <Text style={styles.toggleTitle}>Auto-Reinvest on Maturity</Text>
                    <Text style={styles.toggleSub}>Automatically roll over profit & principal upon completion</Text>
                  </View>
                  <View style={[styles.switchTrack, autoReinvest && styles.switchTrackActive]}>
                    <View style={[styles.switchThumb, autoReinvest && styles.switchThumbActive]} />
                  </View>
                </TouchableOpacity>

                {/* Action Buttons */}
                <TouchableOpacity
                  style={[styles.confirmBtn, isSubmitting && styles.confirmBtnDisabled]}
                  disabled={isSubmitting}
                  onPress={handleExecuteInvestment}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.confirmBtnText}>Confirm & Deploy Capital</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0F1D',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  walletBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10B981',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#131B2E',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#1E293B',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tabButtonTextActive: {
    color: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    gap: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 14,
  },
  categoriesBar: {
    marginBottom: 16,
  },
  catPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    marginRight: 8,
  },
  catPillActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  catPillTextActive: {
    color: '#0A0F1D',
  },
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  emptyCard: {
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 16,
    padding: 36,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  exploreCta: {
    backgroundColor: '#10B981',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 16,
  },
  exploreCtaText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A0F1D',
  },
  planCard: {
    backgroundColor: '#131B2E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 16,
    overflow: 'hidden',
  },
  planImageWrap: {
    height: 140,
    width: '100%',
    position: 'relative',
  },
  planImage: {
    width: '100%',
    height: '100%',
  },
  categoryBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(10, 15, 29, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusOpen: {
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
  },
  statusFunded: {
    backgroundColor: 'rgba(59, 130, 246, 0.9)',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  planBody: {
    padding: 16,
  },
  planTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  planTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
    flex: 1,
    marginRight: 8,
  },
  roiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  roiTagText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#10B981',
  },
  planDescription: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 14,
  },
  progressContainer: {
    marginBottom: 14,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  progressValue: {
    fontSize: 11,
    color: '#E2E8F0',
    fontWeight: '700',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#1E293B',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
  },
  metricGrid: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    justifyContent: 'space-between',
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  metricValRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  investBtn: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  investBtnDisabled: {
    backgroundColor: '#334155',
  },
  investBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0A0F1D',
  },
  portfolioCard: {
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  portfolioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  portfolioTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  portfolioCategory: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 2,
  },
  contractStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusMatured: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  contractStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  portfolioDivider: {
    height: 1,
    backgroundColor: '#1E293B',
    marginVertical: 12,
  },
  portfolioMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  portfolioLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
  },
  portfolioPrincipal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  portfolioExpected: {
    fontSize: 16,
    fontWeight: '800',
    color: '#10B981',
  },
  portfolioFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  footerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerInfoText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  autoReinvestBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  autoReinvestBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  modalSub: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  availableBox: {
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  availableLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  availableAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#10B981',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 8,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 12,
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10B981',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    flex: 1,
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  chipMax: {
    borderColor: '#10B981',
  },
  chipMaxText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#10B981',
  },
  calcCard: {
    backgroundColor: '#131B2E',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 18,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calcLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  calcRoi: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10B981',
  },
  calcVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  calcProfit: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10B981',
  },
  calcDivider: {
    height: 1,
    backgroundColor: '#1E293B',
    marginVertical: 6,
  },
  calcTotalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  calcTotal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#10B981',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#131B2E',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 20,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  toggleSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    maxWidth: 240,
  },
  switchTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    padding: 2,
  },
  switchTrackActive: {
    backgroundColor: '#10B981',
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#94A3B8',
  },
  switchThumbActive: {
    backgroundColor: '#FFFFFF',
    transform: [{ translateX: 20 }],
  },
  confirmBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmBtnDisabled: {
    opacity: 0.6,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0A0F1D',
  },
  successView: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  successDesc: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  doneBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
  },
  doneBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0A0F1D',
  },
});
