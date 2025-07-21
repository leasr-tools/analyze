import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Upload, Calculator, FileText, TrendingUp, Building, DollarSign, BarChart3 } from 'lucide-react';

const LeasrAnalyze = () => {
  useEffect(() => {
    // Remove previous style injection, let laboucle-theme.css handle global styles
    document.body.classList.add('laboucle-theme');
    return () => document.body.classList.remove('laboucle-theme');
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
    <div className="container">
      <div className="card" style={{ marginBottom: '2rem' }}>
        {/* Header */}
        <div className="header" style={{ marginBottom: '2rem', background: 'none', boxShadow: 'none', border: 'none' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '16px' }}>
              <Building style={{ width: '48px', height: '48px', color: 'var(--color-primary)' }} />
              <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '2.5rem', marginBottom: 0 }}>
                Leasr Analyze
              </h1>
            </div>
            <p style={{ color: 'var(--color-text-light)', fontSize: '1.25rem', maxWidth: '600px', margin: '0 auto' }}>
              AI-powered commercial real estate investment analysis with multi-scenario modeling and market intelligence
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', marginTop: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DollarSign style={{ width: '20px', height: '20px', color: 'var(--color-primary)' }} />
                <span style={{ color: 'var(--color-text-light)', fontSize: '14px' }}>IRR Analysis</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 style={{ width: '20px', height: '20px', color: 'var(--color-primary)' }} />
                <span style={{ color: 'var(--color-text-light)', fontSize: '14px' }}>Market Intelligence</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calculator style={{ width: '20px', height: '20px', color: 'var(--color-primary)' }} />
                <span style={{ color: 'var(--color-text-light)', fontSize: '14px' }}>Multi-Scenario</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ marginBottom: '2rem', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            {[
              { id: 'input', label: 'Deal Input', icon: FileText },
              { id: 'results', label: 'Analysis Results', icon: TrendingUp }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`button${activeTab === tab.id ? '' : ' button-outline'}`}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}
              >
                <tab.icon style={{ width: '18px', height: '18px' }} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '2rem 0' }}>
          {activeTab === 'input' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {/* File Upload Section */}
              <div className="card" style={{ textAlign: 'center', background: 'var(--color-bg-alt)' }}>
                <Upload style={{ width: '48px', height: '48px', color: 'var(--color-primary)', margin: '0 auto 16px' }} />
                <h3 className="section-title" style={{ fontSize: '1.25rem', marginBottom: '8px' }}>
                  Upload CoStar or Title Report
                </h3>
                <p style={{ color: 'var(--color-text-light)', marginBottom: '24px' }}>
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
                  className="button"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  <Upload style={{ width: '20px', height: '20px' }} />
                  Choose PDF File
                </label>
                {uploadStatus && (
                  <div style={{
                    marginTop: '16px',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: uploadStatus.includes('✅') ? '#e7f6e2' : 
                                   uploadStatus.includes('❌') ? '#fdecea' : 
                                   '#f4f4f4',
                    border: `1px solid ${uploadStatus.includes('✅') ? '#b7e4c7' : 
                                       uploadStatus.includes('❌') ? '#f8d7da' : 
                                       'var(--color-border)'}`,
                    color: uploadStatus.includes('✅') ? '#388e3c' : 
                           uploadStatus.includes('❌') ? '#d32f2f' : 'var(--color-text-light)'
                  }}>
                    {uploadStatus}
                  </div>
                )}
                {parsedData && (
                  <div className="card" style={{ marginTop: '24px', textAlign: 'left', background: '#fff' }}>
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
              <div className="card">
                <h3 className="section-title">Benchmark Data</h3>
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
                      <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-light)' }}>
                        {field.label}
                        {autoFilledFields.has(field.key) && (
                          <span style={{ marginLeft: '8px', fontSize: '10px', color: 'var(--color-primary)', fontWeight: '500' }}>
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
                          backgroundColor: 'var(--color-bg-alt)',
                          borderColor: 'var(--color-border)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--color-text)',
                          padding: '12px 16px',
                          fontSize: '14px',
                          width: '100%'
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {/* Summary Card */}
              <div className="card" style={{ background: 'var(--color-bg-alt)', padding: '24px', borderRadius: 'var(--radius-lg)', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '16px', right: '16px', fontSize: '12px', color: 'var(--color-text-light)' }}>
                  {results.analysisDate && (
                    <div>
                      <strong>Analysis Date:</strong> {new Date(results.analysisDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <h3 className="section-title" style={{ marginBottom: '16px' }}>Investment Summary</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: '14px', color: 'var(--color-text-light)', marginBottom: '8px' }}>Total Investment</div>
                    <div style={{ fontSize: '18px', fontWeight: '600' }}>
                      ${results.totalInvestment?.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: '14px', color: 'var(--color-text-light)', marginBottom: '8px' }}>Annual Cash Flow</div>
                    <div style={{ fontSize: '18px', fontWeight: '600' }}>
                      ${results.annualCashFlow?.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: '14px', color: 'var(--color-text-light)', marginBottom: '8px' }}>IRR (Conservative)</div>
                    <div style={{ fontSize: '18px', fontWeight: '600' }}>
                      {results.conservative.irr ? `${(results.conservative.irr * 100).toFixed(2)}%` : '-'}
                    </div>
                  </div>
                  <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: '14px', color: 'var(--color-text-light)', marginBottom: '8px' }}>IRR (Base)</div>
                    <div style={{ fontSize: '18px', fontWeight: '600' }}>
                      {results.base.irr ? `${(results.base.irr * 100).toFixed(2)}%` : '-'}
                    </div>
                  </div>
                  <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: '14px', color: 'var(--color-text-light)', marginBottom: '8px' }}>IRR (Optimistic)</div>
                    <div style={{ fontSize: '18px', fontWeight: '600' }}>
                      {results.optimistic.irr ? `${(results.optimistic.irr * 100).toFixed(2)}%` : '-'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Rent Sensitivity Analysis */}
              <div className="card">
                <h3 className="section-title">Rent Sensitivity Analysis</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px', fontSize: '14px', fontWeight: '500', textTransform: 'uppercase', borderBottom: '2px solid var(--color-border)', paddingBottom: '8px' }}>
                    <div>Change</div>
                    <div style={{ textAlign: 'center' }}>Conservative</div>
                    <div style={{ textAlign: 'center' }}>Base</div>
                    <div style={{ textAlign: 'center' }}>Optimistic</div>
                  </div>
                  {generateRentSensitivity().map(row => (
                    <div key={row.rentChange} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px', fontSize: '14px', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      <div style={{ fontWeight: '500', color: 'var(--color-text)' }}>{row.rentChange}</div>
                      <div style={{ textAlign: 'center', color: 'var(--color-text)' }}>${row.conservative}</div>
                      <div style={{ textAlign: 'center', color: 'var(--color-text)' }}>${row.base}</div>
                      <div style={{ textAlign: 'center', color: 'var(--color-text)' }}>${row.optimistic}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Time Series Analysis */}
              <div className="card">
                <h3 className="section-title">Time Series Analysis</h3>
                <div style={{ height: '400px', width: '100%' }}>
                  <ResponsiveContainer>
                    <LineChart data={generateTimeSeriesData()} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="year" tickLine={false} />
                      <YAxis tickLine={false} />
                      <Tooltip formatter={(value) => [`$${value}`, '']} contentStyle={{ backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }} />
                      <Legend wrapperStyle={{ paddingTop: '16px' }} />
                      <Line type="monotone" dataKey="conservativeEquity" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      <Line type="monotone" dataKey="baseEquity" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      <Line type="monotone" dataKey="optimisticEquity" stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', fontSize: '14px', color: 'var(--color-text-light)' }}>
                  <div>Equity Growth Over Time</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '12px', height: '12px', backgroundColor: '#10b981', borderRadius: '50%' }} />
                      Conservative
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '12px', height: '12px', backgroundColor: '#3b82f6', borderRadius: '50%' }} />
                      Base
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '12px', height: '12px', backgroundColor: '#ef4444', borderRadius: '50%' }} />
                      Optimistic
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeasrAnalyze;
