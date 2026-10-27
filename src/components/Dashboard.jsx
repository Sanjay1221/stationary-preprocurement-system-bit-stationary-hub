import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';

function Dashboard({ token, user, onLogout }) {
  // Determine default tab based on role
  const getInitialTab = (role) => {
    if (role === 'requester' || role === 'approver') return 'requisitions';
    if (role === 'procurement') return 'procurement';
    return 'inventory'; // fulfillment (Storekeeper)
  };

  // Navigation / Tab state
  const [activeTab, setActiveTab] = useState(getInitialTab(user.role));
  
  // Data states
  const [inventory, setInventory] = useState([]);
  const [requisitions, setRequisitions] = useState([]);
  const [procurementBatches, setProcurementBatches] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [emailAlerts, setEmailAlerts] = useState([]);
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [reqStatusFilter, setReqStatusFilter] = useState('All');
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [emailRoleFilter, setEmailRoleFilter] = useState('All');
  const [isSendingTestAlert, setIsSendingTestAlert] = useState(false);
  const [showIndentModal, setShowIndentModal] = useState(false);
  const [printSlipReq, setPrintSlipReq] = useState(null);

  // Email / SMTP Settings states
  const [showSmtpModal, setShowSmtpModal] = useState(false);
  const [smtpConfig, setSmtpConfig] = useState({
    configured: false,
    emailUser: '',
    emailPass: '',
    defaultFacultyEmail: 'sanjayc.cb23@bitsathy.ac.in',
    hasPassword: false,
    maskedPassword: ''
  });
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpFeedback, setSmtpFeedback] = useState(null);
  const [testSending, setTestSending] = useState(false);

  // Requisition Form states (Faculty)
  const [reqCart, setReqCart] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedQty, setSelectedQty] = useState(1);
  const [reqRemarks, setReqRemarks] = useState('');

  // HOD actions state
  const [hodRemarks, setHodRemarks] = useState({});

  // Inventory adjustment / creation state (Storekeeper / Procurement)
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    category: 'Writing Materials',
    current_stock: 10,
    min_threshold: 5,
    unit: 'Pieces'
  });
  const [editingItem, setEditingItem] = useState(null);
  const [editStockVal, setEditStockVal] = useState(0);
  const [editThresholdVal, setEditThresholdVal] = useState(0);

  const categories = ['All', 'Writing Materials', 'Paper Resources', 'Office Supplies', 'Adhesives & Tapes'];

  // Role permissions check
  const isFaculty = user.role === 'requester';
  const isHOD = user.role === 'approver';
  const isStorekeeper = user.role === 'fulfillment';
  const isProcurement = user.role === 'procurement';

  // Unified Status Badge Renderer:
  // Yellow (Pending HOD), Blue (Ready at Store), Green (Issued), Purple (Pre-Procurement), Red (Rejected)
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Pending HOD':
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 border border-amber-300 text-amber-800 uppercase tracking-wider font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            Pending HOD
          </span>
        );
      case 'Approved':
      case 'Ready at Store':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 border border-blue-300 text-blue-800 uppercase tracking-wider font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
            Ready at Store
          </span>
        );
      case 'Dispatched':
      case 'Issued':
      case 'Received':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 border border-emerald-300 text-emerald-800 uppercase tracking-wider font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            Issued
          </span>
        );
      case 'Pre-Procurement':
      case 'RFQ_Created':
      case 'Ordered':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 border border-purple-300 text-purple-800 uppercase tracking-wider font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500"></span>
            {status === 'Ordered' ? 'Pre-Procurement (PO Placed)' : 'Pre-Procurement (RFQ)'}
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 border border-rose-300 text-rose-800 uppercase tracking-wider font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 border border-slate-300 text-slate-700 font-mono">
            {status}
          </span>
        );
    }
  };

  // Visual Step-by-Step Indent Tracker:
  // Submitted (Faculty) ➔ Approved (HOD) ➔ Inventory Checked (Store) ➔ Ready for Pickup
  const renderIndentTimeline = (req) => {
    let step1 = { label: 'Submitted (Faculty)', status: 'completed', desc: 'Indent lodged' };
    let step2 = { label: 'Approved (HOD)', status: 'pending', desc: 'Awaiting review' };
    let step3 = { label: 'Inventory Checked (Store)', status: 'pending', desc: 'Stock verification' };
    let step4 = { label: 'Ready for Pickup', status: 'pending', desc: 'Store pickup' };

    if (req.status === 'Pending HOD' || req.status === 'Pending') {
      step1.status = 'completed';
      step2.status = 'active';
      step2.desc = 'Under HOD review';
    } else if (req.status === 'Approved' || req.status === 'Ready at Store') {
      step1.status = 'completed';
      step2.status = 'completed';
      step2.desc = 'HOD approved';
      step3.status = 'completed';
      step3.desc = 'Stock verified';
      step4.status = 'active';
      step4.desc = 'Ready at central store';
    } else if (req.status === 'Dispatched' || req.status === 'Issued') {
      step1.status = 'completed';
      step2.status = 'completed';
      step2.desc = 'HOD approved';
      step3.status = 'completed';
      step3.desc = 'Stock verified';
      step4.status = 'completed';
      step4.label = 'Issued / Collected';
      step4.desc = 'Handed to faculty';
    } else if (req.status === 'Rejected') {
      step1.status = 'completed';
      step2.status = 'rejected';
      step2.label = 'Rejected (HOD)';
      step2.desc = 'Declined by HOD';
      step3.status = 'skipped';
      step3.desc = 'Cancelled';
      step4.status = 'skipped';
      step4.desc = 'Cancelled';
    } else if (req.status === 'Pre-Procurement' || req.status === 'RFQ_Created' || req.status === 'Ordered') {
      step1.status = 'completed';
      step2.status = 'completed';
      step2.desc = 'HOD approved';
      step3.status = 'procure';
      step3.label = 'Pre-Procurement';
      step3.desc = 'Reorder in progress';
      step4.status = 'pending';
      step4.desc = 'Awaiting restock';
    }

    const steps = [step1, step2, step3, step4];

    return (
      <div className="py-2.5 px-3 bg-slate-50/90 rounded-xl border border-slate-200/90 my-2.5 shadow-2xs">
        <div className="flex items-center justify-between relative">
          {/* Track line behind steps */}
          <div className="absolute top-3.5 left-8 right-8 h-0.5 bg-slate-200 z-0 hidden sm:block"></div>

          {steps.map((st, idx) => {
            let circleClass = 'bg-slate-100 border-slate-300 text-slate-400';
            let labelClass = 'text-slate-400';
            let icon = <span className="text-[10px] font-mono font-bold">{idx + 1}</span>;

            if (st.status === 'completed') {
              circleClass = 'bg-emerald-600 border-emerald-700 text-white';
              labelClass = 'text-emerald-800 font-bold';
              icon = <Icons.Check className="w-3.5 h-3.5 stroke-[3]" />;
            } else if (st.status === 'active') {
              circleClass = 'bg-blue-600 border-blue-700 text-white ring-4 ring-blue-100 animate-pulse';
              labelClass = 'text-blue-800 font-bold';
              icon = <Icons.Clock className="w-3.5 h-3.5 stroke-[2.5]" />;
            } else if (st.status === 'rejected') {
              circleClass = 'bg-rose-600 border-rose-700 text-white ring-4 ring-rose-100';
              labelClass = 'text-rose-700 font-bold';
              icon = <Icons.X className="w-3.5 h-3.5 stroke-[3]" />;
            } else if (st.status === 'procure') {
              circleClass = 'bg-purple-600 border-purple-700 text-white ring-4 ring-purple-100 animate-pulse';
              labelClass = 'text-purple-800 font-bold';
              icon = <Icons.ShoppingCart className="w-3.5 h-3.5 stroke-[2.5]" />;
            }

            return (
              <div key={idx} className="relative z-10 flex flex-col items-center text-center flex-1 px-1">
                <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${circleClass}`}>
                  {icon}
                </div>
                <p className={`text-[11px] mt-1.5 leading-tight ${labelClass}`}>
                  {st.label}
                </p>
                <p className="text-[9px] text-slate-400 font-mono mt-0.5 hidden sm:block">
                  {st.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Fetch system data based strictly on role relevance
  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = { 'Authorization': `Bearer ${token}` };

      // Inventory & Requisitions are fetched for all roles (filtered server-side by department/user)
      const invRes = await fetch('/api/inventory', { headers });
      const invData = await invRes.json();
      if (!invRes.ok) throw new Error(invData.error || 'Failed to fetch inventory');
      setInventory(invData.items || []);

      const reqRes = await fetch('/api/requisitions', { headers });
      const reqData = await reqRes.json();
      if (!reqRes.ok) throw new Error(reqData.error || 'Failed to fetch requisitions');
      setRequisitions(reqData.requisitions || []);

      // Only Procurement and Storekeeper roles access Pre-Procurement Batches
      if (isProcurement || isStorekeeper) {
        const procRes = await fetch('/api/procurement/batches', { headers });
        const procData = await procRes.json();
        if (procRes.ok) setProcurementBatches(procData.batches || []);
      }

      // Only Storekeeper and Procurement access Audit Logs & Email Alert Dispatches
      if (isStorekeeper || isProcurement) {
        const logRes = await fetch('/api/telemetry/logs', { headers });
        const logData = await logRes.json();
        if (logRes.ok) setAuditLogs(logData.logs || []);

        const emailRes = await fetch('/api/notifications/emails', { headers });
        const emailData = await emailRes.json();
        if (emailRes.ok) setEmailAlerts(emailData.emails || []);
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSmtpConfig = async () => {
    try {
      const res = await fetch('/api/notifications/smtp-settings');
      if (res.ok) {
        const data = await res.json();
        setSmtpConfig(prev => ({
          ...prev,
          configured: data.configured,
          emailUser: data.emailUser || '',
          defaultFacultyEmail: data.defaultFacultyEmail || 'sanjayc.cb23@bitsathy.ac.in',
          hasPassword: data.hasPassword,
          maskedPassword: data.maskedPassword || ''
        }));
      }
    } catch (e) {
      console.error('Failed to fetch SMTP settings', e);
    }
  };

  const handleSaveSmtp = async (e) => {
    if (e) e.preventDefault();
    setSmtpSaving(true);
    setSmtpFeedback(null);
    try {
      const res = await fetch('/api/notifications/smtp-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailUser: smtpConfig.emailUser,
          emailPass: smtpConfig.emailPass,
          emailPort: 587,
          emailHost: 'smtp.gmail.com',
          defaultFacultyEmail: smtpConfig.defaultFacultyEmail
        })
      });

      let data = {};
      const cType = res.headers.get('content-type') || '';
      if (cType.includes('application/json')) {
        data = await res.json();
      } else {
        if (!res.ok) {
          throw new Error(`Server is initializing / redeploying (${res.status}). Please wait 15 seconds and try again.`);
        }
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }
      setSmtpFeedback({ type: 'success', message: data.message || 'Settings saved successfully!' });
      fetchSmtpConfig();
    } catch (err) {
      setSmtpFeedback({ type: 'error', message: err.message });
    } finally {
      setSmtpSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    setTestSending(true);
    setSmtpFeedback(null);
    try {
      const res = await fetch('/api/notifications/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: smtpConfig.defaultFacultyEmail,
          statusType: 'HOD Approved'
        })
      });

      let data = {};
      const cType = res.headers.get('content-type') || '';
      if (cType.includes('application/json')) {
        data = await res.json();
      } else {
        if (!res.ok) {
          throw new Error(`Server is initializing / redeploying (${res.status}). Please wait 15 seconds and try again.`);
        }
      }

      if (data.success) {
        setSmtpFeedback({ type: 'success', message: data.message });
      } else {
        setSmtpFeedback({ type: 'error', message: data.message || data.error || 'Email dispatch failed' });
      }
      fetchData();
    } catch (err) {
      setSmtpFeedback({ type: 'error', message: err.message });
    } finally {
      setTestSending(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchSmtpConfig();
  }, [activeTab]);

  const triggerSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Cart operations (Faculty)
  const handleAddItemToCart = (itemId, qty = 1) => {
    if (!itemId) return;
    const parsedId = parseInt(itemId, 10);
    const item = inventory.find(i => i.id === parsedId);
    if (!item) return;

    const quantityToAdd = Math.max(1, parseInt(qty, 10) || 1);

    setReqCart(prev => {
      const existingIndex = prev.findIndex(c => c.item_id === parsedId);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantityToAdd
        };
        return updated;
      } else {
        return [...prev, {
          item_id: item.id,
          name: item.name,
          category: item.category,
          unit: item.unit,
          quantity: quantityToAdd
        }];
      }
    });
  };

  const addToCart = () => {
    if (selectedItemId) {
      handleAddItemToCart(selectedItemId, selectedQty);
    } else if (inventory.length > 0) {
      handleAddItemToCart(inventory[0].id, selectedQty);
      setSelectedItemId(inventory[0].id);
    }
  };

  const updateCartQty = (itemId, newQty) => {
    const q = parseInt(newQty, 10);
    if (isNaN(q) || q <= 0) {
      removeFromCart(itemId);
    } else {
      setReqCart(prev => prev.map(c => c.item_id === itemId ? { ...c, quantity: q } : c));
    }
  };

  const removeFromCart = (itemId) => {
    setReqCart(prev => prev.filter(c => c.item_id !== itemId));
  };

  const submitRequisition = async (status = 'Pending HOD') => {
    if (reqCart.length === 0) {
      setError('Please add at least one item to your requisition.');
      return;
    }

    setError('');
    try {
      const res = await fetch('/api/requisitions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          items: reqCart,
          status,
          remarks: reqRemarks
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit requisition');

      triggerSuccess(`Requisition indent #${data.requisitionId} submitted successfully to HOD!`);
      setReqCart([]);
      setReqRemarks('');
      setShowIndentModal(false);
      setActiveTab('requisitions');
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  // HOD approval handler
  const handleRequisitionApproval = async (reqId, status) => {
    setError('');
    try {
      const res = await fetch(`/api/requisitions/${reqId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status,
          remarks: hodRemarks[reqId] || ''
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update requisition status');
      
      triggerSuccess(`Requisition #${reqId} has been successfully ${status.toLowerCase()}!`);
      setHodRemarks(prev => {
        const next = { ...prev };
        delete next[reqId];
        return next;
      });
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  // Storekeeper dispatch handler
  const handleDispatch = async (reqId) => {
    setError('');
    try {
      const res = await fetch(`/api/requisitions/${reqId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'Dispatched' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Dispatch execution failed');

      triggerSuccess(`Requisition #${reqId} items dispatched and inventory updated!`);
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  // Inventory item creation (Storekeeper / Procurement)
  const handleCreateItem = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newItem)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create item');

      triggerSuccess(`Inventory item "${newItem.name}" added successfully!`);
      setNewItem({
        name: '',
        category: 'Writing Materials',
        current_stock: 10,
        min_threshold: 5,
        unit: 'Pieces'
      });
      setShowAddForm(false);
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  // Stock adjustment (Storekeeper / Procurement)
  const handleUpdateItem = async (itemId) => {
    setError('');
    try {
      const res = await fetch(`/api/inventory/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          current_stock: parseInt(editStockVal, 10),
          min_threshold: parseInt(editThresholdVal, 10)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update stock');

      triggerSuccess(`Inventory stock updated successfully!`);
      setEditingItem(null);
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  // Pre-Procurement Scanner Trigger
  const triggerProcurementScan = async () => {
    setError('');
    try {
      const res = await fetch('/api/procurement/batches', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Procurement run failed');

      triggerSuccess(data.message);
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  // Pre-Procurement Status Update
  const updateProcurementStatus = async (batchId, status) => {
    setError('');
    try {
      const res = await fetch(`/api/procurement/batches/${batchId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update batch');

      triggerSuccess(`Procurement batch #${batchId} status changed to ${status}!`);
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  // Manual Test Alert Trigger (Storekeeper / Procurement)
  const triggerTestStockAlert = async (itemId = null) => {
    setIsSendingTestAlert(true);
    setError('');
    try {
      const res = await fetch('/api/notifications/test-stock-alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ itemId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch test alert');

      triggerSuccess(data.message || 'Official alert emails dispatched!');
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSendingTestAlert(false);
    }
  };

  // Filtered Inventory list
  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Filtered Requisitions list
  const filteredRequisitions = requisitions.filter(req => {
    if (reqStatusFilter === 'All') return true;
    if (reqStatusFilter === 'Pending HOD') return req.status === 'Pending HOD';
    if (reqStatusFilter === 'Ready at Store') return req.status === 'Approved';
    if (reqStatusFilter === 'Issued') return req.status === 'Dispatched';
    if (reqStatusFilter === 'Rejected') return req.status === 'Rejected';
    return true;
  });

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900">
      {/* Top Banner & Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-6 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-4">
          <img 
            src="/logo.png" 
            alt="Bannari Amman Institute of Technology" 
            className="h-14 object-contain" 
          />
          <div className="border-l border-slate-200 pl-4">
            <h1 className="text-lg font-bold text-[#0b193c] tracking-tight">BIT Campus Portal</h1>
            <p className="text-[11px] text-[#a6822c] font-bold tracking-wider uppercase font-mono mt-0.5">Stationary & Pre-Procurement Management</p>
          </div>
        </div>

        {/* User Badge & Logout */}
        <div className="flex items-center gap-3">
          {/* Email / SMTP Setup Button */}
          <button
            onClick={() => {
              setShowSmtpModal(true);
              setSmtpFeedback(null);
              fetchSmtpConfig();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              smtpConfig.configured 
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100 shadow-2xs'
                : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100 ring-2 ring-amber-300/60'
            }`}
            title="Configure Live Email Notification Delivery"
          >
            <Icons.Mail className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{smtpConfig.configured ? 'Email: Live Active' : 'Setup Real Email'}</span>
            <span className={`h-2 w-2 rounded-full ${smtpConfig.configured ? 'bg-emerald-500' : 'bg-amber-500 animate-ping'}`}></span>
          </button>

          <div className="text-right">
            <p className="text-sm font-bold text-slate-800">{user.username}</p>
            <div className="flex items-center justify-end gap-1.5 mt-0.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              <span className="text-[10px] font-bold text-[#0b193c] bg-[#0b193c]/5 border border-[#0b193c]/10 rounded-full px-2 py-0.5 uppercase tracking-wider font-mono">
                {user.role}
              </span>
              <span className="text-[10px] font-bold text-[#a6822c] bg-[#a6822c]/5 border border-[#a6822c]/10 rounded-full px-2 py-0.5 font-mono">
                {user.department}
              </span>
            </div>
          </div>
          
          <button
            onClick={onLogout}
            className="p-2 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-600 hover:text-rose-600 rounded-xl transition-all cursor-pointer"
            title="Sign Out"
          >
            <Icons.LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Navigation Sidebar — Strictly Tailored to Role */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col gap-1.5 shadow-xs">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-1 font-mono">Role Navigation</p>
            
            {/* 1. Requisitions / Indents Tab (Visible to all, custom labels) */}
            <button
              onClick={() => setActiveTab('requisitions')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'requisitions' 
                  ? 'bg-[#0b193c] text-white shadow-xs' 
                  : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icons.ClipboardList className="h-4 w-4" />
                <span>
                  {isFaculty ? 'My Indents' : isHOD ? 'Department Indents' : isStorekeeper ? 'Dispatches Queue' : 'Campus Indents'}
                </span>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full font-mono ${
                activeTab === 'requisitions' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {requisitions.length}
              </span>
            </button>

            {/* 2. Live Inventory / Resource Catalogue (Visible to all, read-only for Faculty/HOD) */}
            <button
              onClick={() => setActiveTab('inventory')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'inventory' 
                  ? 'bg-[#0b193c] text-white shadow-xs' 
                  : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icons.Layers className="h-4 w-4" />
                <span>
                  {isFaculty || isHOD ? 'Stationary Catalogue' : 'Live Stock Matrix'}
                </span>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full font-mono ${
                activeTab === 'inventory' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {inventory.length}
              </span>
            </button>

            {/* 3. Pre-Procurement Tab (Strictly for Storekeeper & Procurement) */}
            {(isStorekeeper || isProcurement) && (
              <button
                onClick={() => setActiveTab('procurement')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'procurement' 
                    ? 'bg-[#0b193c] text-white shadow-xs' 
                    : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icons.ShoppingCart className="h-4 w-4" />
                  <span>Pre-Procurement</span>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full font-mono ${
                  activeTab === 'procurement' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {procurementBatches.length}
                </span>
              </button>
            )}

            {/* 4. Stock Alert Mails Tab (Strictly for Storekeeper & Procurement - Hidden from Faculty & HOD) */}
            {(isStorekeeper || isProcurement) && (
              <button
                onClick={() => setActiveTab('alerts')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'alerts' 
                    ? 'bg-rose-700 text-white shadow-xs' 
                    : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icons.Mail className="h-4 w-4" />
                  <span>Stock Alert Mails</span>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full font-mono ${
                  activeTab === 'alerts' 
                    ? 'bg-white/20 text-white' 
                    : emailAlerts.length > 0 ? 'bg-rose-100 text-rose-700 font-bold' : 'bg-slate-100 text-slate-600'
                }`}>
                  {emailAlerts.length}
                </span>
              </button>
            )}

            {/* 5. Audit Timeline Tab (Strictly for Storekeeper & Procurement - Hidden from Faculty & HOD) */}
            {(isStorekeeper || isProcurement) && (
              <button
                onClick={() => setActiveTab('logs')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'logs' 
                    ? 'bg-[#0b193c] text-white shadow-xs' 
                    : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icons.Database className="h-4 w-4" />
                  <span>Audit Timeline</span>
                </div>
              </button>
            )}
          </div>

          {/* Quick Action Button for Faculty */}
          {isFaculty && (
            <button
              onClick={() => {
                setShowIndentModal(true);
                setActiveTab('requisitions');
              }}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
            >
              <Icons.Plus className="h-4 w-4" />
              <span>Raise New Indent</span>
            </button>
          )}

          {/* Role-Specific Summary Widget (No irrelevant store/alert metrics for Faculty or HOD) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-[#0b193c] uppercase tracking-wider font-mono">
              {isFaculty ? 'My Indent Summary' : isHOD ? 'CS Dept Summary' : isStorekeeper ? 'Warehouse Telemetry' : 'Procurement Telemetry'}
            </h3>
            
            <div className="space-y-2.5 text-xs">
              {isFaculty && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">My Total Indents</span>
                    <span className="font-bold text-slate-800 font-mono">{requisitions.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Pending HOD Review</span>
                    <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-mono">
                      {requisitions.filter(r => r.status === 'Pending HOD').length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Ready at Store</span>
                    <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-mono">
                      {requisitions.filter(r => r.status === 'Approved').length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Issued & Collected</span>
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-mono">
                      {requisitions.filter(r => r.status === 'Dispatched').length}
                    </span>
                  </div>
                </>
              )}

              {isHOD && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Awaiting My Review</span>
                    <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-mono">
                      {requisitions.filter(r => r.status === 'Pending HOD').length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Approved by HOD</span>
                    <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-mono">
                      {requisitions.filter(r => r.status === 'Approved' || r.status === 'Dispatched').length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Rejected Indents</span>
                    <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 font-mono">
                      {requisitions.filter(r => r.status === 'Rejected').length}
                    </span>
                  </div>
                </>
              )}

              {isStorekeeper && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Ready to Dispatch</span>
                    <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-mono">
                      {requisitions.filter(r => r.status === 'Approved').length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Low Stock Items</span>
                    <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-mono">
                      {inventory.filter(i => i.current_stock <= i.min_threshold && i.current_stock > 0).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Depleted (0 Units)</span>
                    <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 font-mono">
                      {inventory.filter(i => i.current_stock === 0).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Alert Mails Sent</span>
                    <span className="font-bold text-rose-700 font-mono">{emailAlerts.length}</span>
                  </div>
                </>
              )}

              {isProcurement && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Active RFQ Batches</span>
                    <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 font-mono">
                      {procurementBatches.filter(b => b.status === 'RFQ_Created').length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">POs Awaiting Receipt</span>
                    <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-mono">
                      {procurementBatches.filter(b => b.status === 'Ordered').length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Critical Stock Items</span>
                    <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 font-mono">
                      {inventory.filter(i => i.current_stock <= i.min_threshold).length}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Main Content Panel */}
        <div className="lg:col-span-3 space-y-6">

          {/* Feedback Banners */}
          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 shadow-xs">
              <Icons.CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{successMsg}</span>
            </div>
          )}
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 shadow-xs">
              <Icons.AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
              <span className="font-semibold">{error}</span>
            </div>
          )}

          {/* TAB 1: REQUISITIONS (INDENTS) */}
          {activeTab === 'requisitions' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-800">
                    {isFaculty ? 'My Requisitions & Indents' : isHOD ? 'Department Indent Approvals' : isStorekeeper ? 'Fulfillment & Dispatch Queue' : 'Campus Requisitions'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isFaculty ? 'Track your stationary requests across approval and store fulfillment stages.' :
                     isHOD ? 'Review and evaluate stationary resource requests from Computer Science faculty and students.' :
                     isStorekeeper ? 'Dispatch approved stationary items to departments with atomic transaction safety.' :
                     'Overview of academic indent requests.'}
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {isFaculty && (
                    <button
                      onClick={() => setShowIndentModal(true)}
                      className="px-3.5 py-2 bg-[#0b193c] hover:bg-[#122556] text-white font-semibold rounded-xl text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Icons.Plus className="h-3.5 w-3.5" />
                      <span>New Indent</span>
                    </button>
                  )}
                  <button
                    onClick={fetchData}
                    className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs transition-all flex items-center gap-1 cursor-pointer"
                    title="Refresh List"
                  >
                    <Icons.RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Status Filter Bar with Unified Color Indicators */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <button
                  onClick={() => setReqStatusFilter('All')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    reqStatusFilter === 'All' ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  All ({requisitions.length})
                </button>
                <button
                  onClick={() => setReqStatusFilter('Pending HOD')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    reqStatusFilter === 'Pending HOD' ? 'bg-amber-500 text-white' : 'bg-white border border-amber-200 text-amber-800 hover:bg-amber-50'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                  <span>Pending HOD ({requisitions.filter(r => r.status === 'Pending HOD').length})</span>
                </button>
                <button
                  onClick={() => setReqStatusFilter('Ready at Store')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    reqStatusFilter === 'Ready at Store' ? 'bg-blue-600 text-white' : 'bg-white border border-blue-200 text-blue-800 hover:bg-blue-50'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                  <span>Ready at Store ({requisitions.filter(r => r.status === 'Approved').length})</span>
                </button>
                <button
                  onClick={() => setReqStatusFilter('Issued')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    reqStatusFilter === 'Issued' ? 'bg-emerald-600 text-white' : 'bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-50'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  <span>Issued ({requisitions.filter(r => r.status === 'Dispatched').length})</span>
                </button>
                <button
                  onClick={() => setReqStatusFilter('Rejected')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    reqStatusFilter === 'Rejected' ? 'bg-rose-600 text-white' : 'bg-white border border-rose-200 text-rose-800 hover:bg-rose-50'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                  <span>Rejected ({requisitions.filter(r => r.status === 'Rejected').length})</span>
                </button>
              </div>

              {/* Requisition Cards */}
              {filteredRequisitions.length === 0 ? (
                <div className="p-10 border border-dashed border-slate-200 rounded-2xl text-center bg-white">
                  <Icons.ClipboardList className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 font-medium">No requisitions matching this filter.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredRequisitions.map(req => (
                    <div key={req.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3 hover:border-slate-300 transition-all">
                      
                      {/* Header with Unified Badge */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 font-mono">INDENT #{req.id}</span>
                          {renderStatusBadge(req.status)}
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(req.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2.5">
                          <div className="text-left sm:text-right">
                            <span className="text-xs font-semibold text-slate-700">Requester: <strong>{req.requester_name}</strong></span>
                            <span className="text-[10px] text-[#a6822c] font-bold font-mono ml-2">({req.requester_dept})</span>
                          </div>

                          {/* Print Institutional Slip Button */}
                          <button
                            onClick={() => setPrintSlipReq(req)}
                            className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 hover:border-[#0b193c] text-slate-700 hover:text-[#0b193c] rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer shrink-0"
                            title="Print Institutional Receipt"
                          >
                            <Icons.Printer className="h-3.5 w-3.5 text-[#a6822c]" />
                            <span>Print Slip</span>
                          </button>
                        </div>
                      </div>

                      {/* Visual Step-by-Step Indent Tracker */}
                      {renderIndentTimeline(req)}

                      {/* Items Line Details */}
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/60">
                        <div className="divide-y divide-slate-200 text-xs">
                          {req.items && req.items.map(it => (
                            <div key={it.id} className="flex justify-between py-1.5 items-center">
                              <span className="font-medium text-slate-700">{it.item_name}</span>
                              <span className="font-mono text-[#0b193c] font-bold bg-white px-2 py-0.5 border border-slate-200 rounded">
                                {it.quantity} {it.item_unit}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {req.remarks && (
                        <div className="text-xs text-slate-600 bg-slate-50/70 p-2.5 rounded-xl border border-slate-200 font-mono">
                          <strong className="text-slate-700">Remarks: </strong>
                          {req.remarks}
                        </div>
                      )}

                      {/* HOD Evaluation Controls */}
                      {isHOD && req.status === 'Pending HOD' && (
                        <div className="flex flex-col sm:flex-row gap-2.5 items-end pt-2 border-t border-slate-100">
                          <div className="flex-1 w-full">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">HOD Evaluation Remarks (Optional)</label>
                            <input
                              type="text"
                              placeholder="e.g. Approved for semester lab requirements"
                              value={hodRemarks[req.id] || ''}
                              onChange={(e) => setHodRemarks({ ...hodRemarks, [req.id]: e.target.value })}
                              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 focus:border-[#0b193c] focus:bg-white rounded-xl text-slate-800 outline-none text-xs"
                            />
                          </div>
                          <div className="flex gap-2 w-full sm:w-auto shrink-0">
                            <button
                              onClick={() => handleRequisitionApproval(req.id, 'Rejected')}
                              className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-semibold rounded-xl text-xs transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Icons.XCircle className="h-3.5 w-3.5" />
                              <span>Reject</span>
                            </button>
                            <button
                              onClick={() => handleRequisitionApproval(req.id, 'Approved')}
                              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                            >
                              <Icons.CheckCircle className="h-3.5 w-3.5" />
                              <span>Approve Indent</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Storekeeper Dispatch Control */}
                      {isStorekeeper && req.status === 'Approved' && (
                        <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                          <span className="text-[11px] text-blue-700 font-semibold font-mono">Approved by HOD &bull; Ready at Store for Dispatch</span>
                          <button
                            onClick={() => handleDispatch(req.id)}
                            className="px-4 py-2 bg-[#0b193c] hover:bg-[#122556] text-white font-semibold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Icons.Truck className="h-3.5 w-3.5" />
                            <span>Dispatch & Issue Stock</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LIVE INVENTORY / RESOURCE CATALOGUE */}
          {activeTab === 'inventory' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="flex flex-1 w-full gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Search resources by name, category..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 focus:border-[#0b193c] focus:ring-1 focus:ring-[#0b193c] rounded-xl text-slate-800 outline-none placeholder:text-slate-400 text-xs"
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Icons.Search className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="py-2 px-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs outline-none focus:border-[#0b193c]"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Add Item button only for Storekeeper and Procurement */}
                {(isStorekeeper || isProcurement) && (
                  <button
                    onClick={() => {
                      setShowAddForm(!showAddForm);
                      setEditingItem(null);
                    }}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-[#0b193c] hover:bg-[#122556] text-white font-semibold rounded-xl text-xs transition-all shadow-xs cursor-pointer"
                  >
                    <Icons.Plus className="h-3.5 w-3.5" />
                    <span>Add Item</span>
                  </button>
                )}
              </div>

              {/* Add Item Form (Storekeeper / Procurement only) */}
              {showAddForm && (isStorekeeper || isProcurement) && (
                <form onSubmit={handleCreateItem} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                  <h3 className="text-xs font-bold text-[#0b193c] uppercase tracking-wider font-mono flex items-center gap-2">
                    <Icons.Package className="h-4 w-4" />
                    <span>Add New Stationary Item</span>
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Item Name</label>
                      <input
                        type="text"
                        required
                        value={newItem.name}
                        onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                        placeholder="e.g. Marker Pen (Red)"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Category</label>
                      <select
                        value={newItem.category}
                        onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none text-xs"
                      >
                        <option value="Writing Materials">Writing Materials</option>
                        <option value="Paper Resources">Paper Resources</option>
                        <option value="Office Supplies">Office Supplies</option>
                        <option value="Adhesives & Tapes">Adhesives & Tapes</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Unit</label>
                      <input
                        type="text"
                        required
                        value={newItem.unit}
                        onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                        placeholder="e.g. Boxes, Packs"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Initial Stock</label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={newItem.current_stock}
                        onChange={(e) => setNewItem({ ...newItem, current_stock: parseInt(e.target.value, 10) })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Min Threshold</label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={newItem.min_threshold}
                        onChange={(e) => setNewItem({ ...newItem, min_threshold: parseInt(e.target.value, 10) })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none text-xs"
                      />
                    </div>
                    <div className="flex items-end justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddForm(false)}
                        className="px-3 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-[#0b193c] text-white rounded-xl font-semibold cursor-pointer"
                      >
                        Save Item
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Stock Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#0b193c] uppercase tracking-wider font-mono">
                    {isFaculty || isHOD ? 'Available Stationary Catalogue' : 'Live Stationary Stock Matrix'}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono font-bold">TOTAL: {filteredInventory.length}</span>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-semibold uppercase tracking-wider">
                        <th className="p-3.5">Resource Name</th>
                        <th className="p-3.5">Category</th>
                        <th className="p-3.5 text-center">Threshold</th>
                        <th className="p-3.5 text-center">Available Stock</th>
                        <th className="p-3.5 text-center">Status</th>
                        {(isStorekeeper || isProcurement) && (
                          <th className="p-3.5 text-right">Adjustment</th>
                        )}
                        {isFaculty && (
                          <th className="p-3.5 text-right">Request</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredInventory.map(item => {
                        const isDepleted = item.current_stock === 0;
                        const isLow = item.current_stock <= item.min_threshold && !isDepleted;
                        
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-3.5 font-semibold text-slate-800">
                              <div>{item.name}</div>
                              <div className="text-[10px] text-slate-400 font-normal font-mono">UID: BIT-STAT-{item.id}</div>
                            </td>
                            <td className="p-3.5 text-slate-600 font-mono">{item.category}</td>
                            <td className="p-3.5 text-center font-mono text-slate-500">
                              {item.min_threshold} <span className="text-[10px] text-slate-400">{item.unit}</span>
                            </td>
                            
                            <td className="p-3.5 text-center">
                              {editingItem === item.id ? (
                                <div className="flex items-center justify-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    value={editStockVal}
                                    onChange={(e) => setEditStockVal(e.target.value)}
                                    className="w-16 px-1.5 py-1 bg-slate-50 border border-slate-300 rounded font-mono text-center text-xs"
                                  />
                                </div>
                              ) : (
                                <span className={`font-bold font-mono ${isDepleted ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-emerald-600'}`}>
                                  {item.current_stock} <span className="text-[10px] text-slate-400 font-normal">{item.unit}</span>
                                </span>
                              )}
                            </td>

                            <td className="p-3.5 text-center">
                              {isDepleted ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 border border-rose-300 text-rose-800 font-mono">
                                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping"></span>
                                  Critical Stock: Flagged for Pre-Procurement
                                </span>
                              ) : isLow ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 border border-amber-300 text-amber-800 font-mono">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                  Critical Stock: Flagged for Pre-Procurement
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                  In-Stock
                                </span>
                              )}
                            </td>

                            {/* Storekeeper / Procurement Adjustment Controls */}
                            {(isStorekeeper || isProcurement) && (
                              <td className="p-3.5 text-right">
                                {editingItem === item.id ? (
                                  <div className="flex justify-end gap-1">
                                    <button
                                      onClick={() => setEditingItem(null)}
                                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[11px]"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={() => handleUpdateItem(item.id)}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold text-[11px]"
                                    >
                                      Save
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setEditingItem(item.id);
                                      setEditStockVal(item.current_stock);
                                      setEditThresholdVal(item.min_threshold);
                                    }}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
                                    title="Edit Stock Level"
                                  >
                                    <Icons.Settings className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </td>
                            )}

                            {/* Faculty Quick Request Action */}
                            {isFaculty && (
                              <td className="p-3.5 text-right">
                                <button
                                  onClick={() => {
                                    setSelectedItemId(item.id);
                                    setSelectedQty(1);
                                    handleAddItemToCart(item.id, 1);
                                    setShowIndentModal(true);
                                  }}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-[#0b193c] hover:text-white border border-slate-200 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
                                >
                                  Request
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PRE-PROCUREMENT (Storekeeper & Procurement only) */}
          {activeTab === 'procurement' && (isStorekeeper || isProcurement) && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-800">Pre-Procurement RFQ & Purchase Orders</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Automated demand aggregation for low-stock and approved indent replenishments.</p>
                </div>
                
                {isProcurement && (
                  <button
                    onClick={triggerProcurementScan}
                    className="px-4 py-2 bg-[#0b193c] hover:bg-[#122556] text-white font-semibold rounded-xl text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Icons.RefreshCw className="h-3.5 w-3.5" />
                    <span>Run Demand Scanner</span>
                  </button>
                )}
              </div>

              {/* Critical Stock Alert & Pre-Procurement Reorder Matrix */}
              <div className="bg-white border border-amber-200/80 rounded-2xl p-4 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-100 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-amber-50 rounded-xl border border-amber-200 text-amber-700">
                      <Icons.AlertTriangle className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-[#0b193c] uppercase tracking-wider font-mono flex items-center gap-2">
                        <span>Critical Stock Alert & Pre-Procurement Reorder Matrix</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          {inventory.filter(i => i.current_stock <= i.min_threshold).length} Items Need Purchasing
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Store items with stock at or below safety reorder threshold (&le; 10 units), automatically flagged for procurement purchase orders.
                      </p>
                    </div>
                  </div>

                  {isProcurement && (
                    <button
                      onClick={triggerProcurementScan}
                      className="px-3.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                    >
                      <Icons.ShoppingCart className="h-3.5 w-3.5" />
                      <span>Auto-Generate RFQ Batch</span>
                    </button>
                  )}
                </div>

                {inventory.filter(i => i.current_stock <= i.min_threshold).length === 0 ? (
                  <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                    <Icons.CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>All store items are currently above their safety replenishment threshold.</span>
                  </div>
                ) : (
                  <div className="border border-amber-200/80 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-amber-50/60 border-b border-amber-200/80 text-amber-900 font-semibold uppercase tracking-wider text-[10px]">
                          <th className="p-2.5">Item Name</th>
                          <th className="p-2.5">Category</th>
                          <th className="p-2.5 text-center">Safety Threshold</th>
                          <th className="p-2.5 text-center">Current Stock</th>
                          <th className="p-2.5 text-center">Deficit Need</th>
                          <th className="p-2.5 text-center">Flagged Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100 bg-white">
                        {inventory.filter(i => i.current_stock <= i.min_threshold).map(item => {
                          const deficit = Math.max(item.min_threshold * 2 - item.current_stock, item.min_threshold);
                          const isDepleted = item.current_stock === 0;
                          return (
                            <tr key={item.id} className="hover:bg-amber-50/30 transition-colors">
                              <td className="p-2.5 font-bold text-slate-800">
                                <div>{item.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono font-normal">UID: BIT-STAT-{item.id}</div>
                              </td>
                              <td className="p-2.5 text-slate-600 font-mono">{item.category}</td>
                              <td className="p-2.5 text-center font-mono text-slate-600">
                                {item.min_threshold} {item.unit}
                              </td>
                              <td className="p-2.5 text-center font-mono font-bold text-rose-600 bg-rose-50/50">
                                {item.current_stock} {item.unit}
                              </td>
                              <td className="p-2.5 text-center font-mono font-bold text-purple-700 bg-purple-50/30">
                                + {deficit} {item.unit}
                              </td>
                              <td className="p-2.5 text-center">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                                  isDepleted ? 'bg-rose-50 border border-rose-300 text-rose-800' : 'bg-amber-50 border border-amber-300 text-amber-800'
                                }`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${isDepleted ? 'bg-rose-500 animate-ping' : 'bg-amber-500 animate-pulse'}`}></span>
                                  Critical Stock: Flagged for Pre-Procurement
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {procurementBatches.length === 0 ? (
                <div className="p-10 border border-dashed border-slate-200 rounded-2xl text-center bg-white">
                  <Icons.ShoppingCart className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 font-medium">No open pre-procurement batches. Click "Run Demand Scanner" to check stock levels.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {procurementBatches.map(batch => (
                    <div key={batch.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                      
                      {/* Batch Header with Unified Badge */}
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 font-mono">BATCH #{batch.id}</span>
                          {renderStatusBadge(batch.status)}
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(batch.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          Manager: {batch.manager_name || 'Automated Engine'}
                        </div>
                      </div>

                      {/* Items Table */}
                      <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                              <th className="p-2.5">Item Name</th>
                              <th className="p-2.5 text-center">Live Stock</th>
                              <th className="p-2.5 text-center">Suggested PO Quantity</th>
                              <th className="p-2.5 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {batch.items && batch.items.map(it => (
                              <tr key={it.id}>
                                <td className="p-2.5 font-semibold text-slate-800">{it.item_name}</td>
                                <td className="p-2.5 text-center text-slate-500 font-mono">{it.item_stock} {it.item_unit}</td>
                                <td className="p-2.5 text-center font-bold text-purple-700 font-mono bg-purple-50/40">
                                  + {it.suggested_quantity} {it.item_unit}
                                </td>
                                <td className="p-2.5 text-right font-mono text-[10px]">
                                  {it.status === 'Received' ? (
                                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Received</span>
                                  ) : (
                                    <span className="text-slate-500 font-medium">{it.status}</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Procurement Action Flow */}
                      {isProcurement && (
                        <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
                          {batch.status === 'RFQ_Created' && (
                            <button
                              onClick={() => updateProcurementStatus(batch.id, 'Ordered')}
                              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Icons.CheckCircle className="h-3.5 w-3.5" />
                              <span>Issue Purchase Order (PO)</span>
                            </button>
                          )}

                          {batch.status === 'Ordered' && (
                            <button
                              onClick={() => updateProcurementStatus(batch.id, 'Received')}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Icons.Package className="h-3.5 w-3.5" />
                              <span>Receive Shipment & Restock</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: STOCK ALERT MAILS (Storekeeper & Procurement only) */}
          {activeTab === 'alerts' && (isStorekeeper || isProcurement) && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Icons.Mail className="h-4 w-4 text-rose-600" />
                    <h2 className="text-base font-bold text-slate-800">Higher Officials Stock-Out Email Alerts</h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Official automated priority notifications dispatched to <strong>HOD</strong>, <strong>Faculty</strong>, <strong>Storekeeper</strong>, and <strong>Procurement</strong>.
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => triggerTestStockAlert()}
                    disabled={isSendingTestAlert}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Icons.Send className="h-3.5 w-3.5" />
                    <span>{isSendingTestAlert ? 'Dispatching...' : 'Simulate Stock-Out Alert'}</span>
                  </button>
                  <button
                    onClick={fetchData}
                    className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs transition-all flex items-center gap-1 cursor-pointer"
                    title="Refresh"
                  >
                    <Icons.RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Role filter bar */}
              <div className="flex flex-wrap items-center gap-1.5">
                {['All', 'Head of Department (HOD Approver)', 'Procurement Manager', 'Central Storekeeper (Fulfillment)', 'Faculty / Academic Requester'].map(roleOption => {
                  const count = roleOption === 'All' 
                    ? emailAlerts.length 
                    : emailAlerts.filter(e => e.recipient_role === roleOption).length;
                  
                  return (
                    <button
                      key={roleOption}
                      onClick={() => setEmailRoleFilter(roleOption)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                        emailRoleFilter === roleOption
                          ? 'bg-[#0b193c] text-white'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span>{roleOption === 'All' ? 'All Roles' : roleOption.split('(')[0].trim()}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        emailRoleFilter === roleOption ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Email logs */}
              {emailAlerts.length === 0 ? (
                <div className="p-10 border border-dashed border-slate-200 rounded-2xl text-center bg-white">
                  <Icons.Inbox className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 font-medium">No stock depletion alert emails dispatched yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {emailAlerts
                    .filter(em => emailRoleFilter === 'All' || em.recipient_role === emailRoleFilter)
                    .map(em => (
                      <div key={em.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2.5 hover:border-slate-300 transition-all">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-800 font-mono">DISPATCH #{em.id}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-200 bg-rose-50 text-rose-700 uppercase font-mono">
                              Stock Depleted
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(em.sent_at).toLocaleString()}
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <div className="text-xs space-y-0.5">
                            <p className="font-bold text-slate-800">{em.subject}</p>
                            <p className="text-slate-500 font-mono text-[11px]">
                              To: <strong className="text-slate-700">{em.recipient_name}</strong> ({em.recipient_role})
                            </p>
                          </div>

                          <button
                            onClick={() => setSelectedEmail(em)}
                            className="px-3 py-1.5 bg-slate-50 hover:bg-[#0b193c] hover:text-white border border-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-all flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <Icons.Eye className="h-3.5 w-3.5" />
                            <span>View Letterhead</span>
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: AUDIT TIMELINE (Storekeeper & Procurement only) */}
          {activeTab === 'logs' && (isStorekeeper || isProcurement) && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-800">Immutable Audit Timeline</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Append-only audit trail recording stock adjustments and transactions.</p>
                </div>
                <button
                  onClick={fetchData}
                  className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs transition-all cursor-pointer"
                  title="Refresh"
                >
                  <Icons.RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                <div className="relative border-l-2 border-slate-200 ml-3 space-y-4 py-1">
                  {auditLogs.map(log => (
                    <div key={log.id} className="relative pl-6 text-xs">
                      <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border border-white bg-[#0b193c]"></span>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                        <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                          <span>{new Date(log.timestamp).toLocaleString()}</span>
                          <span>LOG #{log.id}</span>
                        </div>
                        <p className="font-semibold text-slate-800 text-xs">{log.action}</p>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 font-mono pt-1 border-t border-slate-200/60">
                          {log.username && <span>Actor: <strong>{log.username}</strong></span>}
                          {log.affected_department && <span>Dept: <strong>{log.affected_department}</strong></span>}
                          {log.quantity_changed !== 0 && (
                            <span className={`px-1.5 py-0.2 rounded font-bold text-[10px] ${
                              log.quantity_changed > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                            }`}>
                              Qty: {log.quantity_changed > 0 ? `+${log.quantity_changed}` : log.quantity_changed}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Faculty Modal: Raise New Indent */}
      {showIndentModal && isFaculty && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Icons.FileText className="h-5 w-5 text-[#0b193c]" />
                <h3 className="text-sm font-bold text-[#0b193c] uppercase tracking-wider font-mono">Raise Stationary Indent</h3>
              </div>
              <button
                onClick={() => setShowIndentModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <Icons.X className="h-4 w-4" />
              </button>
            </div>

            {/* Select Resource */}
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2 items-end">
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-600 mb-1">
                    Select Stationary Resource
                    <span className="text-[10px] text-emerald-600 font-normal ml-1.5">(Auto-added on select)</span>
                  </label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedItemId(val);
                      if (val) {
                        handleAddItemToCart(val, selectedQty);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none text-xs"
                  >
                    <option value="">-- Choose item from catalogue --</option>
                    {inventory.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.current_stock} {item.unit} available)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Add Qty</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      min="1"
                      value={selectedQty}
                      onChange={(e) => setSelectedQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-14 px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedItemId) {
                          handleAddItemToCart(selectedItemId, selectedQty);
                        } else if (inventory.length > 0) {
                          handleAddItemToCart(inventory[0].id, selectedQty);
                          setSelectedItemId(inventory[0].id);
                        }
                      }}
                      title="Add to Indent List"
                      className="flex-1 py-2 bg-[#0b193c] hover:bg-[#122556] text-white rounded-xl font-semibold text-xs cursor-pointer flex items-center justify-center transition-all shadow-2xs"
                    >
                      <Icons.Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Cart List */}
              {reqCart.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden mt-2">
                  <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200 flex justify-between items-center text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                    <span>Selected Items ({reqCart.length})</span>
                    <span className="text-[10px] text-emerald-600 font-mono font-bold">Ready to Submit</span>
                  </div>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                        <th className="p-2.5">Item</th>
                        <th className="p-2.5 text-center">Quantity</th>
                        <th className="p-2.5 text-right">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reqCart.map(c => (
                        <tr key={c.item_id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-2.5 font-semibold text-slate-800">
                            <div>{c.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono font-normal">{c.category}</div>
                          </td>
                          <td className="p-2.5 text-center">
                            <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
                              <button
                                type="button"
                                onClick={() => updateCartQty(c.item_id, c.quantity - 1)}
                                className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200 text-slate-600 font-bold text-xs cursor-pointer"
                              >
                                -
                              </button>
                              <span className="font-mono font-bold text-[#0b193c] px-1 text-xs min-w-[3rem]">
                                {c.quantity} {c.unit}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateCartQty(c.item_id, c.quantity + 1)}
                                className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200 text-slate-600 font-bold text-xs cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="p-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => removeFromCart(c.item_id)}
                              className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer transition-all"
                              title="Remove item"
                            >
                              <Icons.Trash className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-5 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <Icons.Package className="h-6 w-6 text-slate-300 mx-auto mb-1" />
                  <p className="font-medium text-xs">Indent items list is currently empty.</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Select any resource from the dropdown above to add it automatically.</p>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Purpose / Course Justification</label>
                <input
                  type="text"
                  placeholder="e.g. For semester end lab exams or course handouts"
                  value={reqRemarks}
                  onChange={(e) => setReqRemarks(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowIndentModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => submitRequisition('Pending HOD')}
                disabled={reqCart.length === 0}
                className="px-4 py-2 bg-[#0b193c] hover:bg-[#122556] disabled:opacity-50 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
              >
                Submit Indent to HOD
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Email Preview Modal (Storekeeper & Procurement) */}
      {selectedEmail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 bg-[#0b193c] text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#a6822c] uppercase tracking-wider font-mono block">Official Institutional Alert Notice</span>
                <h3 className="text-xs font-bold truncate max-w-lg mt-0.5">{selectedEmail.subject}</h3>
              </div>
              <button
                onClick={() => setSelectedEmail(null)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
              >
                <Icons.X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 text-xs text-slate-600 flex justify-between items-center font-mono">
              <span><strong>Recipient:</strong> {selectedEmail.recipient_name} ({selectedEmail.recipient_role})</span>
              <span><strong>Sent:</strong> {new Date(selectedEmail.sent_at).toLocaleString()}</span>
            </div>

            <div className="p-5 overflow-y-auto flex-1 bg-slate-100">
              <div 
                className="shadow-xs rounded-xl overflow-hidden bg-white"
                dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }} 
              />
            </div>

            <div className="px-5 py-2.5 bg-white border-t border-slate-200 flex justify-between items-center">
              {selectedEmail.preview_url ? (
                <a
                  href={selectedEmail.preview_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-semibold font-mono transition-all"
                >
                  <Icons.ExternalLink className="h-3.5 w-3.5" />
                  <span>Open Ethereal Live Preview</span>
                </a>
              ) : (
                <span className="text-[11px] text-slate-400 font-mono">Dispatched to {selectedEmail.recipient_email}</span>
              )}
              <button
                onClick={() => setSelectedEmail(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl text-xs cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Printable Requisition Voucher / Slip Modal */}
      {printSlipReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 shadow-2xl space-y-4 my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Top Action Bar (hidden in print) */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Icons.Printer className="h-5 w-5 text-[#0b193c]" />
                <h3 className="text-xs font-bold text-[#0b193c] uppercase tracking-wider font-mono">
                  Institutional Stationery Voucher Receipt
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-[#0b193c] hover:bg-[#122556] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                >
                  <Icons.Printer className="h-3.5 w-3.5 text-[#a6822c]" />
                  <span>Print Slip / Save PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintSlipReq(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <Icons.X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Printable Voucher Area */}
            <div id="printable-voucher" className="bg-white p-6 border-2 border-slate-800 rounded-xl space-y-4 text-slate-900">
              {/* BIT Institutional Letterhead Header */}
              <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4">
                <img 
                  src="/logo.png" 
                  alt="BIT Crest" 
                  className="h-16 object-contain"
                />
                <div className="text-right">
                  <h2 className="text-base font-extrabold text-[#0b193c] tracking-tight uppercase">
                    Bannari Amman Institute of Technology
                  </h2>
                  <p className="text-[10px] text-slate-600 font-medium">
                    Autonomous Institution Affiliated to Anna University &bull; Approved by AICTE
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Sathyamangalam - 638401, Erode District, Tamil Nadu
                  </p>
                  <div className="mt-1 inline-block bg-[#0b193c] text-white px-2.5 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wider">
                    Central Stationery Store Requisition Voucher
                  </div>
                </div>
              </div>

              {/* Voucher Meta Info Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono">
                <div>
                  <span className="text-slate-500">Voucher Ref:</span>{' '}
                  <strong className="text-slate-800">BIT/STAT/2026/IND-{String(printSlipReq.id).padStart(4, '0')}</strong>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">Date Issued:</span>{' '}
                  <strong className="text-slate-800">{new Date(printSlipReq.created_at).toLocaleDateString()}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Requester:</span>{' '}
                  <strong className="text-slate-800">{printSlipReq.requester_name}</strong>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">Department:</span>{' '}
                  <strong className="text-[#a6822c]">{printSlipReq.requester_dept}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Indent Status:</span>{' '}
                  <strong className="text-emerald-700 uppercase">{printSlipReq.status}</strong>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">Auth Token:</span>{' '}
                  <strong className="text-slate-600">BIT-VOUCH-{printSlipReq.id}-VERIFIED</strong>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border border-slate-300 rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold uppercase text-[10px]">
                      <th className="p-2 border-r border-slate-300 text-center w-10">S.No</th>
                      <th className="p-2 border-r border-slate-300">Stationary Item Description</th>
                      <th className="p-2 border-r border-slate-300 text-center">Category</th>
                      <th className="p-2 border-r border-slate-300 text-center">Quantity</th>
                      <th className="p-2 text-center">Fulfillment Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {printSlipReq.items && printSlipReq.items.map((it, idx) => (
                      <tr key={it.id || idx}>
                        <td className="p-2 text-center font-mono border-r border-slate-200">{idx + 1}</td>
                        <td className="p-2 font-semibold text-slate-800 border-r border-slate-200">{it.item_name}</td>
                        <td className="p-2 text-center text-slate-600 border-r border-slate-200 font-mono">{it.category || 'Stationery'}</td>
                        <td className="p-2 text-center font-mono font-bold text-[#0b193c] border-r border-slate-200">
                          {it.quantity} {it.item_unit}
                        </td>
                        <td className="p-2 text-center text-[10px] font-mono text-emerald-700 font-bold">
                          VERIFIED & ISSUED
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Academic Remarks / Justification */}
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono">
                <span className="text-slate-500">Course / Academic Justification: </span>
                <span className="text-slate-800 font-semibold">{printSlipReq.remarks || 'Standard Semester Curricular Requirements'}</span>
              </div>

              {/* Institutional Signatures & Stamps */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t-2 border-slate-800 text-center text-[10px] font-mono">
                <div>
                  <div className="h-10 border-b border-dashed border-slate-400 mb-1 flex items-center justify-center">
                    <span className="text-[9px] text-slate-600 font-bold">SIGNATURE</span>
                  </div>
                  <p className="font-bold text-slate-800">Faculty Requester</p>
                  <p className="text-slate-400">({printSlipReq.requester_name})</p>
                </div>
                <div>
                  <div className="h-10 border-b border-dashed border-slate-400 mb-1 flex items-center justify-center">
                    <span className="text-[9px] text-blue-700 font-bold bg-blue-50 px-1 border border-blue-200 rounded">DIGITALLY ENDORSED</span>
                  </div>
                  <p className="font-bold text-slate-800">Head of Department (HOD)</p>
                  <p className="text-slate-400">(Computer Science & Eng.)</p>
                </div>
                <div>
                  <div className="h-10 border-b border-dashed border-slate-400 mb-1 flex items-center justify-center">
                    <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1 border border-emerald-200 rounded">DISPATCH CONFIRMED</span>
                  </div>
                  <p className="font-bold text-slate-800">Central Storekeeper</p>
                  <p className="text-slate-400">(Central Warehouse)</p>
                </div>
              </div>

              <div className="text-center text-[9px] text-slate-400 font-mono pt-2 border-t border-slate-200">
                * Official computer-generated voucher issued by Bannari Amman Institute of Technology Stationery Portal.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email / SMTP Configuration Modal */}
      {showSmtpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full p-6 shadow-2xl space-y-4 my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Icons.Mail className="h-5 w-5 text-[#0b193c]" />
                <div>
                  <h3 className="text-sm font-bold text-[#0b193c] uppercase tracking-wider font-mono">
                    Official Email & SMTP Configuration
                  </h3>
                  <p className="text-[11px] text-slate-500">Enable real inbox notifications for faculty indents & stock alerts</p>
                </div>
              </div>
              <button
                onClick={() => setShowSmtpModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <Icons.X className="h-4 w-4" />
              </button>
            </div>

            {/* Pipeline Status Banner */}
            <div className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
              smtpConfig.configured 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              {smtpConfig.configured ? (
                <Icons.CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <Icons.AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <p className="font-bold">
                  {smtpConfig.configured 
                    ? '🟢 Live SMTP Pipeline Active' 
                    : '⚠️ Offline Presentation Mode Active (No real emails sent)'}
                </p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {smtpConfig.configured 
                    ? `Dispatches are being sent live from ${smtpConfig.emailUser} to ${smtpConfig.defaultFacultyEmail}.`
                    : `Emails are currently only saved to the database. To receive real emails in your inbox (${smtpConfig.defaultFacultyEmail}), configure your Gmail and 16-character Google App Password below.`}
                </p>
              </div>
            </div>

            {/* Feedback Alert */}
            {smtpFeedback && (
              <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                smtpFeedback.type === 'success' 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                  : 'bg-rose-50 border-rose-300 text-rose-800'
              }`}>
                {smtpFeedback.type === 'success' ? (
                  <Icons.Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <Icons.AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span className="font-medium">{smtpFeedback.message}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSaveSmtp} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Sender Gmail Address (EMAIL_USER)
                </label>
                <input
                  type="email"
                  value={smtpConfig.emailUser}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, emailUser: e.target.value })}
                  placeholder="e.g. yourname@gmail.com"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none focus:border-[#0b193c] text-xs font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Google 16-Character App Password (EMAIL_PASS)
                  {smtpConfig.hasPassword && (
                    <span className="text-[10px] text-emerald-600 font-normal ml-2">
                      (Currently set: {smtpConfig.maskedPassword})
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  value={smtpConfig.emailPass}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, emailPass: e.target.value })}
                  placeholder={smtpConfig.hasPassword ? 'Enter new password to change' : 'e.g. abcd efgh ijkl mnop'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none focus:border-[#0b193c] text-xs font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Recipient Faculty Email (DEFAULT_FACULTY_EMAIL)
                </label>
                <input
                  type="email"
                  value={smtpConfig.defaultFacultyEmail}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, defaultFacultyEmail: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none focus:border-[#0b193c] text-xs font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  All automated status updates (HOD Approval, Dispatch Ready, Stock Out alerts) are routed directly to this inbox.
                </p>
              </div>

              {/* Instructions Guide Card */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-[11px] text-slate-600">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Icons.Key className="h-3.5 w-3.5 text-amber-600" />
                  <span>How to create a 16-character Google App Password:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 pl-1 text-[11px]">
                  <li>Open your Google Account: <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" className="text-blue-600 underline">Security Settings</a>.</li>
                  <li>Enable <strong>2-Step Verification</strong> if not already enabled.</li>
                  <li>Go to <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-blue-600 underline font-semibold">Google App Passwords</a>.</li>
                  <li>Create an app named <strong>"BIT Stationary"</strong> and copy the 16 letters here.</li>
                </ol>
              </div>

              {/* Modal Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleSendTestEmail}
                  disabled={testSending}
                  className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-semibold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Icons.Send className="h-3.5 w-3.5" />
                  <span>{testSending ? 'Sending Test...' : 'Send Test Email Now'}</span>
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowSmtpModal(false)}
                    className="w-full sm:w-auto px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold rounded-xl text-xs transition-all cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={smtpSaving}
                    className="w-full sm:w-auto px-4 py-2 bg-[#0b193c] hover:bg-[#122556] disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Icons.Save className="h-3.5 w-3.5" />
                    <span>{smtpSaving ? 'Verifying & Saving...' : 'Save & Verify'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
