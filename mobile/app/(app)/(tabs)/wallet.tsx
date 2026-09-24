import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Wallet as WalletIcon,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  History,
  Lock,
  Copy,
  CheckCircle2,
  AlertCircle,
  X,
  CreditCard,
  Building,
  Upload,
  ChevronRight,
  Clock,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useWallet } from '../../../src/hooks/useWallet';
import { useRecentTransactions } from '../../../src/hooks/useRecentTransactions';
import { useWithdrawalAccounts } from '../../../src/hooks/useWithdrawalAccounts';
import { useAuth } from '../../../src/context/AuthContext';
import { supabase } from '../../../src/lib/supabase';
import { Transaction } from '../../../src/types/database.types';

export default function WalletScreen() {
  const { user } = useAuth();
  const { data: wallet, isLoading: isLoadingWallet, refetch: refetchWallet } = useWallet();
  const { data: transactions = [], isLoading: isLoadingTx, refetch: refetchTx } = useRecentTransactions(50);
  const { data: withdrawalAccounts = [], refetch: refetchAccounts } = useWithdrawalAccounts();

  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');

  // Deposit Modal State
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [depositMethod, setDepositMethod] = useState<'bank' | 'usdt'>('usdt');
  const [depositAmount, setDepositAmount] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [isSubmittingDeposit, setIsSubmittingDeposit] = useState(false);
  const [depositSuccess, setDepositSuccess] = useState(false);

  // Withdraw Modal State
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  // Transaction Detail Modal
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const [copiedText, setCopiedText] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchWallet(), refetchTx(), refetchAccounts()]);
    setRefreshing(false);
  };

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const pickReceiptImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setReceiptUri(result.assets[0].uri);
    }
  };

  // Handle Deposit Submission
  const handleDepositSubmit = async () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount < 10) {
      Alert.alert('Invalid Amount', 'Minimum deposit is $10.00 USD.');
      return;
    }

    if (!wallet?.id || !user?.id) {
      Alert.alert('Error', 'Wallet account not initialized.');
      return;
    }

    setIsSubmittingDeposit(true);
    try {
      let receiptUrl = '';

      // Upload receipt if provided
      if (receiptUri) {
        const response = await fetch(receiptUri);
        const blob = await response.blob();
        const fileExt = receiptUri.split('.').pop() || 'jpg';
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('payment-receipts')
          .upload(fileName, blob, { contentType: `image/${fileExt}` });

        if (!uploadErr && uploadData) {
          receiptUrl = uploadData.path;
        }
      }

      const refId = `DEP-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      // Insert transaction with pending status
      const { error: txErr } = await supabase.from('transactions').insert({
        user_id: user.id,
        wallet_id: wallet.id,
        type: 'deposit',
        amount: amount,
        fee: 0.0,
        net_amount: amount,
        currency: 'USD',
        status: 'pending',
        payment_method: depositMethod === 'usdt' ? 'usdt_trc20' : 'bank_wire',
        reference_id: refId,
        metadata: {
          receipt_path: receiptUrl,
          channel: depositMethod,
          submitted_at: new Date().toISOString(),
        },
      });

      if (txErr) throw txErr;

      setDepositSuccess(true);
      await Promise.all([refetchTx(), refetchWallet()]);
    } catch (err: any) {
      Alert.alert('Deposit Error', err.message || 'Failed to submit deposit.');
    } finally {
      setIsSubmittingDeposit(false);
    }
  };

  // Handle Withdrawal Submission
  const handleWithdrawSubmit = async () => {
    const amount = parseFloat(withdrawAmount);
    const available = Number(wallet?.available_balance || 0);

    if (isNaN(amount) || amount < 20) {
      Alert.alert('Invalid Amount', 'Minimum withdrawal is $20.00 USD.');
      return;
    }

    if (amount > available) {
      Alert.alert('Insufficient Balance', `You only have $${available.toFixed(2)} available for withdrawal.`);
      return;
    }

    if (!selectedAccountId && withdrawalAccounts.length > 0) {
      Alert.alert('Select Account', 'Please choose a withdrawal payout account.');
      return;
    }

    if (!wallet?.id || !user?.id) {
      Alert.alert('Error', 'Wallet account not initialized.');
      return;
    }

    setIsSubmittingWithdraw(true);
    try {
      // 1. Lock the balance in wallet
      const { error: lockErr } = await supabase
        .from('wallets')
        .update({
          available_balance: available - amount,
          locked_balance: Number(wallet.locked_balance || 0) + amount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', wallet.id);

      if (lockErr) throw lockErr;

      const refId = `WTH-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      // 2. Create withdrawal transaction
      const { error: txErr } = await supabase.from('transactions').insert({
        user_id: user.id,
        wallet_id: wallet.id,
        type: 'withdrawal',
        amount: amount,
        fee: 0.0,
        net_amount: amount,
        currency: 'USD',
        status: 'pending',
        payment_method: 'bank_transfer',
        reference_id: refId,
        metadata: {
          withdrawal_account_id: selectedAccountId || null,
          requested_at: new Date().toISOString(),
        },
      });

      if (txErr) throw txErr;

      setWithdrawSuccess(true);
      await Promise.all([refetchWallet(), refetchTx()]);
    } catch (err: any) {
      Alert.alert('Withdrawal Error', err.message || 'Failed to request withdrawal.');
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  // Filtered transactions
  const filteredTransactions = transactions.filter((t) => {
    if (filterType === 'all') return true;
    return t.type === filterType;
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Growvest Wallet</Text>
        <Text style={styles.subtitle}>Institutional treasury with realtime settlement</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />}
      >
        {/* Main Wallet Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>Total Net Worth</Text>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Realtime</Text>
            </View>
          </View>

          <Text style={styles.balanceValue}>
            $
            {(
              Number(wallet?.available_balance || 0) +
              Number(wallet?.invested_balance || 0) +
              Number(wallet?.locked_balance || 0)
            ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>

          {/* Sub-balances breakdown */}
          <View style={styles.subBalanceGrid}>
            <View style={styles.subCol}>
              <Text style={styles.subLabel}>Available</Text>
              <Text style={styles.subValueEmerald}>
                ${Number(wallet?.available_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
            </View>

            <View style={styles.subCol}>
              <Text style={styles.subLabel}>Invested</Text>
              <Text style={styles.subValue}>
                ${Number(wallet?.invested_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
            </View>

            <View style={styles.subCol}>
              <Text style={styles.subLabel}>In-Flight</Text>
              <View style={styles.lockedRow}>
                <Lock size={10} color="#F59E0B" />
                <Text style={styles.subValueLocked}>
                  ${Number(wallet?.locked_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.depositBtn}
              onPress={() => {
                setDepositSuccess(false);
                setDepositAmount('');
                setReceiptUri(null);
                setDepositModalOpen(true);
              }}
            >
              <ArrowDownLeft size={18} color="#0A0F1D" />
              <Text style={styles.depositBtnText}>Deposit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.withdrawBtn}
              onPress={() => {
                setWithdrawSuccess(false);
                setWithdrawAmount('');
                setSelectedAccountId(withdrawalAccounts[0]?.id || '');
                setWithdrawModalOpen(true);
              }}
            >
              <ArrowUpRight size={18} color="#F8FAFC" />
              <Text style={styles.withdrawBtnText}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Ledger Header & Filter Pills */}
        <View style={styles.ledgerHeaderRow}>
          <View style={styles.ledgerTitleWrap}>
            <History size={18} color="#10B981" />
            <Text style={styles.ledgerTitle}>Transaction History</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
            {[
              { id: 'all', label: 'All' },
              { id: 'deposit', label: 'Deposits' },
              { id: 'withdrawal', label: 'Withdrawals' },
              { id: 'profit_payout', label: 'Profits' },
              { id: 'investment', label: 'Investments' },
            ].map((p) => {
              const active = filterType === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.filterPill, active && styles.filterPillActive]}
                  onPress={() => setFilterType(p.id)}
                >
                  <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Transactions Ledger */}
        {isLoadingTx ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.loadingText}>Syncing ledger with Supabase...</Text>
          </View>
        ) : filteredTransactions.length === 0 ? (
          <View style={styles.emptyCard}>
            <History size={36} color="#64748B" />
            <Text style={styles.emptyTitle}>No Transactions Yet</Text>
            <Text style={styles.emptySub}>
              Your deposits, payouts, and withdrawals will record here with real-time status.
            </Text>
          </View>
        ) : (
          filteredTransactions.map((tx) => {
            const isCredit = ['deposit', 'profit_payout', 'referral_bonus'].includes(tx.type);
            const statusColor =
              tx.status === 'completed' || tx.status === 'approved'
                ? '#10B981'
                : tx.status === 'pending'
                ? '#F59E0B'
                : '#EF4444';

            return (
              <TouchableOpacity
                key={tx.id}
                style={styles.txRow}
                onPress={() => setSelectedTx(tx)}
                activeOpacity={0.7}
              >
                <View style={styles.txLeft}>
                  <View
                    style={[
                      styles.txIconWrap,
                      { backgroundColor: isCredit ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)' },
                    ]}
                  >
                    {isCredit ? (
                      <ArrowDownLeft size={18} color="#10B981" />
                    ) : (
                      <ArrowUpRight size={18} color="#EF4444" />
                    )}
                  </View>
                  <View>
                    <Text style={styles.txTitle}>
                      {tx.type.replace('_', ' ').toUpperCase()}
                    </Text>
                    <Text style={styles.txSub}>
                      {new Date(tx.created_at).toLocaleDateString()} • {tx.payment_method.replace('_', ' ')}
                    </Text>
                  </View>
                </View>

                <View style={styles.txRight}>
                  <Text style={[styles.txAmount, { color: isCredit ? '#10B981' : '#F8FAFC' }]}>
                    {isCredit ? '+' : '-'}${Number(tx.amount).toFixed(2)}
                  </Text>
                  <View style={[styles.txBadge, { backgroundColor: `${statusColor}18` }]}>
                    <Text style={[styles.txBadgeText, { color: statusColor }]}>{tx.status.toUpperCase()}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* DEPOSIT MODAL */}
      <Modal visible={depositModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Deposit Funds</Text>
                <Text style={styles.modalSub}>Fund your investment balance</Text>
              </View>
              <TouchableOpacity onPress={() => setDepositModalOpen(false)}>
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {depositSuccess ? (
              <View style={styles.successBox}>
                <CheckCircle2 size={56} color="#10B981" />
                <Text style={styles.successTitle}>Deposit Submitted!</Text>
                <Text style={styles.successSub}>
                  Your deposit has been registered and is pending administrator confirmation. Once verified,
                  your available balance will credit automatically.
                </Text>
                <TouchableOpacity style={styles.modalActionBtn} onPress={() => setDepositModalOpen(false)}>
                  <Text style={styles.modalActionBtnText}>Close & Return</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Method Selector */}
                <View style={styles.methodSelector}>
                  <TouchableOpacity
                    style={[styles.methodOption, depositMethod === 'usdt' && styles.methodOptionActive]}
                    onPress={() => setDepositMethod('usdt')}
                  >
                    <CreditCard size={16} color={depositMethod === 'usdt' ? '#10B981' : '#94A3B8'} />
                    <Text style={[styles.methodText, depositMethod === 'usdt' && styles.methodTextActive]}>
                      USDT (TRC20)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.methodOption, depositMethod === 'bank' && styles.methodOptionActive]}
                    onPress={() => setDepositMethod('bank')}
                  >
                    <Building size={16} color={depositMethod === 'bank' ? '#10B981' : '#94A3B8'} />
                    <Text style={[styles.methodText, depositMethod === 'bank' && styles.methodTextActive]}>
                      Bank Wire
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Method Details */}
                {depositMethod === 'usdt' ? (
                  <View style={styles.instructionCard}>
                    <Text style={styles.instLabel}>Send USDT (TRC20 Network)</Text>
                    <View style={styles.addressBox}>
                      <Text style={styles.addressText} numberOfLines={1}>
                        TYDzsYUEWv86Lq64F7mUq3Zz1oN1hT89xP
                      </Text>
                      <TouchableOpacity onPress={() => copyToClipboard('TYDzsYUEWv86Lq64F7mUq3Zz1oN1hT89xP')}>
                        <Copy size={16} color="#10B981" />
                      </TouchableOpacity>
                    </View>
                    {copiedText && <Text style={styles.copiedNotice}>Address copied to clipboard!</Text>}
                  </View>
                ) : (
                  <View style={styles.instructionCard}>
                    <Text style={styles.instLabel}>Growvest Treasury Wire Details</Text>
                    <Text style={styles.bankDetail}>Bank: JPMorgan Chase NA</Text>
                    <Text style={styles.bankDetail}>Beneficiary: Growvest Global Operations LLC</Text>
                    <Text style={styles.bankDetail}>Account: 8849-0129-3891</Text>
                    <Text style={styles.bankDetail}>Routing: 021000021</Text>
                  </View>
                )}

                {/* Amount Field */}
                <Text style={styles.fieldLabel}>Deposit Amount (USD)</Text>
                <View style={styles.inputWrap}>
                  <Text style={styles.currencyPrefix}>$</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="100.00"
                    placeholderTextColor="#64748B"
                    value={depositAmount}
                    onChangeText={setDepositAmount}
                  />
                </View>

                {/* Receipt Upload */}
                <Text style={styles.fieldLabel}>Proof of Payment (Optional)</Text>
                <TouchableOpacity style={styles.uploadBtn} onPress={pickReceiptImage}>
                  <Upload size={18} color="#10B981" />
                  <Text style={styles.uploadBtnText}>
                    {receiptUri ? 'Receipt Attached (Tap to Change)' : 'Attach Transfer Receipt Screenshot'}
                  </Text>
                </TouchableOpacity>

                {receiptUri && (
                  <Image source={{ uri: receiptUri }} style={styles.receiptPreview} />
                )}

                <TouchableOpacity
                  style={[styles.modalActionBtn, isSubmittingDeposit && styles.btnDisabled]}
                  disabled={isSubmittingDeposit}
                  onPress={handleDepositSubmit}
                >
                  {isSubmittingDeposit ? (
                    <ActivityIndicator color="#0A0F1D" />
                  ) : (
                    <Text style={styles.modalActionBtnText}>Submit Deposit Request</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* WITHDRAW MODAL */}
      <Modal visible={withdrawModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Request Withdrawal</Text>
                <Text style={styles.modalSub}>Transfer funds to your verified account</Text>
              </View>
              <TouchableOpacity onPress={() => setWithdrawModalOpen(false)}>
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {withdrawSuccess ? (
              <View style={styles.successBox}>
                <CheckCircle2 size={56} color="#10B981" />
                <Text style={styles.successTitle}>Withdrawal Requested!</Text>
                <Text style={styles.successSub}>
                  Your withdrawal request has been placed. Funds have been held in your locked balance while
                  compliance reviews and processes the transfer.
                </Text>
                <TouchableOpacity style={styles.modalActionBtn} onPress={() => setWithdrawModalOpen(false)}>
                  <Text style={styles.modalActionBtnText}>Close & Return</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Available for withdraw banner */}
                <View style={styles.availNotice}>
                  <Text style={styles.availNoticeLabel}>Available for Withdrawal</Text>
                  <Text style={styles.availNoticeVal}>
                    ${Number(wallet?.available_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Text>
                </View>

                {/* Amount Field */}
                <Text style={styles.fieldLabel}>Withdrawal Amount (USD)</Text>
                <View style={styles.inputWrap}>
                  <Text style={styles.currencyPrefix}>$</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="50.00"
                    placeholderTextColor="#64748B"
                    value={withdrawAmount}
                    onChangeText={setWithdrawAmount}
                  />
                  <TouchableOpacity
                    style={styles.maxBtn}
                    onPress={() => setWithdrawAmount(String(Math.floor(Number(wallet?.available_balance || 0))))}
                  >
                    <Text style={styles.maxBtnText}>MAX</Text>
                  </TouchableOpacity>
                </View>

                {/* Select Account */}
                <Text style={styles.fieldLabel}>Payout Account</Text>
                {withdrawalAccounts.length === 0 ? (
                  <View style={styles.noAccountsCard}>
                    <AlertCircle size={20} color="#F59E0B" />
                    <Text style={styles.noAccountsText}>
                      No withdrawal accounts linked. Please add one in your Profile tab first.
                    </Text>
                  </View>
                ) : (
                  withdrawalAccounts.map((acc) => {
                    const selected = selectedAccountId === acc.id;
                    return (
                      <TouchableOpacity
                        key={acc.id}
                        style={[styles.accountItem, selected && styles.accountItemActive]}
                        onPress={() => setSelectedAccountId(acc.id)}
                      >
                        <Building size={16} color={selected ? '#10B981' : '#94A3B8'} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.accountItemName}>{acc.bank_name || 'USDT Wallet'}</Text>
                          <Text style={styles.accountItemNum}>
                            {acc.account_number_or_address
                              ? `•••• ${acc.account_number_or_address.slice(-6)}`
                              : acc.account_name}
                          </Text>
                        </View>
                        {selected && <CheckCircle2 size={16} color="#10B981" />}
                      </TouchableOpacity>
                    );
                  })
                )}

                <TouchableOpacity
                  style={[
                    styles.modalActionBtn,
                    (isSubmittingWithdraw || withdrawalAccounts.length === 0) && styles.btnDisabled,
                  ]}
                  disabled={isSubmittingWithdraw || withdrawalAccounts.length === 0}
                  onPress={handleWithdrawSubmit}
                >
                  {isSubmittingWithdraw ? (
                    <ActivityIndicator color="#0A0F1D" />
                  ) : (
                    <Text style={styles.modalActionBtnText}>Confirm Withdrawal</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* TRANSACTION DETAILS MODAL */}
      <Modal visible={!!selectedTx} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.detailCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Transaction Details</Text>
              <TouchableOpacity onPress={() => setSelectedTx(null)}>
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {selectedTx && (
              <View style={styles.detailBody}>
                <View style={styles.detailAmountWrap}>
                  <Text style={styles.detailAmount}>${Number(selectedTx.amount).toFixed(2)}</Text>
                  <Text style={styles.detailCurrency}>{selectedTx.currency}</Text>
                </View>

                <View style={styles.detailDivider} />

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Reference ID</Text>
                  <Text style={styles.detailVal}>{selectedTx.reference_id}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Transaction Type</Text>
                  <Text style={styles.detailVal}>{selectedTx.type.toUpperCase()}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <Text style={[styles.detailVal, { color: selectedTx.status === 'completed' || selectedTx.status === 'approved' ? '#10B981' : '#F59E0B' }]}>
                    {selectedTx.status.toUpperCase()}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Payment Method</Text>
                  <Text style={styles.detailVal}>{selectedTx.payment_method}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Timestamp</Text>
                  <Text style={styles.detailVal}>{new Date(selectedTx.created_at).toLocaleString()}</Text>
                </View>

                {selectedTx.admin_notes && (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesLabel}>Administrator Notes:</Text>
                    <Text style={styles.notesText}>{selectedTx.admin_notes}</Text>
                  </View>
                )}

                <TouchableOpacity style={styles.closeDetailBtn} onPress={() => setSelectedTx(null)}>
                  <Text style={styles.closeDetailBtnText}>Dismiss</Text>
                </TouchableOpacity>
              </View>
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  balanceCard: {
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 18,
    padding: 20,
    marginBottom: 24,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 16,
  },
  subBalanceGrid: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  subCol: {
    flex: 1,
    alignItems: 'center',
  },
  subLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
    fontWeight: '600',
  },
  subValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  subValueEmerald: {
    fontSize: 14,
    fontWeight: '800',
    color: '#10B981',
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  subValueLocked: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F59E0B',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  depositBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  depositBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0A0F1D',
  },
  withdrawBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  withdrawBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  ledgerHeaderRow: {
    marginBottom: 14,
  },
  ledgerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  ledgerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  pillScroll: {
    marginBottom: 4,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    marginRight: 8,
  },
  filterPillActive: {
    backgroundColor: '#1E293B',
    borderColor: '#10B981',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  filterPillTextActive: {
    color: '#10B981',
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  emptyCard: {
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  txRow: {
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  txIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  txSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  txBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  txBadgeText: {
    fontSize: 9,
    fontWeight: '800',
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
  methodSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  methodOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingVertical: 12,
    borderRadius: 10,
  },
  methodOptionActive: {
    borderColor: '#10B981',
    backgroundColor: '#1E293B',
  },
  methodText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  methodTextActive: {
    color: '#F8FAFC',
  },
  instructionCard: {
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  instLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  addressBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: 10,
    borderRadius: 8,
  },
  addressText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  copiedNotice: {
    fontSize: 11,
    color: '#10B981',
    marginTop: 6,
    fontWeight: '600',
  },
  bankDetail: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 3,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 16,
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10B981',
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  maxBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  maxBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#10B981',
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 16,
  },
  uploadBtnText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  receiptPreview: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    marginBottom: 16,
  },
  modalActionBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  modalActionBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0A0F1D',
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 12,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  successSub: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
  availNotice: {
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  availNoticeLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  availNoticeVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#10B981',
  },
  noAccountsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  noAccountsText: {
    fontSize: 12,
    color: '#F59E0B',
    flex: 1,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  accountItemActive: {
    borderColor: '#10B981',
  },
  accountItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  accountItemNum: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  detailCard: {
    backgroundColor: '#0F172A',
    margin: 20,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  detailBody: {
    paddingTop: 10,
  },
  detailAmountWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  detailAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  detailCurrency: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 2,
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#1E293B',
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  detailVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  notesBox: {
    backgroundColor: '#131B2E',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  notesLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  notesText: {
    fontSize: 12,
    color: '#F8FAFC',
    marginTop: 2,
  },
  closeDetailBtn: {
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 18,
  },
  closeDetailBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
});
