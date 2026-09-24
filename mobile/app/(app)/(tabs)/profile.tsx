import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Share,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../src/context/AuthContext';
import { useKycVerification } from '../../../src/hooks/useKycVerification';
import { useWithdrawalAccounts } from '../../../src/hooks/useWithdrawalAccounts';
import { supabase } from '../../../src/lib/supabase';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
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
  Copy,
  Share2,
  Building,
  Plus,
  Trash2,
  CheckCircle2,
  KeyRound,
  X,
  Camera,
} from 'lucide-react-native';

export default function ProfileScreen() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { data: kycRecord, isLoading: kycLoading, submitKyc } = useKycVerification();
  const { data: accounts, isLoading: accountsLoading, addAccount, deleteAccount } = useWithdrawalAccounts();

  // Modals state
  const [kycModalVisible, setKycModalVisible] = useState(false);
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);

  // KYC form state
  const [docType, setDocType] = useState<'national_id' | 'passport' | 'drivers_license'>('national_id');
  const [docNumber, setDocNumber] = useState('');
  const [isSubmittingKyc, setIsSubmittingKyc] = useState(false);

  // Account form state
  const [accType, setAccType] = useState<'bank_account' | 'crypto_wallet'>('bank_account');
  const [accName, setAccName] = useState('');
  const [accNumber, setAccNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [routingCode, setRoutingCode] = useState('');
  const [isSubmittingAcc, setIsSubmittingAcc] = useState(false);

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // General loading & copy feedback
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Handle Copy Referral Code
  const handleCopyCode = async () => {
    if (profile?.referral_code) {
      await Clipboard.setStringAsync(profile.referral_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  // Handle Native Share
  const handleShareReferral = async () => {
    if (profile?.referral_code) {
      try {
        await Share.share({
          message: `Join Growvest and start investing in verified high-yield agricultural and real assets! Use my invite code: ${profile.referral_code}`,
        });
      } catch (err) {
        console.error('Share error:', err);
      }
    }
  };

  // Handle Avatar Change
  const handlePickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Camera roll access is needed to upload a profile avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) {
      Alert.alert('Avatar Selected', 'Your avatar will be synced with Supabase Storage.');
    }
  };

  // Handle KYC Submission
  const handleSubmitKycForm = async () => {
    if (!docNumber.trim()) {
      Alert.alert('Missing Field', 'Please provide your identification document number.');
      return;
    }

    setIsSubmittingKyc(true);
    try {
      await submitKyc({
        documentType: docType,
        documentNumber: docNumber,
      });
      setKycModalVisible(false);
      Alert.alert('Submitted Successfully', 'Your KYC identity verification is now under administrative review.');
    } catch (err: any) {
      Alert.alert('Submission Error', err.message || 'Unable to submit verification.');
    } finally {
      setIsSubmittingKyc(false);
    }
  };

  // Handle Add Withdrawal Account
  const handleAddAccountForm = async () => {
    if (!accName.trim() || !accNumber.trim()) {
      Alert.alert('Missing Information', 'Please enter account holder name and number.');
      return;
    }

    setIsSubmittingAcc(true);
    try {
      await addAccount({
        accountType: accType,
        accountName: accName,
        accountNumber: accNumber,
        bankName: accType === 'bank_account' ? bankName : undefined,
        routingOrSwift: accType === 'bank_account' ? routingCode : undefined,
      });
      setAccountModalVisible(false);
      setAccName('');
      setAccNumber('');
      setBankName('');
      setRoutingCode('');
      Alert.alert('Account Saved', 'Withdrawal payout destination linked successfully.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save account.');
    } finally {
      setIsSubmittingAcc(false);
    }
  };

  // Handle Delete Account
  const handleDeleteAccountPress = (id: string, name: string) => {
    Alert.alert(
      'Remove Account',
      `Are you sure you want to remove ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await deleteAccount(id);
          },
        },
      ]
    );
  };

  // Handle Password Change
  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Password Length', 'Password must be at least 6 characters.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordModalVisible(false);
      setNewPassword('');
      Alert.alert('Password Updated', 'Your security credentials have been updated.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to update password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Logout Flow
  const handleLogoutPress = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to end your session?',
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
          <View style={[styles.badge, styles.badgeVerified]}>
            <ShieldCheck size={12} color="#34D399" />
            <Text style={[styles.badgeText, { color: '#34D399' }]}>Verified Investor</Text>
          </View>
        );
      case 'pending':
        return (
          <View style={[styles.badge, styles.badgePending]}>
            <Clock size={12} color="#FBBF24" />
            <Text style={[styles.badgeText, { color: '#FBBF24' }]}>Under Review</Text>
          </View>
        );
      default:
        return (
          <View style={[styles.badge, styles.badgeUnverified]}>
            <AlertTriangle size={12} color="#F87171" />
            <Text style={[styles.badgeText, { color: '#F87171' }]}>Not Verified</Text>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ================= 1. USER PROFILE HEADER ================= */}
        <View style={styles.profileHeader}>
          <TouchableOpacity style={styles.avatarWrapper} onPress={handlePickAvatar} activeOpacity={0.8}>
            <View style={styles.avatar}>
              <User size={36} color="#10B981" />
            </View>
            <View style={styles.cameraIconBadge}>
              <Camera size={12} color="#0A0F1D" />
            </View>
          </TouchableOpacity>

          <Text style={styles.profileName}>{profile?.full_name || 'Investor'}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>

          <View style={styles.badgeRow}>
            {getKycBadge()}
            <View style={[styles.badge, styles.badgeRole]}>
              <Shield size={12} color="#94A3B8" />
              <Text style={[styles.badgeText, { color: '#94A3B8' }]}>
                {profile?.role === 'admin' ? 'Administrator' : 'Standard Member'}
              </Text>
            </View>
          </View>
        </View>

        {/* ================= 2. KYC VERIFICATION ACTION CARD ================= */}
        <View style={styles.section}>
          <Text style={styles.sectionHeaderTitle}>IDENTITY VERIFICATION (KYC)</Text>
          <TouchableOpacity
            style={styles.kycActionCard}
            onPress={() => setKycModalVisible(true)}
            activeOpacity={0.85}
          >
            <View style={styles.kycCardLeft}>
              <View style={[styles.kycStatusIconBg, profile?.kyc_status === 'verified' ? styles.bgVerified : profile?.kyc_status === 'pending' ? styles.bgPending : styles.bgUnverified]}>
                {profile?.kyc_status === 'verified' ? (
                  <ShieldCheck size={22} color="#10B981" />
                ) : profile?.kyc_status === 'pending' ? (
                  <Clock size={22} color="#F59E0B" />
                ) : (
                  <AlertTriangle size={22} color="#EF4444" />
                )}
              </View>
              <View style={styles.kycCardTextCol}>
                <Text style={styles.kycCardHeading}>
                  {profile?.kyc_status === 'verified'
                    ? 'Identity Fully Verified'
                    : profile?.kyc_status === 'pending'
                    ? 'Review In Progress'
                    : 'Complete Verification'}
                </Text>
                <Text style={styles.kycCardSub}>
                  {profile?.kyc_status === 'verified'
                    ? 'Full investment & withdrawal limits unlocked.'
                    : profile?.kyc_status === 'pending'
                    ? 'Realtime sync active. You will be notified on approval.'
                    : 'Submit government ID to comply with financial regulations.'}
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* ================= 3. REFERRAL HUB ================= */}
        <View style={styles.section}>
          <Text style={styles.sectionHeaderTitle}>INVITE FRIENDS & EARN</Text>
          <View style={styles.card}>
            <View style={styles.referralHeader}>
              <Gift size={20} color="#10B981" />
              <Text style={styles.referralTitle}>Your Exclusive Referral Code</Text>
            </View>
            <Text style={styles.referralDesc}>
              Share your invite code with fellow investors and earn rewards when they fund their first project.
            </Text>

            <View style={styles.codeRow}>
              <View style={styles.codeBox}>
                <Text style={styles.codeText}>{profile?.referral_code || 'GROWVEST'}</Text>
              </View>

              <TouchableOpacity style={styles.copyBtn} onPress={handleCopyCode} activeOpacity={0.7}>
                {copiedCode ? (
                  <>
                    <CheckCircle2 size={16} color="#10B981" />
                    <Text style={[styles.copyBtnText, { color: '#10B981' }]}>Copied</Text>
                  </>
                ) : (
                  <>
                    <Copy size={16} color="#E2E8F0" />
                    <Text style={styles.copyBtnText}>Copy</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.shareBtn} onPress={handleShareReferral} activeOpacity={0.7}>
                <Share2 size={16} color="#0A0F1D" />
                <Text style={styles.shareBtnText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ================= 4. WITHDRAWAL BANK ACCOUNTS ================= */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>PAYOUT DESTINATIONS</Text>
            <TouchableOpacity
              style={styles.addAccountBtn}
              onPress={() => setAccountModalVisible(true)}
              activeOpacity={0.7}
            >
              <Plus size={14} color="#10B981" />
              <Text style={styles.addAccountBtnText}>Add Account</Text>
            </TouchableOpacity>
          </View>

          {accountsLoading ? (
            <ActivityIndicator color="#10B981" size="small" style={{ marginVertical: 12 }} />
          ) : accounts && accounts.length > 0 ? (
            <View style={styles.accountsList}>
              {accounts.map((acc) => (
                <View key={acc.id} style={styles.accountItem}>
                  <View style={styles.accountItemLeft}>
                    <View style={styles.bankIconBg}>
                      <Building size={18} color="#10B981" />
                    </View>
                    <View>
                      <Text style={styles.accountName}>{acc.bank_name || acc.account_name}</Text>
                      <Text style={styles.accountNum}>
                        {acc.account_type === 'crypto_wallet' ? 'Crypto: ' : 'Acct: '}
                        ••••{acc.account_number_or_address.slice(-4)}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => handleDeleteAccountPress(acc.id, acc.account_name)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Trash2 size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyAccountsCard}>
              <Text style={styles.emptyAccountsText}>
                No withdrawal account linked yet. Add a bank account to receive returns.
              </Text>
            </View>
          )}
        </View>

        {/* ================= 5. SECURITY & CREDENTIALS ================= */}
        <View style={styles.section}>
          <Text style={styles.sectionHeaderTitle}>SECURITY & SETTINGS</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => setPasswordModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.settingsRowLeft}>
                <KeyRound size={18} color="#94A3B8" />
                <Text style={styles.settingsRowText}>Change Password</Text>
              </View>
              <ChevronRight size={18} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ================= 6. LOGOUT ================= */}
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
              <LogOut size={18} color="#EF4444" />
              <Text style={styles.logoutText}>Sign Out of Growvest</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.footerVersion}>Growvest Android Edition v1.0.0 (Build 2026)</Text>
      </ScrollView>

      {/* ================= KYC MODAL ================= */}
      <Modal visible={kycModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Identity Verification</Text>
              <TouchableOpacity onPress={() => setKycModalVisible(false)}>
                <X size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {profile?.kyc_status === 'verified' ? (
              <View style={styles.modalVerifiedState}>
                <ShieldCheck size={56} color="#10B981" />
                <Text style={styles.modalVerifiedTitle}>You Are Fully Verified</Text>
                <Text style={styles.modalVerifiedSub}>
                  Your identity documents have been approved by compliance. No further action needed.
                </Text>
              </View>
            ) : profile?.kyc_status === 'pending' ? (
              <View style={styles.modalVerifiedState}>
                <Clock size={56} color="#FBBF24" />
                <Text style={styles.modalVerifiedTitle}>Review In Progress</Text>
                <Text style={styles.modalVerifiedSub}>
                  Your submission ({kycRecord?.document_type.replace('_', ' ').toUpperCase()}) is currently being reviewed by our compliance officers.
                </Text>
              </View>
            ) : (
              <View style={styles.modalForm}>
                {kycRecord?.admin_notes && (
                  <View style={styles.rejectionNotice}>
                    <Text style={styles.rejectionTitle}>Previous Submission Feedback:</Text>
                    <Text style={styles.rejectionText}>{kycRecord.admin_notes}</Text>
                  </View>
                )}

                <Text style={styles.inputLabel}>Document Type</Text>
                <View style={styles.docTypeRow}>
                  {(['national_id', 'passport', 'drivers_license'] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.docTypeBtn, docType === type && styles.docTypeBtnActive]}
                      onPress={() => setDocType(type)}
                    >
                      <Text style={[styles.docTypeBtnText, docType === type && styles.docTypeBtnTextActive]}>
                        {type.replace('_', ' ').toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Document Identification Number</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. 123456789"
                  placeholderTextColor="#475569"
                  value={docNumber}
                  onChangeText={setDocNumber}
                />

                <TouchableOpacity
                  style={[styles.modalSubmitBtn, isSubmittingKyc && styles.btnDisabled]}
                  onPress={handleSubmitKycForm}
                  disabled={isSubmittingKyc}
                >
                  {isSubmittingKyc ? (
                    <ActivityIndicator color="#0A0F1D" size="small" />
                  ) : (
                    <Text style={styles.modalSubmitBtnText}>Submit for Review</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ================= ADD ACCOUNT MODAL ================= */}
      <Modal visible={accountModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Link Payout Account</Text>
              <TouchableOpacity onPress={() => setAccountModalVisible(false)}>
                <X size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalForm}>
              <Text style={styles.inputLabel}>Account Type</Text>
              <View style={styles.docTypeRow}>
                <TouchableOpacity
                  style={[styles.docTypeBtn, accType === 'bank_account' && styles.docTypeBtnActive]}
                  onPress={() => setAccType('bank_account')}
                >
                  <Text style={[styles.docTypeBtnText, accType === 'bank_account' && styles.docTypeBtnTextActive]}>
                    BANK ACCOUNT
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.docTypeBtn, accType === 'crypto_wallet' && styles.docTypeBtnActive]}
                  onPress={() => setAccType('crypto_wallet')}
                >
                  <Text style={[styles.docTypeBtnText, accType === 'crypto_wallet' && styles.docTypeBtnTextActive]}>
                    CRYPTO WALLET
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Account Holder Name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Full Legal Name"
                placeholderTextColor="#475569"
                value={accName}
                onChangeText={setAccName}
              />

              <Text style={styles.inputLabel}>
                {accType === 'bank_account' ? 'IBAN / Account Number' : 'Wallet Address (USDT / USDC)'}
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder={accType === 'bank_account' ? 'Account Number' : '0x...'}
                placeholderTextColor="#475569"
                value={accNumber}
                onChangeText={setAccNumber}
              />

              {accType === 'bank_account' && (
                <>
                  <Text style={styles.inputLabel}>Bank Name</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. JPMorgan Chase"
                    placeholderTextColor="#475569"
                    value={bankName}
                    onChangeText={setBankName}
                  />
                </>
              )}

              <TouchableOpacity
                style={[styles.modalSubmitBtn, isSubmittingAcc && styles.btnDisabled]}
                onPress={handleAddAccountForm}
                disabled={isSubmittingAcc}
              >
                {isSubmittingAcc ? (
                  <ActivityIndicator color="#0A0F1D" size="small" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Save Account</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================= PASSWORD MODAL ================= */}
      <Modal visible={passwordModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Security Password</Text>
              <TouchableOpacity onPress={() => setPasswordModalVisible(false)}>
                <X size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalForm}>
              <Text style={styles.inputLabel}>New Password (min 6 characters)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="••••••••••••"
                placeholderTextColor="#475569"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />

              <TouchableOpacity
                style={[styles.modalSubmitBtn, isChangingPassword && styles.btnDisabled]}
                onPress={handleChangePassword}
                disabled={isChangingPassword}
              >
                {isChangingPassword ? (
                  <ActivityIndicator color="#0A0F1D" size="small" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Update Password</Text>
                )}
              </TouchableOpacity>
            </View>
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 48,
  },

  /* Header */
  profileHeader: {
    alignItems: 'center',
    marginBottom: 26,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#131B2E',
    borderWidth: 2,
    borderColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0A0F1D',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
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
  badgeVerified: {
    backgroundColor: '#064E3B',
    borderColor: '#059669',
  },
  badgePending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#D97706',
  },
  badgeUnverified: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#DC2626',
  },
  badgeRole: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  /* Section */
  section: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 10,
  },

  /* KYC Action Card */
  kycActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
  },
  kycCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  kycStatusIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bgVerified: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  bgPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  bgUnverified: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  kycCardTextCol: {
    flex: 1,
  },
  kycCardHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  kycCardSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    lineHeight: 16,
  },

  /* Referral Card */
  card: {
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
  },
  referralHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  referralTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  referralDesc: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 16,
  },
  codeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  codeBox: {
    flex: 1,
    backgroundColor: '#0A0F1D',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 10,
    justifyContent: 'center',
    paddingHorizontal: 14,
    height: 44,
  },
  codeText: {
    color: '#10B981',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 44,
    gap: 6,
  },
  copyBtnText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 44,
    gap: 6,
  },
  shareBtnText: {
    color: '#0A0F1D',
    fontSize: 13,
    fontWeight: '800',
  },

  /* Accounts */
  addAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addAccountBtnText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  accountsList: {
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  accountItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bankIconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#0A0F1D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  accountNum: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  emptyAccountsCard: {
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
  },
  emptyAccountsText: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
  },

  /* Settings */
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsRowText: {
    fontSize: 14,
    color: '#E2E8F0',
    fontWeight: '600',
  },

  /* Logout */
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 14,
    height: 50,
    gap: 8,
    marginBottom: 20,
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '800',
  },
  footerVersion: {
    color: '#475569',
    fontSize: 11,
    textAlign: 'center',
  },

  /* Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  modalVerifiedState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  modalVerifiedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 8,
  },
  modalVerifiedSub: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  modalForm: {
    gap: 14,
  },
  rejectionNotice: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  rejectionTitle: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  rejectionText: {
    color: '#FCA5A5',
    fontSize: 12,
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
    textTransform: 'uppercase',
  },
  docTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  docTypeBtn: {
    flex: 1,
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  docTypeBtnActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  docTypeBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
  },
  docTypeBtnTextActive: {
    color: '#0A0F1D',
  },
  modalInput: {
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 14,
    color: '#F8FAFC',
    fontSize: 14,
  },
  modalSubmitBtn: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  modalSubmitBtnText: {
    color: '#0A0F1D',
    fontSize: 14,
    fontWeight: '800',
  },
});
