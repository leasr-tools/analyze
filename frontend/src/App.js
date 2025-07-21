import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Upload, Calculator, FileText, TrendingUp, Building, DollarSign, BarChart3 } from 'lucide-react';

// Modern light theme inspired by Wise.com
const COLORS = {
  bgPrimary: '#f9fafb',     // light background
  cardBg: '#ffffff',        // white cards
  cardBorder: '#e5e7eb',    // light gray border
  accent: '#00a86b',        // modern green
  accentLight: '#3ddc97',   // lighter accent
  textPrimary: '#111827',   // dark gray text
  textSecondary: '#4b5563', // medium gray text
  autofill: '#d1fae5',      // subtle green highlight
  error: '#dc2626',         // red
  warning: '#f59e0b',       // amber
};

const FONT_FAMILY = `'Inter', 'Segoe UI', sans-serif`;

const LeasrAnalyze = () => {
  useEffect(() => {
    document.body.style.background = COLORS.bgPrimary;
    document.body.style.color = COLORS.textPrimary;
    document.body.style.fontFamily = FONT_FAMILY;
    return () => {
      document.body.style.background = '';
      document.body.style.color = '';
      document.body.style.fontFamily = '';
    };
  }, []);

  const [activeTab, setActiveTab] = useState('input');
  const [benchmarkData, setBenchmarkData] = useState({
    rent: '',
    cam: '',
    taxes: '',
    operatingExpenses: '',
    sqft: '',
    purchasePrice: '',
    propertyType: 'office'
  });

  const [generalParams, setGeneralParams] = useState({
    monthlyOperatingExpenses: '',
    holdPeriod: '10',
    interestOnlyPeriod: '2',
    loanTerm: '25'
  });

  const [scenarios, setScenarios] = useState({
    conservative: { rent: '', downPayment: '', interestRate: '', appreciation: '' },
    base: { rent: '', downPayment: '', interestRate: '', appreciation: '' },
    optimistic: { rent: '', downPayment: '', interestRate: '', appreciation: '' }
  });

  const [results, setResults] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [autoFilledFields, setAutoFilledFields] = useState(new Set());

  const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000' 
    : 'https://analyze-ysg7.onrender.com';

  const handleBenchmarkChange = (field, value) => {
    setBenchmarkData(prev => ({ ...prev, [field]: value }));
    const newAutoFilled = new Set(autoFilledFields);
    newAutoFilled.delete(field);
    setAutoFilledFields(newAutoFilled);
  };

  const handleFileUpload = async (file) => {
    setUploadStatus('Uploading to server...');
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/parse-pdf`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to parse PDF');
      }

      const extractedData = await response.json();
      setParsedData(extractedData);

      const newAutoFilled = new Set();
      ['rent', 'sqft', 'cam', 'taxes', 'price', 'operatingExpenses', 'propertyType'].forEach((key) => {
        if (extractedData[key]) {
          const field = key === 'price' ? 'purchasePrice' : key;
          setBenchmarkData(prev => ({ ...prev, [field]: extractedData[key].toString() }));
          newAutoFilled.add(field);
        }
      });
      setAutoFilledFields(newAutoFilled);
      setUploadStatus(`Successfully parsed ${extractedData.documentType || 'document'}`);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus(`Error: ${error.message}`);
    }
  };

  const calculateMetrics = async () => {
    setUploadStatus('Running financial analysis...');
    try {
      const requestData = {
        general: {
          purchasePrice: parseFloat(benchmarkData.purchasePrice) || 1000000,
          sqft: parseFloat(benchmarkData.sqft) || 10000,
          cam: parseFloat(benchmarkData.cam) || 5,
          taxes: parseFloat(benchmarkData.taxes) || 2,
          monthlyOperatingExpenses: parseFloat(generalParams.monthlyOperatingExpenses) || 0,
          holdPeriod: parseInt(generalParams.holdPeriod) || 10,
          loanTerm: parseInt(generalParams.loanTerm) || 25,
          interestOnlyPeriod: parseInt(generalParams.interestOnlyPeriod) || 2
        },
        scenarios
      };

      const response = await fetch(`${API_BASE_URL}/calculate-metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) throw new Error('Failed to calculate metrics');
      const calculatedResults = await response.json();
      setResults(calculatedResults);
      setActiveTab('results');
      setUploadStatus('Analysis complete!');
    } catch (error) {
      console.error('Calculation error:', error);
      setUploadStatus(`Calculation error: ${error.message}`);
    }
  };

  const generateRentSensitivity = () => {
    if (!results) return [];
    const variations = [-10, -5, 0, 5, 10];
    return variations.map(variation => ({
      rentChange: `${variation > 0 ? '+' : ''}${variation}%`,
      conservative: (parseFloat(results.conservative.irr) * (1 + variation / 100)).toFixed(2),
      base: (parseFloat(results.base.irr) * (1 + variation / 100)).toFixed(2),
      optimistic: (parseFloat(results.optimistic.irr) * (1 + variation / 100)).toFixed(2)
    }));
  };

  const generateTimeSeriesData = () => {
    const data = [];
    const holdPeriod = parseInt(generalParams.holdPeriod) || 10;
    for (let year = 0; year <= holdPeriod; year++) {
      const dataPoint = { year };
      ['conservative', 'base', 'optimistic'].forEach(scenario => {
        if (results && results[scenario]) {
          const purchasePrice = parseFloat(benchmarkData.purchasePrice) || 1000000;
          const downPayment = parseFloat(scenarios[scenario].downPayment) || 25;
          const appreciation = parseFloat(scenarios[scenario].appreciation) || 3;
          const downPaymentAmount = purchasePrice * (downPayment / 100);
          const currentValue = purchasePrice * Math.pow(1 + appreciation / 100, year);
          const remainingBalance = year === 0 ? purchasePrice * (1 - downPayment / 100) : 0;
          const equity = currentValue - remainingBalance;
          dataPoint[`${scenario}Equity`] = equity;
        }
      });
      data.push(dataPoint);
    }
    return data;
  };

  return (
    <div
      className="container"
      style={{
        maxWidth: 960,
        margin: '2rem auto',
        padding: '0 1.5rem',
        fontFamily: FONT_FAMILY,
        background: COLORS.bgPrimary,
        color: COLORS.textPrimary,
      }}
    >
      <div
        className="card"
        style={{
          marginBottom: '2rem',
          background: COLORS.cardBg,
          border: `1px solid ${COLORS.cardBorder}`,
          borderRadius: 12,
          boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
          padding: '2rem',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <Building style={{ width: '40px', height: '40px', color: COLORS.accent, marginBottom: '0.5rem' }} />
          <h1
            style={{
              fontFamily: FONT_FAMILY,
              fontWeight: 700,
              fontSize: '2.2rem',
              color: COLORS.accent,
              marginBottom: '0.5rem'
            }}
          >
            Leasr Analyze
          </h1>
          <p style={{ color: COLORS.textSecondary, fontSize: '1rem', marginBottom: '1rem' }}>
            AI-powered commercial real estate investment analysis
          </p>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '1.5rem' }}>
          {[
            { id: 'input', label: 'Deal Input', icon: FileText },
            { id: 'results', label: 'Analysis Results', icon: TrendingUp }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '1rem',
                fontFamily: FONT_FAMILY,
                background: activeTab === tab.id ? COLORS.accent : '#ffffff',
                color: activeTab === tab.id ? '#ffffff' : COLORS.accent,
                border: `1px solid ${COLORS.accent}`,
                borderRadius: 6,
                padding: '0.5rem 1.2rem',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              <tab.icon style={{ width: '18px', height: '18px' }} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'input' && (
          <div>
            {/* File Upload */}
            <div style={{
              textAlign: 'center',
              background: COLORS.cardBg,
              border: `1px solid ${COLORS.cardBorder}`,
              borderRadius: 8,
              padding: '1.5rem',
              marginBottom: '2rem'
            }}>
              <Upload style={{ width: '40px', height: '40px', color: COLORS.accent, marginBottom: '0.5rem' }} />
              <h3 style={{ fontSize: '1.25rem', color: COLORS.accent, marginBottom: '0.5rem' }}>
                Upload CoStar or Title Report
              </h3>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) handleFileUpload(file);
                }}
                style={{ display: 'none' }}
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                style={{
                  display: 'inline-block',
                  background: COLORS.accent,
                  color: '#fff',
                  padding: '0.5rem 1rem',
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginTop: '0.5rem'
                }}
              >
                Choose PDF File
              </label>
              {uploadStatus && <p style={{ marginTop: '0.75rem', color: COLORS.textSecondary }}>{uploadStatus}</p>}
            </div>

            {/* Benchmark Data */}
            <div
              style={{
                background: COLORS.cardBg,
                border: `1px solid ${COLORS.cardBorder}`,
                borderRadius: 8,
                padding: '1.5rem',
              }}
            >
              <h3 style={{ color: COLORS.accent, marginBottom: '1rem' }}>Benchmark Data</h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem'
              }}>
                {[
                  { key: 'rent', label: 'Rent ($/sqft)', placeholder: '25.00' },
                  { key: 'cam', label: 'CAM ($/sqft)', placeholder: '5.00' },
                  { key: 'taxes', label: 'Taxes ($/sqft)', placeholder: '3.50' },
                  { key: 'sqft', label: 'Square Feet', placeholder: '10000' },
                  { key: 'purchasePrice', label: 'Purchase Price', placeholder: '1000000' },
                  { key: 'operatingExpenses', label: 'Operating Expenses', placeholder: '75000' }
                ].map(field => (
                  <div key={field.key}>
                    <label style={{ display: 'block', marginBottom: '0.3rem', color: COLORS.textSecondary }}>
                      {field.label}
                    </label>
                    <input
                      type="number"
                      value={benchmarkData[field.key]}
                      onChange={(e) => handleBenchmarkChange(field.key, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.8rem',
                        border: `1px solid ${COLORS.cardBorder}`,
                        borderRadius: 6,
                        fontSize: '0.95rem',
                        fontFamily: FONT_FAMILY,
                        color: COLORS.textPrimary,
                        backgroundColor: '#fff',
                      }}
                      placeholder={field.placeholder}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'results' && results && (
          <div>
            {/* Investment Summary */}
            <div style={{
              background: COLORS.cardBg,
              border: `1px solid ${COLORS.cardBorder}`,
              borderRadius: 8,
              padding: '1.5rem',
              marginBottom: '2rem'
            }}>
              <h3 style={{ color: COLORS.accent, marginBottom: '1rem' }}>Investment Summary</h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem'
              }}>
                <div><strong>Total Investment:</strong> ${results.totalInvestment?.toLocaleString()}</div>
                <div><strong>Annual Cash Flow:</strong> ${results.annualCashFlow?.toLocaleString()}</div>
                <div><strong>IRR (Base):</strong> {results.base.irr ? `${(results.base.irr * 100).toFixed(2)}%` : '-'}</div>
              </div>
            </div>

            {/* Rent Sensitivity */}
            <div style={{
              background: COLORS.cardBg,
              border: `1px solid ${COLORS.cardBorder}`,
              borderRadius: 8,
              padding: '1.5rem',
              marginBottom: '2rem'
            }}>
              <h3 style={{ color: COLORS.accent, marginBottom: '1rem' }}>Rent Sensitivity</h3>
              <div>
                {generateRentSensitivity().map(row => (
                  <div key={row.rentChange} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: `1px solid ${COLORS.cardBorder}` }}>
                    <div>{row.rentChange}</div>
                    <div>${row.base}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart */}
            <div style={{
              background: COLORS.cardBg,
              border: `1px solid ${COLORS.cardBorder}`,
              borderRadius: 8,
              padding: '1.5rem'
            }}>
              <h3 style={{ color: COLORS.accent, marginBottom: '1rem' }}>Equity Growth</h3>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer>
                  <LineChart data={generateTimeSeriesData()}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.cardBorder} />
                    <XAxis dataKey="year" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="baseEquity" stroke={COLORS.accent} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeasrAnalyze;
