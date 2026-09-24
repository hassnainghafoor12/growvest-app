'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import {
  TrendingUp,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Loader2,
  X,
  Layers,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface InvestmentPlan {
  id: string;
  title: string;
  slug: string;
  category: string;
  description: string;
  image_url: string;
  min_investment: number;
  max_investment: number;
  expected_return_rate: number;
  return_period: string;
  duration_days: number;
  risk_level: string;
  funding_goal: number;
  total_funded: number;
  status: string;
  created_at: string;
}

export default function AdminPlansPage() {
  const { user: adminUser } = useAdminAuth();

  const [plans, setPlans] = useState<InvestmentPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal State (Create & Edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<InvestmentPlan | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form Fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('agriculture');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [minInvestment, setMinInvestment] = useState('50');
  const [maxInvestment, setMaxInvestment] = useState('5000');
  const [expectedReturnRate, setExpectedReturnRate] = useState('15.0');
  const [returnPeriod, setReturnPeriod] = useState('monthly');
  const [durationDays, setDurationDays] = useState('90');
  const [riskLevel, setRiskLevel] = useState('low');
  const [fundingGoal, setFundingGoal] = useState('50000');
  const [status, setStatus] = useState('open');

  const fetchPlans = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('investment_plans')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setPlans((data || []) as InvestmentPlan[]);
    } catch (err) {
      console.error('Failed to load plans:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();

    const channel = supabase
      .channel('admin-realtime-plans')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'investment_plans' }, () => {
        fetchPlans();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [statusFilter]);

  const openCreateModal = () => {
    setEditingPlan(null);
    setTitle('');
    setCategory('agriculture');
    setDescription('');
    setImageUrl('https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=800&q=80');
    setMinInvestment('50');
    setMaxInvestment('5000');
    setExpectedReturnRate('18.5');
    setReturnPeriod('monthly');
    setDurationDays('90');
    setRiskLevel('low');
    setFundingGoal('50000');
    setStatus('open');
    setModalOpen(true);
  };

  const openEditModal = (p: InvestmentPlan) => {
    setEditingPlan(p);
    setTitle(p.title);
    setCategory(p.category);
    setDescription(p.description);
    setImageUrl(p.image_url);
    setMinInvestment(p.min_investment.toString());
    setMaxInvestment(p.max_investment.toString());
    setExpectedReturnRate(p.expected_return_rate.toString());
    setReturnPeriod(p.return_period);
    setDurationDays(p.duration_days.toString());
    setRiskLevel(p.risk_level);
    setFundingGoal(p.funding_goal.toString());
    setStatus(p.status);
    setModalOpen(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      alert('Please fill out the plan title and description.');
      return;
    }

    setIsSaving(true);
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now().toString().slice(-4);

    try {
      if (editingPlan) {
        // Update existing plan
        const { error } = await supabase
          .from('investment_plans')
          .update({
            title: title.trim(),
            category: category as any,
            description: description.trim(),
            image_url: imageUrl.trim(),
            min_investment: parseFloat(minInvestment),
            max_investment: parseFloat(maxInvestment),
            expected_return_rate: parseFloat(expectedReturnRate),
            return_period: returnPeriod as any,
            duration_days: parseInt(durationDays),
            risk_level: riskLevel as any,
            funding_goal: parseFloat(fundingGoal),
            status: status as any,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingPlan.id);

        if (error) throw error;
      } else {
        // Create new plan
        const { error } = await supabase
          .from('investment_plans')
          .insert({
            title: title.trim(),
            slug,
            category: category as any,
            description: description.trim(),
            image_url: imageUrl.trim(),
            min_investment: parseFloat(minInvestment),
            max_investment: parseFloat(maxInvestment),
            expected_return_rate: parseFloat(expectedReturnRate),
            return_period: returnPeriod as any,
            duration_days: parseInt(durationDays),
            risk_level: riskLevel as any,
            funding_goal: parseFloat(fundingGoal),
            total_funded: 0.00,
            status: status as any,
            created_by: adminUser?.id,
          });

        if (error) throw error;
      }

      setModalOpen(false);
      fetchPlans();
    } catch (err: any) {
      alert(`Error saving plan: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePlan = async (p: InvestmentPlan) => {
    if (!confirm(`Are you sure you want to delete "${p.title}"?`)) return;

    try {
      const { error } = await supabase
        .from('investment_plans')
        .delete()
        .eq('id', p.id);

      if (error) throw error;
      fetchPlans();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const filteredPlans = plans.filter((p) => {
    const term = search.toLowerCase();
    return p.title.toLowerCase().includes(term) || p.category.toLowerCase().includes(term);
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#F8FAFC' }}>
            Investment Opportunities Catalog
          </h1>
          <p style={{ fontSize: '14px', color: '#94A3B8' }}>
            Create and manage asset-backed projects. Modifications propagate in real time to the Android client.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            backgroundColor: '#10B981',
            color: '#070B14',
            border: 'none',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer',
          }}
        >
          <Plus size={16} />
          Create New Plan
        </button>
      </div>

      {/* Control Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
      }}>
        {/* Search */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#0F172A',
          border: '1px solid #1E293B',
          borderRadius: '10px',
          padding: '0 14px',
          width: '320px',
          height: '42px',
        }}>
          <Search size={16} color="#64748B" style={{ marginRight: '10px' }} />
          <input
            type="text"
            placeholder="Search plans by title or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#F8FAFC',
              fontSize: '13px',
            }}
          />
        </div>

        {/* Status Filters */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['all', 'open', 'upcoming', 'funded', 'active', 'completed', 'draft'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                border: '1px solid',
                borderColor: statusFilter === tab ? '#10B981' : '#1E293B',
                backgroundColor: statusFilter === tab ? '#10B981' : '#0F172A',
                color: statusFilter === tab ? '#070B14' : '#94A3B8',
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.15s ease',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Plans Table */}
      <div style={{
        backgroundColor: '#0F172A',
        border: '1px solid #1E293B',
        borderRadius: '16px',
        overflow: 'hidden',
      }}>
        {isLoading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94A3B8' }}>
            <Loader2 size={32} color="#10B981" className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
            <div>Loading plans catalog...</div>
          </div>
        ) : filteredPlans.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748B' }}>
            <Layers size={40} color="#334155" style={{ margin: '0 auto 12px auto' }} />
            <div style={{ fontSize: '15px', color: '#94A3B8', fontWeight: '600' }}>No investment plans found</div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>Click "Create New Plan" to publish a real asset opportunity.</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1E293B', backgroundColor: '#0B1120' }}>
                <th style={thStyle}>Project Title</th>
                <th style={thStyle}>Category</th>
                <th style={thStyle}>Expected Return</th>
                <th style={thStyle}>Duration</th>
                <th style={thStyle}>Funding Progress</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlans.map((p) => {
                const progress = Math.min(100, Math.round((Number(p.total_funded || 0) / Number(p.funding_goal || 1)) * 100));

                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #1E293B' }}>
                    <td style={tdStyle}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#F8FAFC' }}>{p.title}</div>
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                          Ticket: ${p.min_investment} - ${p.max_investment}
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        backgroundColor: '#131B2E',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '700',
                        color: '#E2E8F0',
                        textTransform: 'uppercase',
                      }}>
                        {p.category.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#10B981' }}>
                        +{p.expected_return_rate}% ROI
                      </span>
                      <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'capitalize' }}>
                        {p.return_period}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: '13px', color: '#CBD5E1' }}>
                        {p.duration_days} Days
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ width: '140px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                          <span style={{ color: '#94A3B8' }}>${Number(p.total_funded).toLocaleString()}</span>
                          <span style={{ color: '#10B981', fontWeight: '700' }}>{progress}%</span>
                        </div>
                        <div style={{ height: '6px', backgroundColor: '#131B2E', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${progress}%`, height: '100%', backgroundColor: '#10B981' }} />
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '700',
                        backgroundColor: p.status === 'open' ? 'rgba(16, 185, 129, 0.1)' : '#131B2E',
                        color: p.status === 'open' ? '#10B981' : '#94A3B8',
                        textTransform: 'uppercase',
                      }}>
                        {p.status}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button
                          onClick={() => openEditModal(p)}
                          style={{
                            padding: '6px 10px',
                            backgroundColor: '#1E293B',
                            color: '#E2E8F0',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                          }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeletePlan(p)}
                          style={{
                            padding: '6px 10px',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            color: '#EF4444',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: '6px',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit Plan Modal */}
      {modalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px',
          overflowY: 'auto',
        }}>
          <div style={{
            backgroundColor: '#0F172A',
            border: '1px solid #1E293B',
            borderRadius: '16px',
            padding: '32px',
            width: '100%',
            maxWidth: '620px',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#F8FAFC' }}>
                {editingPlan ? 'Edit Investment Plan' : 'Create New Investment Plan'}
              </h3>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleSavePlan} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Title */}
              <div>
                <label style={labelStyle}>Plan Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sustainable Solar Plant Phase 2"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Category & Status Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
                    <option value="agriculture">Agriculture</option>
                    <option value="livestock">Livestock</option>
                    <option value="real_estate">Real Estate</option>
                    <option value="green_energy">Green Energy</option>
                    <option value="fixed_income">Fixed Income</option>
                    <option value="technology">Technology</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
                    <option value="open">Open (Accepting Funds)</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="funded">Funded</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={labelStyle}>Plan Description</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Details about project returns, asset backing, and insurance..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              {/* Financial Returns Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Expected ROI (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="18.5"
                    value={expectedReturnRate}
                    onChange={(e) => setExpectedReturnRate(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Payout Schedule</label>
                  <select value={returnPeriod} onChange={(e) => setReturnPeriod(e.target.value)} style={inputStyle}>
                    <option value="monthly">Monthly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="at_maturity">At Maturity</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Duration (Days)</label>
                  <input
                    type="number"
                    required
                    placeholder="90"
                    value={durationDays}
                    onChange={(e) => setDurationDays(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Limits and Goals Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Min Investment ($)</label>
                  <input
                    type="number"
                    required
                    placeholder="50"
                    value={minInvestment}
                    onChange={(e) => setMinInvestment(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Max Investment ($)</label>
                  <input
                    type="number"
                    required
                    placeholder="5000"
                    value={maxInvestment}
                    onChange={(e) => setMaxInvestment(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Funding Target ($)</label>
                  <input
                    type="number"
                    required
                    placeholder="50000"
                    value={fundingGoal}
                    onChange={(e) => setFundingGoal(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Image URL */}
              <div>
                <label style={labelStyle}>Project Image URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Submit Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    padding: '10px 18px',
                    backgroundColor: '#1E293B',
                    color: '#94A3B8',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  style={{
                    padding: '10px 22px',
                    backgroundColor: '#10B981',
                    color: '#070B14',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isSaving ? 'Saving to Database...' : editingPlan ? 'Update Plan' : 'Publish Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '14px 18px',
  fontSize: '11px',
  fontWeight: '800',
  color: '#64748B',
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
};

const tdStyle: React.CSSProperties = {
  padding: '16px 18px',
  verticalAlign: 'middle',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: '700',
  color: '#CBD5E1',
  marginBottom: '6px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#131B2E',
  border: '1px solid #1E293B',
  borderRadius: '8px',
  color: '#F8FAFC',
  fontSize: '13px',
  padding: '10px 12px',
  outline: 'none',
};
