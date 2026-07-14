import React, { useState, useEffect } from 'react';
import { AreaChart, Area, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import TopNav from '../components/TopNav';
import BottomNav from '../components/BottomNav';
import { useApp } from '../context/AppContext';
import { statsAPI } from '../api/api';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:8,padding:'8px 12px',fontSize:13,color:'white'}}>
      <div style={{color:'var(--text-muted)',marginBottom:2}}>{label}</div>
      <div style={{fontWeight:700,color:'#7c5cfc'}}>KSh {payload[0].value.toLocaleString('en-KE')}</div>
    </div>
  );
}

export default function Dashboard() {
  const { groups, fmt } = useApp();
  const [period,     setPeriod]     = useState('month');
  const [summary,    setSummary]    = useState(null);
  const [byCategory, setByCategory] = useState([]);
  const [byMonth,    setByMonth]    = useState([]);
  const [byGroup,    setByGroup]    = useState([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      statsAPI.summary(period),
      statsAPI.byCategory(period),
      statsAPI.byMonth(),
      statsAPI.byGroup(),
    ]).then(([s, c, m, g]) => {
      if (s.status === 'fulfilled') setSummary(s.value.data);
      if (c.status === 'fulfilled') setByCategory(c.value.data);
      if (m.status === 'fulfilled') setByMonth(m.value.data);
      if (g.status === 'fulfilled') setByGroup(g.value.data);
    }).finally(() => setLoading(false));
  }, [period]);

  const noData = !loading && byMonth.length === 0 && byCategory.length === 0;

  return (
    <div className="app-shell">
      <TopNav title="Dashboard" />
      <div className="page-content fade-in">
        <div className="dashboard-header">
          <h2 style={{marginBottom:14}}>Your Spending</h2>
          <div className="period-selector">
            {[['day','Day'],['month','Month'],['quarter','Quarter'],['year','Year']].map(([v,l]) => (
              <div key={v} className={`period-btn ${period===v?'active':''}`} onClick={() => setPeriod(v)}>{l}</div>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="loading-dots" style={{padding:60}}><div className="loading-dot"/><div className="loading-dot"/><div className="loading-dot"/></div>
        ) : noData ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-title">No data yet</div>
            <div className="empty-state-text">Add some expenses to see your spending stats here.</div>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="summary-grid">
              {[
                { icon:'💸', value: fmt(summary?.totalSpent || 0), label:'Total spent' },
                { icon:'⚖️', value: fmt(summary?.youOwe || 0),     label:'You owe',     color:'var(--red)' },
                { icon:'🤲', value: fmt(summary?.owedToYou || 0),  label:'Owed to you', color:'var(--green)' },
                { icon:'👥', value: groups.length,                  label:'Groups' },
              ].map((s, i) => (
                <div key={i} className="summary-box">
                  <div className="summary-box-icon">{s.icon}</div>
                  <div className="summary-box-value" style={{fontSize:17, color: s.color || 'inherit'}}>{s.value}</div>
                  <div className="summary-box-label">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Monthly chart */}
            {byMonth.length > 0 && (
              <div className="chart-card">
                <div className="chart-card-title">Monthly Spending</div>
                <div className="chart-card-subtitle">Last 6 months</div>
                <div style={{height:190}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={byMonth} margin={{top:8,right:8,left:-18,bottom:0}}>
                      <defs>
                        <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"  stopColor="#7c5cfc" stopOpacity={0.35}/>
                          <stop offset="100%" stopColor="#7c5cfc" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="rgba(124,92,252,0.12)"/>
                      <XAxis dataKey="month" tick={{fill:'#8a8ab0',fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:'#8a8ab0',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                      <Tooltip content={<CustomTooltip/>} cursor={{stroke:'#7c5cfc',strokeWidth:1,strokeDasharray:'4 4'}}/>
                      <Area type="monotone" dataKey="amount" stroke="#7c5cfc" strokeWidth={3}
                        fill="url(#spendFill)" dot={{r:3,fill:'#7c5cfc',strokeWidth:0}}
                        activeDot={{r:5,fill:'#a78bfa',stroke:'#fff',strokeWidth:2}}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* By Category */}
            {byCategory.length > 0 && (
              <div className="chart-card">
                <div className="chart-card-title">By Category</div>
                <div className="chart-card-subtitle">This {period}</div>
                <div className="category-list">
                  {byCategory.map(c => (
                    <div key={c.category} className="category-row">
                      <div className="category-icon">{c.emoji || '📦'}</div>
                      <div className="category-info">
                        <div className="flex-between">
                          <span className="category-name">{c.category}</span>
                          <span className="category-amount">{fmt(c.amount)}</span>
                        </div>
                        <div className="category-bar-bg">
                          <div className="category-bar" style={{width:`${c.percent || 0}%`}}/>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* By Group */}
            {byGroup.length > 0 && (
              <div className="chart-card">
                <div className="chart-card-title">By Group</div>
                <div className="chart-card-subtitle">Expense totals</div>
                {byGroup.map(g => {
                  const max = Math.max(...byGroup.map(x => x.total), 1);
                  return (
                    <div key={g.id} className="category-row" style={{marginBottom:14}}>
                      <div style={{fontSize:22,width:36}}>{g.icon||'💰'}</div>
                      <div className="category-info">
                        <div className="flex-between">
                          <span className="category-name">{g.name}</span>
                          <span className="category-amount">{fmt(g.total)}</span>
                        </div>
                        <div className="category-bar-bg">
                          <div className="category-bar" style={{width:`${(g.total/max)*100}%`}}/>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
