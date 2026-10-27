import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard.jsx';

function App() {
  const [token, setToken] = useState(localStorage.getItem('bit_token') || '');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!token);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showManualLogin, setShowManualLogin] = useState(false);

  // Fetch current user details if token exists
  useEffect(() => {
    if (token) {
      setLoading(true);
      fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => {
          if (!res.ok) {
            throw new Error('Session expired');
          }
          return res.json();
        })
        .then(data => {
          setUser(data.user);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          handleLogout();
          setLoading(false);
        });
    } else {
      setUser(null);
      setLoading(false);
    }
  }, [token]);

  // 1-Click Instant Login (Guaranteed Zero Typing / Zero Password Errors)
  const handleInstantLogin = async (roleName) => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: roleName })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Instant login failed');
      }
      localStorage.setItem('bit_token', data.token);
      setToken(data.token);
      setUser(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Traditional manual login
  const handleManualLogin = async (e) => {
    if (e) e.preventDefault();
    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }
    setError('');
    setLoading(true);
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: username.trim(), password: password.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }
      localStorage.setItem('bit_token', data.token);
      setToken(data.token);
      setUser(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('bit_token');
    setToken('');
    setUser(null);
    setUsername('');
    setPassword('');
    setError('');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#0b193c] mx-auto"></div>
          <p className="mt-3 text-slate-600 font-medium text-sm">Authenticating Session...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <Dashboard 
        token={token} 
        user={user} 
        onLogout={handleLogout} 
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden bg-slate-100">
      {/* Background Gradients */}
      <div className="absolute top-[-15%] left-[-10%] w-[45%] h-[45%] bg-[#0b193c]/5 blur-[100px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-15%] right-[-10%] w-[45%] h-[45%] bg-[#a6822c]/5 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md bg-white p-7 rounded-2xl border border-slate-200 shadow-xl relative z-10">
        {/* Institutional Header */}
        <div className="text-center mb-6">
          <img 
            src="/logo.png" 
            alt="BIT Campus Logo" 
            className="h-20 mx-auto mb-3 object-contain" 
          />
          <h2 className="text-xl font-bold tracking-tight text-[#0b193c]">BIT Campus Portal</h2>
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mt-0.5">Stationary & Pre-Procurement Management</p>
        </div>

        {error && (
          <div className="mb-5 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
            <svg className="h-4 w-4 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* FEATURE 1: 1-Click Instant Role Login (Front & Center) */}
        <div className="space-y-3 mb-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#0b193c] flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              1-Click Instant Role Login
            </span>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Zero Typing Required
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Faculty */}
            <button
              type="button"
              onClick={() => handleInstantLogin('faculty')}
              className="p-3 bg-slate-50/80 hover:bg-blue-50/80 border border-slate-200 hover:border-blue-300 rounded-xl transition-all text-left flex flex-col justify-between cursor-pointer group shadow-xs"
            >
              <div className="flex justify-between items-center w-full">
                <span className="font-bold text-slate-800 text-xs group-hover:text-blue-700">Faculty</span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">CS</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 font-mono">Raise Indents</span>
            </button>

            {/* HOD */}
            <button
              type="button"
              onClick={() => handleInstantLogin('hod')}
              className="p-3 bg-slate-50/80 hover:bg-amber-50/80 border border-slate-200 hover:border-amber-300 rounded-xl transition-all text-left flex flex-col justify-between cursor-pointer group shadow-xs"
            >
              <div className="flex justify-between items-center w-full">
                <span className="font-bold text-slate-800 text-xs group-hover:text-amber-700">HOD Approver</span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">HOD</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 font-mono">Approve Indents</span>
            </button>

            {/* Storekeeper */}
            <button
              type="button"
              onClick={() => handleInstantLogin('storekeeper')}
              className="p-3 bg-slate-50/80 hover:bg-emerald-50/80 border border-slate-200 hover:border-emerald-300 rounded-xl transition-all text-left flex flex-col justify-between cursor-pointer group shadow-xs"
            >
              <div className="flex justify-between items-center w-full">
                <span className="font-bold text-slate-800 text-xs group-hover:text-emerald-700">Storekeeper</span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Store</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 font-mono">Dispatch & Stock</span>
            </button>

            {/* Procurement */}
            <button
              type="button"
              onClick={() => handleInstantLogin('procurement')}
              className="p-3 bg-slate-50/80 hover:bg-purple-50/80 border border-slate-200 hover:border-purple-300 rounded-xl transition-all text-left flex flex-col justify-between cursor-pointer group shadow-xs"
            >
              <div className="flex justify-between items-center w-full">
                <span className="font-bold text-slate-800 text-xs group-hover:text-purple-700">Procurement</span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">PO</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 font-mono">Auto RFQs & Restock</span>
            </button>
          </div>
        </div>

        {/* Collapsible Manual Sign In (For Optional Manual Testing) */}
        <div className="pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowManualLogin(!showManualLogin)}
            className="w-full flex items-center justify-between py-2 px-3 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-all border border-dashed border-slate-200 cursor-pointer"
          >
            <span>Or Enter Credentials Manually</span>
            <svg 
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${showManualLogin ? 'rotate-180' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showManualLogin && (
            <form onSubmit={handleManualLogin} className="space-y-3 mt-3 pt-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Username / Email</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="faculty_cs (or sanjayc.cb23@bitsathy.ac.in)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="password (8 characters)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none text-xs font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-[#0b193c] hover:bg-[#122556] text-white rounded-xl font-semibold text-xs transition-all uppercase tracking-wider cursor-pointer"
              >
                Sign In With Password
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
