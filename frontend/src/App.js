import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Upload, Calculator, FileText, TrendingUp, Building, DollarSign, BarChart3 } from 'lucide-react';

const LeasrAnalyze = () => {
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
      
      * { margin: 0; padding: 0; box-sizing: border-box; }
      
      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        background: #0a0a0b;
        color: #ffffff;
        overflow-x: hidden;
      }
      
      .app-container {
        min-height: 100vh;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        position: relative;
      }
      
      .app-container::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        background: 
          radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.15) 0%, transparent 50%);
        pointer-events: none;
      }
      
      .glass-card {
        background: rgba(255, 255, 255, 0.08);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 24px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
      }
      
      .hero-gradient {
        background: linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%);
        border-radius: 24px 24px 0 0;
      }
      
      .tab-button {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.7);
        padding: 12px 24px;
        border-radius: 12px;
        font-weight: 500;
        transition: all 0.3s ease;
        cursor: pointer;
      }
      
      .tab-button:hover {
        background: rgba(255, 255, 255, 0.15);
        color: white;
        transform: translateY(-2px);
      }
      
      .tab-button.active {
        background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        color: white;
        box-shadow: 0 8px 25px rgba(59, 130, 246, 0.3);
      }
      
      .form-section {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        backdrop-filter: blur(15px);
      }
      
      .input-field {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        color: white;
        padding: 12px 16px;
        font-size: 14px;
        transition: all 0.3s ease;
        width: 100%;
      }
      
      .input-field:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        background: rgba(255, 255, 255, 0.12);
      }
      
      .input-field::placeholder { color: rgba(255, 255, 255, 0.5); }
      
      .premium-button {
        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
        border: none;
        border-radius: 16px;
        color: white;
        padding: 16px 32px;
        font-weight: 600;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 8px 25px rgba(59, 130, 246, 0.3);
      }
      
      .premium-button:hover {
        transform: translateY(-3px);
        box-shadow: 0 12px 35px rgba(59, 130, 246, 0.4);
      }
      
      .upload-zone {
        border: 2px dashed rgba(255, 255, 255, 0.3);
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.03);
        transition: all 0.3s ease;
      }
      
      .upload-zone:hover {
        border-color: #3b82f6;
        background: rgba(59, 130, 246, 0.05);
        transform: translateY(-2px);
      }
      
      .metric-card {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 16px;
        backdrop-filter: blur(15px);
        transition: all 0.3s ease;
      }
      
      .metric-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
      }
      
      .metric-card.conservative { border-left: 4px solid #ef4444; }
      .metric-card.base { border-left: 4px solid #3b82f6; }
      .metric-card.optimistic { border-left: 4px solid #10b981; }
      
      .table-container {
        background: rgba(255, 255, 255, 0.06);
        border-radius: 12px;
        overflow: hidden;
        backdrop-filter: blur(15px);
      }
      
      .table-header {
        background: rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.9);
        font-weight: 600;
      }
      
      .table-row {
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        transition: background 0.2s ease;
      }
      
      .table-row:hover { background: rgba(255, 255, 255, 0.05); }
      
      .logo-text {
        background: linear-gradient(135deg, #ffffff 0%, #a78bfa 50%, #3b82f6 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-weight: 800;
        letter-spacing: -0.5px;
      }
      
      .subtitle-text { color: rgba(255, 255, 255, 0.7); }
      .section-title { color: rgba(255, 255, 255, 0.95); font-weight: 600; }
      .label-text { color: rgba(255, 255, 255, 0.8); font-weight: 500; font-size: 14px; }
      .value-text { color: white; font-weight: 600; }
      
      .floating-icon { animation: float 3s ease-in-out infinite; }
      @keyframes float {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-10px); }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
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
  
  // API configuration
  const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000' 
    : 'https://analyze-ysg7.onrender.com';

  const handleBenchmarkChange = (field, value) => {
    setBenchmarkData(prev => ({ ...prev, [field]: value }));
    const newAutoFilled = new Set(autoFilledFields);
    newAutoFilled.delete(field);
    setAutoFilledFields(newAutoFilled);
  };

  const handleGeneralParamsChange = (field, value) => {
    setGeneralParams(prev => ({ ...prev, [field]: value }));
  };

  const handleScenarioChange = (scenario, field, value) => {
    setScenarios(prev => ({
      ...prev,
      [scenario]: { ...prev[scenario], [field]: value }
    }));
    const newAutoFilled = new Set(autoFilledFields);
    newAutoFilled.delete(`${scenario}-${field}`);
    setAutoFilledFields(newAutoFilled);
  };
// Auto-fill scenario values when benchmark data changes
  useEffect(() => {
    if (benchmarkData.rent) {
      const newAutoFilled = new Set(autoFilledFields);

      if (!scenarios.conservative.rent) {
        setScenarios(prev => ({
          ...prev,
          conservative: {
            ...prev.conservative,
            rent: (parseFloat(benchmarkData.rent) * 0.9).toFixed(2),
            downPayment: prev.conservative.downPayment || '30',
            interestRate: prev.conservative.interestRate || '6.5',
            appreciation: prev.conservative.appreciation || '2'
          }
        }));
        newAutoFilled.add('conservative-rent');
        newAutoFilled.add('conservative-downPayment');
        newAutoFilled.add('conservative-interestRate');
        newAutoFilled.add('conservative-appreciation');
      }

      if (!scenarios.base.rent) {
        setScenarios(prev => ({
          ...prev,
          base: {
            ...prev.base,
            rent: benchmarkData.rent,
            downPayment: prev.base.downPayment || '25',
            interestRate: prev.base.interestRate || '5.5',
            appreciation: prev.base.appreciation || '3'
          }
        }));
        newAutoFilled.add('base-rent');
        newAutoFilled.add('base-downPayment');
        newAutoFilled.add('base-interestRate');
        newAutoFilled.add('base-appreciation');
      }

      if (!scenarios.optimistic.rent) {
        setScenarios(prev => ({
          ...prev,
          optimistic: {
            ...prev.optimistic,
            rent: (parseFloat(benchmarkData.rent) * 1.1).toFixed(2),
            downPayment: prev.optimistic.downPayment || '20',
            interestRate: prev.optimistic.interestRate || '4.5',
            appreciation: prev.optimistic.appreciation || '4'
          }
        }));
        newAutoFilled.add('optimistic-rent');
        newAutoFilled.add('optimistic-downPayment');
        newAutoFilled.add('optimistic-interestRate');
        newAutoFilled.add('optimistic-appreciation');
      }

      setAutoFilledFields(newAutoFilled);
    }
  }, [benchmarkData.rent]);
const handleFileUpload = async (file) => {
    setUploadStatus('📄 Uploading to server...');
    
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
      
      if (extractedData.rent) {
        setBenchmarkData(prev => ({ ...prev, rent: extractedData.rent.toString() }));
        newAutoFilled.add('rent');
      }
      if (extractedData.sqft) {
        setBenchmarkData(prev => ({ ...prev, sqft: extractedData.sqft.toString() }));
        newAutoFilled.add('sqft');
      }
      if (extractedData.cam) {
        setBenchmarkData(prev => ({ ...prev, cam: extractedData.cam.toString() }));
        newAutoFilled.add('cam');
      }
      if (extractedData.taxes) {
        setBenchmarkData(prev => ({ ...prev, taxes: extractedData.taxes.toString() }));
        newAutoFilled.add('taxes');
      }
      if (extractedData.price) {
        setBenchmarkData(prev => ({ ...prev, purchasePrice: extractedData.price.toString() }));
        newAutoFilled.add('purchasePrice');
      }
      if (extractedData.operatingExpenses) {
        setBenchmarkData(prev => ({ ...prev, operatingExpenses: extractedData.operatingExpenses.toString() }));
        newAutoFilled.add('operatingExpenses');
      }
      if (extractedData.propertyType) {
        setBenchmarkData(prev => ({ ...prev, propertyType: extractedData.propertyType }));
        newAutoFilled.add('propertyType');
      }
      
      setAutoFilledFields(newAutoFilled);
      
      const fieldCount = Object.keys(extractedData).filter(key => 
        !['documentType', 'textLength', 'validation', 'textSample'].includes(key) && extractedData[key] != null
      ).length;
      
      setUploadStatus(`✅ Successfully parsed ${extractedData.documentType || 'document'}: ${fieldCount} fields extracted`);
      
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus(`❌ Error: ${error.message}`);
    }
  };
const calculateMetrics = async () => {
    setUploadStatus('🔢 Running financial analysis...');
    
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
        scenarios: {
          conservative: {
            rent: parseFloat(scenarios.conservative.rent) || parseFloat(benchmarkData.rent) * 0.9 || 22.5,
            downPayment: parseFloat(scenarios.conservative.downPayment) || 30,
            interestRate: parseFloat(scenarios.conservative.interestRate) || 6.5,
            appreciation: parseFloat(scenarios.conservative.appreciation) || 2
          },
          base: {
            rent: parseFloat(scenarios.base.rent) || parseFloat(benchmarkData.rent) || 25,
            downPayment: parseFloat(scenarios.base.downPayment) || 25,
            interestRate: parseFloat(scenarios.base.interestRate) || 5.5,
            appreciation: parseFloat(scenarios.base.appreciation) || 3
          },
          optimistic: {
            rent: parseFloat(scenarios.optimistic.rent) || parseFloat(benchmarkData.rent) * 1.1 || 27.5,
            downPayment: parseFloat(scenarios.optimistic.downPayment) || 20,
            interestRate: parseFloat(scenarios.optimistic.interestRate) || 4.5,
            appreciation: parseFloat(scenarios.optimistic.appreciation) || 4
          }
        }
      };
      
      const response = await fetch(`${API_BASE_URL}/calculate-metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to calculate metrics');
      }
      
      const calculatedResults = await response.json();
      setResults(calculatedResults);
      setActiveTab('results');
      setUploadStatus('✅ Analysis complete!');
      
    } catch (error) {
      console.error('Calculation error:', error);
      setUploadStatus(`❌ Calculation error: ${error.message}`);
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
          const remainingBalance = year === 0 ? purchasePrice * (1 - downPayment / 100) : 
            (results[scenario].amortSchedule && results[scenario].amortSchedule[Math.min(year * 12 - 1, results[scenario].amortSchedule.length - 1)]?.balance || 0);
          
          const cumulativeCashFlow = year === 0 ? 0 : 
            (results[scenario].annualCashFlows ? results[scenario].annualCashFlows.slice(0, year).reduce((sum, cf) => sum + cf, 0) : 0);
          
          const equity = currentValue - remainingBalance;
          const totalProfit = (equity - downPaymentAmount) + cumulativeCashFlow;
          
          dataPoint[`${scenario}Equity`] = equity;
          dataPoint[`${scenario}CashFlow`] = cumulativeCashFlow;
          dataPoint[`${scenario}Profit`] = totalProfit;
        }
      });
      
      data.push(dataPoint);
    }
    
    return data;
  };
return (
    <div className="app-container">
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px', position: 'relative', zIndex: 1 }}>
        <div className="glass-card" style={{ marginBottom: '24px' }}>
          {/* Premium Header */}
          <div className="hero-gradient" style={{ padding: '48px 32px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '16px' }}>
                <Building className="floating-icon" style={{ width: '48px', height: '48px', color: '#3b82f6' }} />
                <h1 className="logo-text" style={{ fontSize: '3rem', lineHeight: '1.2' }}>
                  Leasr Analyze
                </h1>
              </div>
              <p className="subtitle-text" style={{ fontSize: '1.25rem', maxWidth: '600px', margin: '0 auto' }}>
                AI-powered commercial real estate investment analysis with multi-scenario modeling and market intelligence
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', marginTop: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <DollarSign style={{ width: '20px', height: '20px', color: '#10b981' }} />
                  <span style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '14px' }}>IRR Analysis</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BarChart3 style={{ width: '20px', height: '20px', color: '#3b82f6' }} />
                  <span style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '14px' }}>Market Intelligence</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calculator style={{ width: '20px', height: '20px', color: '#a78bfa' }} />
                  <span style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '14px' }}>Multi-Scenario</span>
                </div>
              </div>
            </div>
          </div>

          {/* Premium Navigation */}
          <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
              {[
                { id: 'input', label: 'Deal Input', icon: FileText },
                { id: 'results', label: 'Analysis Results', icon: TrendingUp }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <tab.icon style={{ width: '18px', height: '18px' }} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: '32px' }}>
            {activeTab === 'input' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                {/* File Upload Section */}
                <div className="upload-zone" style={{ padding: '48px 32px', textAlign: 'center' }}>
                  <Upload style={{ width: '48px', height: '48px', color: 'rgba(255, 255, 255, 0.6)', margin: '0 auto 16px' }} />
                  <h3 style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '1.25rem', fontWeight: '600', marginBottom: '8px' }}>
                    Upload CoStar or Title Report
                  </h3>
                  <p style={{ color: 'rgba(255, 255, 255, 0.6)', marginBottom: '24px' }}>
                    AI-powered parsing of PDF documents for instant data extraction
                  </p>
                  
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
                    className="premium-button"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Upload style={{ width: '20px', height: '20px' }} />
                    Choose PDF File
                  </label>
                  
                  {uploadStatus && (
                    <div style={{
                      marginTop: '16px',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      backgroundColor: uploadStatus.includes('✅') ? 'rgba(16, 185, 129, 0.2)' : 
                                     uploadStatus.includes('❌') ? 'rgba(239, 68, 68, 0.2)' : 
                                     'rgba(59, 130, 246, 0.2)',
                      border: `1px solid ${uploadStatus.includes('✅') ? 'rgba(16, 185, 129, 0.3)' : 
                                         uploadStatus.includes('❌') ? 'rgba(239, 68, 68, 0.3)' : 
                                         'rgba(59, 130, 246, 0.3)'}`,
                      color: uploadStatus.includes('✅') ? '#10b981' : 
                             uploadStatus.includes('❌') ? '#ef4444' : '#3b82f6'
                    }}>
                      {uploadStatus}
                    </div>
                  )}
                  
                  {parsedData && (
                    <div className="form-section" style={{ marginTop: '24px', padding: '24px', textAlign: 'left' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h4 className="section-title">Extracted Data</h4>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '500',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          backgroundColor: parsedData.documentType === 'title' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                          color: parsedData.documentType === 'title' ? '#10b981' : '#3b82f6',
                          border: `1px solid ${parsedData.documentType === 'title' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`
                        }}>
                          {parsedData.documentType?.toUpperCase() || 'UNKNOWN'} REPORT
                        </span>
                      </div>
                      
                      {/* Location Information */}
                      {(parsedData.city || parsedData.state || parsedData.county) && (
                        <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                          <div style={{ color: '#3b82f6', fontWeight: '600', fontSize: '12px', marginBottom: '8px' }}>📍 LOCATION DATA:</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px', fontSize: '12px' }}>
                            {parsedData.city && (
                              <div><span className="label-text">City:</span> <span className="value-text">{parsedData.city}</span></div>
                            )}
                            {parsedData.state && (
                              <div><span className="label-text">State:</span> <span className="value-text">{parsedData.state}</span></div>
                            )}
                            {parsedData.county && (
                              <div><span className="label-text">County:</span> <span className="value-text">{parsedData.county}</span></div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Price Note for Transparency */}
                      {parsedData.priceNote && (
                        <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                          <div style={{ color: '#f59e0b', fontSize: '12px', fontWeight: '500' }}>{parsedData.priceNote}</div>
                        </div>
                      )}
                      
                      {/* Validation Results */}
                      {parsedData.validation && (
                        <div style={{ marginBottom: '16px' }}>
                          {parsedData.validation.errors?.length > 0 && (
                            <div style={{ marginBottom: '12px', padding: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px' }}>
                              <div style={{ color: '#ef4444', fontWeight: '600', fontSize: '12px', marginBottom: '8px' }}>❌ ERRORS:</div>
                              {parsedData.validation.errors.map((error, idx) => (
                                <div key={idx} style={{ color: '#ef4444', fontSize: '12px', marginLeft: '16px' }}>• {error}</div>
                              ))}
                            </div>
                          )}
                          
                          {parsedData.validation.warnings?.length > 0 && (
                            <div style={{ marginBottom: '12px', padding: '8px', backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: '6px' }}>
                              <div style={{ color: '#f59e0b', fontWeight: '600', fontSize: '12px', marginBottom: '8px' }}>⚠️ WARNINGS:</div>
                              {parsedData.validation.warnings.map((warning, idx) => (
                                <div key={idx} style={{ color: '#f59e0b', fontSize: '12px', marginLeft: '16px' }}>• {warning}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Extracted Fields */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '12px' }}>
                        {Object.entries(parsedData).filter(([key, value]) => 
                          !['documentType', 'validation', 'rawTextLength', 'detectedType', 'textLength', 'textSample', 'city', 'state', 'county', 'priceNote'].includes(key) && 
                          value !== null && value !== undefined
                        ).map(([key, value]) => (
                          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                            <span className="label-text" style={{ textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                            <span className="value-text">
                              {typeof value === 'number' && ['rent', 'cam', 'taxes'].includes(key) ? `$${value}` :
                               typeof value === 'number' && ['price', 'operatingExpenses'].includes(key) ? `$${value.toLocaleString()}` :
                               typeof value === 'number' && key === 'sqft' ? `${value.toLocaleString()} sf` :
                               typeof value === 'number' && key === 'acreage' ? `${value} acres` :
                               typeof value === 'string' && value.length > 30 ? `${value.substring(0, 30)}...` :
                               value.toString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {/* Benchmark Data */}
                <div className="form-section" style={{ padding: '32px' }}>
                  <h3 className="section-title" style={{ fontSize: '1.5rem', marginBottom: '24px' }}>Benchmark Data</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
                    {[
                      { key: 'rent', label: 'Rent ($/sqft)', placeholder: '25.00' },
                      { key: 'cam', label: 'CAM ($/sqft)', placeholder: '5.00' },
                      { key: 'taxes', label: 'Taxes ($/sqft)', placeholder: '3.50' },
                      { key: 'sqft', label: 'Square Feet', placeholder: '10000' },
                      { key: 'purchasePrice', label: 'Purchase Price', placeholder: '1000000' },
                      { key: 'operatingExpenses', label: 'Operating Expenses', placeholder: '75000' }
                    ].map(field => (
                      <div key={field.key}>
                        <label className="label-text" style={{ display: 'block', marginBottom: '8px' }}>
                          {field.label}
                          {autoFilledFields.has(field.key) && (
                            <span style={{ marginLeft: '8px', fontSize: '10px', color: '#10b981', fontWeight: '500' }}>
                              ✨ AUTO-FILLED
                            </span>
                          )}
                        </label>
                        <input
                          type="number"
                          value={benchmarkData[field.key]}
                          onChange={(e) => handleBenchmarkChange(field.key, e.target.value)}
                          className="input-field"
                          style={{
                            backgroundColor: autoFilledFields.has(field.key) 
                              ? 'rgba(16, 185, 129, 0.15)' 
                              : 'rgba(255, 255, 255, 0.08)',
                            borderColor: autoFilledFields.has(field.key) 
                              ? 'rgba(16, 185, 129, 0.3)' 
                              : 'rgba(255, 255, 255, 0.15)'
                          }}
                          placeholder={field.placeholder}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* General Parameters */}
                <div className="form-section" style={{ padding: '32px' }}>
                  <h3 className="section-title" style={{ fontSize: '1.5rem', marginBottom: '24px' }}>General Parameters</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
                    <div>
                      <label className="label-text" style={{ display: 'block', marginBottom: '8px' }}>Hold Period (years)</label>
                      <input
                        type="number"
                        value={generalParams.holdPeriod}
                        onChange={(e) => handleGeneralParamsChange('holdPeriod', e.target.value)}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label-text" style={{ display: 'block', marginBottom: '8px' }}>Loan Term (years)</label>
                      <input
                        type="number"
                        value={generalParams.loanTerm}
                        onChange={(e) => handleGeneralParamsChange('loanTerm', e.target.value)}
                        className="input-field"
                      />
                    </div>
                  </div>
                </div>
{/* Scenario Parameters */}
                <div className="form-section" style={{ padding: '32px' }}>
                  <h3 className="section-title" style={{ fontSize: '1.5rem', marginBottom: '24px' }}>Scenario Analysis</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                    {['conservative', 'base', 'optimistic'].map(scenario => (
                      <div key={scenario} className="form-section" style={{ padding: '24px' }}>
                        <h4 style={{ 
                          fontSize: '1.1rem', 
                          fontWeight: '600', 
                          marginBottom: '16px', 
                          textTransform: 'capitalize',
                          color: scenario === 'conservative' ? '#ef4444' : scenario === 'base' ? '#3b82f6' : '#10b981'
                        }}>
                          {scenario}
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          {[
                            { key: 'rent', label: 'Rent ($/sqft)', placeholder: scenario === 'conservative' ? '23' : scenario === 'base' ? '25' : '28' },
                            { key: 'downPayment', label: 'Down Payment (%)', placeholder: scenario === 'conservative' ? '30' : scenario === 'base' ? '25' : '20' },
                            { key: 'interestRate', label: 'Interest Rate (%)', placeholder: scenario === 'conservative' ? '6.5' : scenario === 'base' ? '5.5' : '4.5' },
                            { key: 'appreciation', label: 'Appreciation (%)', placeholder: scenario === 'conservative' ? '2' : scenario === 'base' ? '3' : '4' }
                          ].map(param => (
                            <div key={param.key}>
                              <label className="label-text" style={{ display: 'block', marginBottom: '4px' }}>
                                {param.label}
                                {autoFilledFields.has(`${scenario}-${param.key}`) && (
                                  <span style={{ marginLeft: '8px', fontSize: '10px', color: '#10b981', fontWeight: '500' }}>
                                    ✨ AUTO-FILLED
                                  </span>
                                )}
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={scenarios[scenario][param.key]}
                                onChange={(e) => handleScenarioChange(scenario, param.key, e.target.value)}
                                className="input-field"
                                style={{
                                  backgroundColor: autoFilledFields.has(`${scenario}-${param.key}`) 
                                    ? 'rgba(16, 185, 129, 0.15)' 
                                    : 'rgba(255, 255, 255, 0.08)',
                                  borderColor: autoFilledFields.has(`${scenario}-${param.key}`) 
                                    ? 'rgba(16, 185, 129, 0.3)' 
                                    : 'rgba(255, 255, 255, 0.15)'
                                }}
                                placeholder={param.placeholder}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Analyze Button */}
                <div style={{ textAlign: 'center' }}>
                  <button
                    onClick={calculateMetrics}
                    className="premium-button"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', fontSize: '18px', padding: '20px 40px' }}
                  >
                    <Calculator style={{ width: '24px', height: '24px' }} />
                    Analyze the Deal
                  </button>
                </div>
              </div>
            )}
{activeTab === 'results' && results && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                {/* Key Metrics */}
                <div>
                  <h3 className="section-title" style={{ fontSize: '1.5rem', marginBottom: '24px', textAlign: 'center' }}>Investment Analysis Results</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                    {['conservative', 'base', 'optimistic'].map(scenario => (
                      <div key={scenario} className={`metric-card ${scenario}`} style={{ padding: '24px' }}>
                        <h4 style={{ 
                          fontSize: '1.25rem', 
                          fontWeight: '700', 
                          marginBottom: '20px', 
                          textTransform: 'capitalize',
                          color: scenario === 'conservative' ? '#ef4444' : scenario === 'base' ? '#3b82f6' : '#10b981'
                        }}>
                          {scenario} Scenario
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="label-text">Cap Rate:</span>
                            <span className="value-text" style={{ fontSize: '1.1rem' }}>{results[scenario].capRate}%</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="label-text">Cash Flow:</span>
                            <span className="value-text" style={{ fontSize: '1.1rem' }}>${parseInt(results[scenario].cashFlow).toLocaleString()}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="label-text">CoC Return:</span>
                            <span className="value-text" style={{ fontSize: '1.1rem' }}>{results[scenario].cocReturn}%</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="label-text">IRR:</span>
                            <span className="value-text" style={{ fontSize: '1.1rem', fontWeight: '700' }}>{results[scenario].irr}%</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="label-text">Future Value:</span>
                            <span className="value-text" style={{ fontSize: '1.1rem' }}>${parseInt(results[scenario].futureValue).toLocaleString()}</span>
                          </div>
                          {results[scenario].dscr && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span className="label-text">DSCR:</span>
                              <span className="value-text" style={{ fontSize: '1.1rem' }}>{results[scenario].dscr}x</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Time Series Chart */}
                <div style={{ background: 'rgba(255, 255, 255, 0.04)', borderRadius: '16px', padding: '24px' }}>
                  <h3 className="section-title" style={{ fontSize: '1.25rem', marginBottom: '20px' }}>Investment Performance Over Time (All Scenarios)</h3>
                  <div style={{ marginBottom: '16px', fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)' }}>
                    📊 Solid lines show equity growth, dashed lines show cumulative cash flow for each scenario
                  </div>
                  <div style={{ height: '400px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={generateTimeSeriesData()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                        <XAxis 
                          dataKey="year" 
                          stroke="rgba(255, 255, 255, 0.7)"
                          style={{ fontSize: '12px' }}
                          label={{ value: 'Years', position: 'insideBottom', offset: -5, style: { fill: 'rgba(255, 255, 255, 0.7)' } }}
                        />
                        <YAxis 
                          stroke="rgba(255, 255, 255, 0.7)"
                          style={{ fontSize: '12px' }}
                          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                          label={{ value: 'Value ($)', angle: -90, position: 'insideLeft', style: { fill: 'rgba(255, 255, 255, 0.7)' } }}
                        />
                        <Tooltip 
                          formatter={(value, name) => [
                            `$${parseInt(value).toLocaleString()}`, 
                            name.replace(/([A-Z])/g, ' $1').replace(/^\w/, c => c.toUpperCase())
                          ]}
                          contentStyle={{
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '8px',
                            color: 'white'
                          }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="conservativeEquity" stroke="#ef4444" strokeWidth={2} name="Conservative Equity" />
                        <Line type="monotone" dataKey="baseEquity" stroke="#3b82f6" strokeWidth={2} name="Base Equity" />
                        <Line type="monotone" dataKey="optimisticEquity" stroke="#10b981" strokeWidth={2} name="Optimistic Equity" />
                        <Line type="monotone" dataKey="conservativeCashFlow" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" name="Conservative Cash Flow" />
                        <Line type="monotone" dataKey="baseCashFlow" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" name="Base Cash Flow" />
                        <Line type="monotone" dataKey="optimisticCashFlow" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" name="Optimistic Cash Flow" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
{/* Rent Sensitivity Analysis */}
                {results && (
                  <div className="form-section" style={{ padding: '32px' }}>
                    <h3 className="section-title" style={{ fontSize: '1.25rem', marginBottom: '20px' }}>IRR Sensitivity to Rent Changes</h3>
                    <div style={{ marginBottom: '16px', fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)' }}>
                      📈 Shows how IRR changes with different rent assumptions across all scenarios
                      <span title="This table shows a simple proportional estimate of IRR based on rent changes. For true IRR recalculation, a full financial model is required." style={{ marginLeft: '8px', color: '#f59e0b', cursor: 'help' }}>ⓘ</span>
                    </div>
                    <div className="table-container">
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr className="table-header">
                            <th style={{ padding: '12px', textAlign: 'left' }}>Rent Change</th>
                            <th style={{ padding: '12px', textAlign: 'center', color: '#ef4444' }}>Conservative IRR</th>
                            <th style={{ padding: '12px', textAlign: 'center', color: '#3b82f6' }}>Base IRR</th>
                            <th style={{ padding: '12px', textAlign: 'center', color: '#10b981' }}>Optimistic IRR</th>
                          </tr>
                        </thead>
                        <tbody>
                          {generateRentSensitivity().map((row, index) => (
                            <tr key={index} className="table-row">
                              <td style={{ padding: '12px' }}><span className="value-text">{row.rentChange}</span></td>
                              <td style={{ padding: '12px', textAlign: 'center' }}><span className="value-text">{row.conservative}%</span></td>
                              <td style={{ padding: '12px', textAlign: 'center' }}><span className="value-text">{row.base}%</span></td>
                              <td style={{ padding: '12px', textAlign: 'center' }}><span className="value-text">{row.optimistic}%</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeasrAnalyze;
