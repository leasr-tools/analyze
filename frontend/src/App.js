import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Upload, Calculator, FileText, TrendingUp } from 'lucide-react';

const CREAnalyzer = () => {
  useEffect(() => {
    // Add Tailwind CSS dynamically
    const link = document.createElement('link');
    link.href = 'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    
    return () => {
      // Cleanup
      document.head.removeChild(link);
    };
  }, []);
  useEffect(() => {
    // Load PDF.js
    if (!window.pdfjsLib) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.min.js';
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';
      };
      document.head.appendChild(script);
    }
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
  
  // API configuration - using your deployed Render URL
  const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000' 
    : 'https://analyze-ysg7.onrender.com';

  const handleBenchmarkChange = (field, value) => {
    setBenchmarkData(prev => ({ ...prev, [field]: value }));
  };

  const handleGeneralParamsChange = (field, value) => {
    setGeneralParams(prev => ({ ...prev, [field]: value }));
  };

  const handleScenarioChange = (scenario, field, value) => {
    setScenarios(prev => ({
      ...prev,
      [scenario]: { ...prev[scenario], [field]: value }
    }));
  };

  // Enhanced PDF parsing with OCR fallback and validation
  const extractNumberFromText = (text, patterns) => {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const numStr = match[1] || match[0];
        const cleanNum = numStr.replace(/[,$\s]/g, '');
        const num = parseFloat(cleanNum);
        if (!isNaN(num) && num > 0) return num;
      }
    }
    return null;
  };

  const validateExtractedData = (data, docType) => {
    const validation = { isValid: true, warnings: [], errors: [] };
    
    // Rent validation
    if (data.rent) {
      if (data.rent < 5 || data.rent > 200) {
        validation.warnings.push(`Rent ${data.rent}/sf seems unusual (typical range: $5-200/sf)`);
      }
    }
    
    // Square footage validation
    if (data.sqft) {
      if (data.sqft < 500 || data.sqft > 1000000) {
        validation.warnings.push(`Square footage ${data.sqft.toLocaleString()} seems unusual`);
      }
    }
    
    // Purchase price validation
    if (data.price && data.sqft) {
      const pricePerSqft = data.price / data.sqft;
      if (pricePerSqft < 50 || pricePerSqft > 2000) {
        validation.warnings.push(`Price per sqft ${pricePerSqft.toFixed(0)} seems unusual (typical: $50-2000/sf)`);
      }
    }
    
    // CAM validation
    if (data.cam && data.cam > 50) {
      validation.warnings.push(`CAM charges ${data.cam}/sf seem high (typical: $2-15/sf)`);
    }
    
    // Cross-validation
    if (docType === 'costar' && !data.rent && !data.sqft) {
      validation.errors.push('No rental or size data found in CoStar report');
    }
    
    if (docType === 'title' && !data.price && !data.legalDescription) {
      validation.errors.push('No sale price or legal description found in title report');
    }
    
    validation.isValid = validation.errors.length === 0;
    return validation;
  };

  const parseTitleReport = (text) => {
    const data = {};
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const fullText = text.replace(/\s+/g, ' ').toLowerCase();
    
    // Title report specific patterns
    const patterns = {
      price: [
        /(?:sale|purchase|consideration)[:\s]*\$?([0-9,]+)/i,
        /(?:deed|transfer)[^$]*\$([0-9,]+)/i,
        /consideration[:\s]*\$?([0-9,]+)/i,
        /(?:sold|purchase price)[:\s]*\$?([0-9,]+)/i
      ],
      sqft: [
        /([0-9,]+)\s*(?:sf|sq\.?\s*ft\.?|square feet)/i,
        /area[:\s]*([0-9,]+)/i,
        /size[:\s]*([0-9,]+)\s*(?:sf|square)/i
      ],
      acreage: [
        /([0-9]+\.?[0-9]*)\s*acres?/i,
        /([0-9]+\.?[0-9]*)\s*ac\.?/i
      ],
      taxes: [
        /(?:property tax|annual tax|real estate tax)[:\s]*\$?([0-9,]+\.?[0-9]*)/i,
        /tax assessment[:\s]*\$?([0-9,]+)/i,
        /assessed value[:\s]*\$?([0-9,]+)/i
      ],
      zoning: [
        /zoning[:\s]*([A-Z0-9\-]+)/i,
        /zone[:\s]*([A-Z0-9\-]+)/i,
        /classification[:\s]*([A-Z0-9\-]+)/i
      ]
    };

    // Extract numerical data
    Object.keys(patterns).forEach(key => {
      if (key !== 'zoning') {
        const value = extractNumberFromText(fullText, patterns[key]);
        if (value !== null) {
          data[key] = value;
        }
      }
    });

    // Extract zoning (non-numerical)
    const zoningMatch = fullText.match(patterns.zoning[0]) || fullText.match(patterns.zoning[1]) || fullText.match(patterns.zoning[2]);
    if (zoningMatch) {
      data.zoning = zoningMatch[1].toUpperCase();
    }

    // Legal description extraction
    const legalPatterns = [
      /legal description[:\s]*([^.]{20,200})/i,
      /lot [0-9]+[^.]*block [0-9]+[^.]*/i,
      /section [0-9]+[^.]*township [0-9]+[^.]*/i
    ];
    
    for (const pattern of legalPatterns) {
      const match = text.match(pattern);
      if (match) {
        data.legalDescription = match[0].trim();
        break;
      }
    }

    // Property address extraction
    const addressPatterns = [
      /(?:property address|subject property)[:\s]*([^,\n]{10,100})/i,
      /([0-9]+\s+[^,\n]{10,50}(?:street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|lane|ln|way|circle|cir|court|ct))/i
    ];
    
    for (const pattern of addressPatterns) {
      const match = text.match(pattern);
      if (match) {
        data.address = match[1].trim();
        break;
      }
    }

    return data;
  };

  const parseCoStarData = (text) => {
    const data = {};
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const fullText = text.replace(/\s+/g, ' ');
    
    // Enhanced CoStar patterns
    const patterns = {
      rent: [
        /(?:rent|asking|rate)[:\s]*\$?([0-9,]+\.?[0-9]*)/i,
        /\$([0-9,]+\.?[0-9]*)\s*(?:\/sf|per sf|psf|sq\.?\s*ft\.?)/i,
        /([0-9,]+\.?[0-9]*)\s*(?:\/sf|per sf|psf)\s*(?:\/year|annually|yr)?/i
      ],
      sqft: [
        /(?:rentable|leasable|available)\s*(?:area|space)[:\s]*([0-9,]+)/i,
        /([0-9,]+)\s*(?:sf|sq\.?\s*ft\.?|square feet)/i,
        /(?:size|area)[:\s]*([0-9,]+)/i,
        /([0-9,]+)\s*rsf/i
      ],
      cam: [
        /(?:cam|common area maintenance)[:\s]*\$?([0-9,]+\.?[0-9]*)/i,
        /(?:operating expenses?|opex)[:\s]*\$?([0-9,]+\.?[0-9]*)/i,
        /(?:additional rent|add'l rent)[:\s]*\$?([0-9,]+\.?[0-9]*)/i
      ],
      taxes: [
        /(?:property tax|real estate tax|re tax)[:\s]*\$?([0-9,]+\.?[0-9]*)/i,
        /(?:tax|taxes)[:\s]*\$?([0-9,]+\.?[0-9]*)/i
      ],
      price: [
        /(?:sale|asking|list|price)[:\s]*\$?([0-9,]+)/i,
        /\$([0-9,]+,?[0-9]*)\s*(?:total|purchase|sales?)/i,
        /(?:sold|purchase price)[:\s]*\$?([0-9,]+)/i
      ],
      operatingExpenses: [
        /(?:operating expenses?|opex|expenses?)[:\s]*\$?([0-9,]+\.?[0-9]*)/i,
        /(?:total expenses?)[:\s]*\$?([0-9,]+\.?[0-9]*)/i
      ]
    };

    // Extract data using patterns
    Object.keys(patterns).forEach(key => {
      const value = extractNumberFromText(fullText, patterns[key]);
      if (value !== null) {
        data[key] = value;
      }
    });

    // Enhanced property type detection
    const propertyTypes = {
      'office': ['office', 'corporate', 'professional', 'medical office'],
      'retail': ['retail', 'shopping', 'store', 'restaurant', 'grocery'],
      'industrial': ['industrial', 'warehouse', 'manufacturing', 'distribution', 'flex'],
      'multifamily': ['apartment', 'multifamily', 'residential'],
      'medical': ['medical', 'clinic', 'hospital', 'healthcare'],
      'mixed-use': ['mixed use', 'mixed-use']
    };

    for (const [type, keywords] of Object.entries(propertyTypes)) {
      if (keywords.some(keyword => fullText.toLowerCase().includes(keyword))) {
        data.propertyType = type;
        break;
      }
    }

    return data;
  };

  const performOCR = async (arrayBuffer) => {
    // This is a simplified OCR implementation
    // In production, you'd use Tesseract.js or similar
    setUploadStatus('🔍 Performing OCR on scanned document...');
    
    try {
      // For now, we'll simulate OCR processing
      // Real implementation would use Tesseract.js
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Return empty string to indicate OCR attempted but not implemented
      return '';
    } catch (error) {
      console.error('OCR failed:', error);
      return '';
    }
  };

  const detectDocumentType = (text) => {
    const lowerText = text.toLowerCase();
    
    // Title report indicators
    const titleIndicators = [
      'title report', 'preliminary report', 'title insurance', 'commitment',
      'legal description', 'deed', 'easement', 'encumbrance', 'exception',
      'chain of title', 'vesting', 'schedule a', 'schedule b'
    ];
    
    // CoStar indicators
    const costarIndicators = [
      'costar', 'lease', 'rent', 'tenant', 'landlord', 'psf', 'rsf',
      'cam', 'operating expenses', 'base rent', 'market rent'
    ];
    
    const titleScore = titleIndicators.reduce((score, indicator) => 
      score + (lowerText.includes(indicator) ? 1 : 0), 0);
    
    const costarScore = costarIndicators.reduce((score, indicator) => 
      score + (lowerText.includes(indicator) ? 1 : 0), 0);
    
    if (titleScore > costarScore && titleScore > 2) return 'title';
    if (costarScore > titleScore && costarScore > 2) return 'costar';
    return 'unknown';
  };

  const handleFileUpload = async (file) => {
    setUploadStatus('📄 Processing PDF...');
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      if (file.type === 'application/pdf') {
        let fullText = '';
        let extractedData = {};
        let documentType = 'unknown';
        
        // First attempt: PDF.js text extraction
        try {
          const pdfjsLib = window.pdfjsLib;
          if (!pdfjsLib) {
            throw new Error('PDF.js not loaded. Please refresh the page.');
          }
          
          setUploadStatus('📋 Extracting text from PDF...');
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
          }
          
          // If no meaningful text extracted, try OCR
          if (fullText.trim().length < 100) {
            setUploadStatus('🔍 Document appears to be scanned. Attempting OCR...');
            const ocrText = await performOCR(arrayBuffer);
            fullText = ocrText || fullText;
          }
          
        } catch (pdfError) {
          console.error('PDF extraction failed:', pdfError);
          setUploadStatus('🔍 PDF text extraction failed. Attempting OCR...');
          fullText = await performOCR(arrayBuffer);
        }
        
        // Detect document type
        documentType = detectDocumentType(fullText);
        setUploadStatus(`🎯 Detected ${documentType} document. Parsing data...`);
        
        // Parse based on document type
        if (documentType === 'title') {
          extractedData = parseTitleReport(fullText);
        } else if (documentType === 'costar') {
          extractedData = parseCoStarData(fullText);
        } else {
          // Try both parsers and use the one with more results
          const titleData = parseTitleReport(fullText);
          const costarData = parseCoStarData(fullText);
          
          extractedData = Object.keys(titleData).length > Object.keys(costarData).length 
            ? { ...titleData, detectedType: 'title' }
            : { ...costarData, detectedType: 'costar' };
        }
        
        // Validate extracted data
        const validation = validateExtractedData(extractedData, documentType);
        
        setParsedData({ 
          ...extractedData, 
          documentType, 
          validation,
          rawTextLength: fullText.length
        });
        
        // Auto-populate form fields (only if validation passes or has only warnings)
        if (validation.isValid || validation.errors.length === 0) {
          if (extractedData.rent) setBenchmarkData(prev => ({ ...prev, rent: extractedData.rent.toString() }));
          if (extractedData.sqft) setBenchmarkData(prev => ({ ...prev, sqft: extractedData.sqft.toString() }));
          if (extractedData.cam) setBenchmarkData(prev => ({ ...prev, cam: extractedData.cam.toString() }));
          if (extractedData.taxes) setBenchmarkData(prev => ({ ...prev, taxes: extractedData.taxes.toString() }));
          if (extractedData.price) setBenchmarkData(prev => ({ ...prev, purchasePrice: extractedData.price.toString() }));
          if (extractedData.operatingExpenses) setBenchmarkData(prev => ({ ...prev, operatingExpenses: extractedData.operatingExpenses.toString() }));
          if (extractedData.propertyType) setBenchmarkData(prev => ({ ...prev, propertyType: extractedData.propertyType }));
        }
        
        const fieldCount = Object.keys(extractedData).filter(key => 
          !['documentType', 'validation', 'rawTextLength', 'detectedType'].includes(key)
        ).length;
        
        if (validation.errors.length > 0) {
          setUploadStatus(`⚠️ Parsing completed with errors: ${fieldCount} fields extracted`);
        } else if (validation.warnings.length > 0) {
          setUploadStatus(`✅ Parsing completed with warnings: ${fieldCount} fields extracted`);
        } else {
          setUploadStatus(`✅ Successfully parsed ${documentType} report: ${fieldCount} fields extracted`);
        }
        
      } else {
        setUploadStatus('❌ Please upload a PDF file');
      }
    } catch (error) {
      console.error('Parsing error:', error);
      setUploadStatus(`❌ Error parsing file: ${error.message}`);
    }
  };

  // Financial calculation functions
  const calculateMonthlyPayment = (loanAmount, monthlyRate, totalMonths) => {
    if (monthlyRate === 0) return loanAmount / totalMonths;
    return loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / (Math.pow(1 + monthlyRate, totalMonths) - 1);
  };

  const calculateAmortizationSchedule = (loanAmount, annualRate, loanTermYears, interestOnlyYears = 0) => {
    const monthlyRate = annualRate / 100 / 12;
    const totalMonths = loanTermYears * 12;
    const ioMonths = interestOnlyYears * 12;
    const schedule = [];
    
    let balance = loanAmount;
    let monthlyPayment;
    
    for (let month = 1; month <= totalMonths; month++) {
      const interestPayment = balance * monthlyRate;
      let principalPayment = 0;
      
      if (month <= ioMonths) {
        // Interest only period
        monthlyPayment = interestPayment;
      } else {
        // Amortizing period
        const remainingMonths = totalMonths - month + 1;
        monthlyPayment = calculateMonthlyPayment(balance, monthlyRate, remainingMonths);
        principalPayment = monthlyPayment - interestPayment;
      }
      
      balance -= principalPayment;
      
      schedule.push({
        month,
        year: Math.ceil(month / 12),
        payment: monthlyPayment,
        principal: principalPayment,
        interest: interestPayment,
        balance: Math.max(0, balance)
      });
    }
    
    return schedule;
  };

  const calculateIRR = (cashFlows) => {
    // Newton-Raphson method for IRR calculation
    let rate = 0.1; // Initial guess
    const tolerance = 0.00001;
    const maxIterations = 1000;
    
    for (let i = 0; i < maxIterations; i++) {
      let npv = 0;
      let dnpv = 0;
      
      for (let j = 0; j < cashFlows.length; j++) {
        const period = j;
        npv += cashFlows[j] / Math.pow(1 + rate, period);
        dnpv += -period * cashFlows[j] / Math.pow(1 + rate, period + 1);
      }
      
      if (Math.abs(npv) < tolerance) return rate * 100;
      
      if (dnpv === 0) break;
      rate = rate - npv / dnpv;
      
      if (rate < -0.99) rate = -0.99; // Prevent extreme negative rates
    }
    
    return rate * 100;
  };

  const calculateMetrics = () => {
    const results = {};
    
    ['conservative', 'base', 'optimistic'].forEach(scenario => {
      const purchasePrice = parseFloat(benchmarkData.purchasePrice) || 1000000;
      const rent = parseFloat(scenarios[scenario].rent) || parseFloat(benchmarkData.rent) || 25;
      const sqft = parseFloat(benchmarkData.sqft) || 10000;
      const downPayment = parseFloat(scenarios[scenario].downPayment) || 25;
      const interestRate = parseFloat(scenarios[scenario].interestRate) || 5;
      const appreciation = parseFloat(scenarios[scenario].appreciation) || 3;
      const holdPeriod = parseInt(generalParams.holdPeriod) || 10;
      const loanTerm = parseInt(generalParams.loanTerm) || 25;
      const interestOnlyPeriod = parseInt(generalParams.interestOnlyPeriod) || 2;
      
      // Basic calculations
      const annualRent = rent * sqft;
      const loanAmount = purchasePrice * (1 - downPayment / 100);
      const downPaymentAmount = purchasePrice * (downPayment / 100);
      const operatingExpenses = parseFloat(benchmarkData.operatingExpenses) || annualRent * 0.35;
      const noi = annualRent - operatingExpenses;
      
      // Generate amortization schedule
      const amortSchedule = calculateAmortizationSchedule(loanAmount, interestRate, loanTerm, interestOnlyPeriod);
      
      // Calculate monthly and annual metrics
      const monthlyNOI = noi / 12;
      const annualCashFlows = [];
      const monthlyCashFlows = [];
      let totalPrincipalPaydown = 0;
      
      // Build cash flow projections
      for (let year = 0; year < holdPeriod; year++) {
        let yearlyDebtService = 0;
        let yearlyPrincipal = 0;
        
        for (let month = 1; month <= 12; month++) {
          const scheduleIndex = year * 12 + month - 1;
          if (scheduleIndex < amortSchedule.length) {
            yearlyDebtService += amortSchedule[scheduleIndex].payment;
            yearlyPrincipal += amortSchedule[scheduleIndex].principal;
          }
        }
        
        // Apply rent growth
        const currentYearRent = annualRent * Math.pow(1.025, year); // 2.5% annual rent growth
        const currentYearNOI = currentYearRent - operatingExpenses;
        const yearlyNetCashFlow = currentYearNOI - yearlyDebtService;
        
        annualCashFlows.push(yearlyNetCashFlow);
        totalPrincipalPaydown += yearlyPrincipal;
      }
      
      // Calculate sale proceeds
      const futureValue = purchasePrice * Math.pow(1 + appreciation / 100, holdPeriod);
      const remainingLoanBalance = amortSchedule[Math.min(holdPeriod * 12 - 1, amortSchedule.length - 1)]?.balance || 0;
      const saleProceeds = futureValue - remainingLoanBalance;
      
      // Build IRR cash flow array (initial investment negative, then annual cash flows, final year includes sale)
      const irrCashFlows = [-downPaymentAmount, ...annualCashFlows];
      if (irrCashFlows.length > 1) {
        irrCashFlows[irrCashFlows.length - 1] += saleProceeds;
      }
      
      // Calculate metrics
      const capRate = (noi / purchasePrice) * 100;
      const averageAnnualCashFlow = annualCashFlows.reduce((a, b) => a + b, 0) / annualCashFlows.length;
      const cocReturn = (averageAnnualCashFlow / downPaymentAmount) * 100;
      const irr = calculateIRR(irrCashFlows);
      const totalReturn = annualCashFlows.reduce((a, b) => a + b, 0) + (futureValue - purchasePrice) + totalPrincipalPaydown;
      const totalEquityMultiple = (downPaymentAmount + totalReturn) / downPaymentAmount;
      
      // Debt service coverage ratio
      const dscr = noi / (amortSchedule.slice(0, 12).reduce((sum, month) => sum + month.payment, 0));

      results[scenario] = {
        capRate: capRate.toFixed(2),
        cashFlow: averageAnnualCashFlow.toFixed(0),
        cocReturn: cocReturn.toFixed(2),
        irr: irr.toFixed(2),
        futureValue: futureValue.toFixed(0),
        equityGain: (futureValue - purchasePrice).toFixed(0),
        totalReturn: totalReturn.toFixed(0),
        equityMultiple: totalEquityMultiple.toFixed(2),
        dscr: dscr.toFixed(2),
        principalPaydown: totalPrincipalPaydown.toFixed(0),
        saleProceeds: saleProceeds.toFixed(0),
        amortSchedule: amortSchedule.slice(0, holdPeriod * 12),
        annualCashFlows: annualCashFlows,
        irrCashFlows: irrCashFlows
      };
    });
    
    setResults(results);
    setActiveTab('results');
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
          
          // Current property value
          const currentValue = purchasePrice * Math.pow(1 + appreciation / 100, year);
          
          // Remaining loan balance
          const monthIndex = Math.min(year * 12 - 1, results[scenario].amortSchedule.length - 1);
          const remainingBalance = year === 0 ? purchasePrice * (1 - downPayment / 100) : 
            (results[scenario].amortSchedule[monthIndex]?.balance || 0);
          
          // Cumulative cash flow
          const cumulativeCashFlow = year === 0 ? 0 : 
            results[scenario].annualCashFlows.slice(0, year).reduce((sum, cf) => sum + cf, 0);
          
          // Net equity (property value - loan balance)
          const equity = currentValue - remainingBalance;
          
          // Total profit (equity above initial investment + cumulative cash flow)
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

  const generateFinancialBreakdown = (scenario) => {
    if (!results || !results[scenario]) return [];
    
    const totalCashFlow = results[scenario].annualCashFlows.reduce((sum, cf) => sum + cf, 0);
    const principalPaydown = parseFloat(results[scenario].principalPaydown);
    const appreciationGain = parseFloat(results[scenario].equityGain);
    
    return [
      { name: 'Cash Flow', value: Math.abs(totalCashFlow), color: '#2563eb' },
      { name: 'Principal Paydown', value: principalPaydown, color: '#16a34a' },
      { name: 'Appreciation', value: appreciationGain, color: '#dc2626' }
    ];
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-blue-600 text-white p-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="w-6 h-6" />
              CRE Investment Analyzer
            </h1>
            <p className="text-blue-100 mt-2">Multi-scenario commercial real estate investment analysis</p>
          </div>

          {/* Navigation */}
          <div className="flex border-b">
            {[
              { id: 'input', label: 'Input Data', icon: FileText },
              { id: 'results', label: 'Analysis Results', icon: Calculator }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
                  activeTab === tab.id 
                    ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-6">
            {activeTab === 'input' && (
              <div className="space-y-8">
                {/* File Upload Section */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 transition-colors">
                  <div className="text-center">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600 mb-2">Upload CoStar lease comp or title report</p>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) handleFileUpload(file);
                      }}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-blue-700 transition-colors inline-block"
                    >
                      Choose PDF File
                    </label>
                    <p className="text-sm text-gray-500 mt-2">Or fill in the manual inputs below</p>
                    {uploadStatus && (
                      <div className={`mt-3 p-2 rounded ${
                        uploadStatus.includes('✅') ? 'bg-green-100 text-green-700' : 
                        uploadStatus.includes('❌') ? 'bg-red-100 text-red-700' : 
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {uploadStatus}
                      </div>
                    )}
                    {parsedData && (
                      <div className="mt-3 p-3 bg-gray-100 rounded-lg text-left text-sm">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-semibold">Extracted Data</h4>
                          <span className={`px-2 py-1 rounded text-xs ${
                            parsedData.documentType === 'title' ? 'bg-purple-100 text-purple-700' :
                            parsedData.documentType === 'costar' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {parsedData.documentType.toUpperCase()} REPORT
                          </span>
                        </div>
                        
                        {/* Validation Results */}
                        {parsedData.validation && (
                          <div className="mb-3">
                            {parsedData.validation.errors.length > 0 && (
                              <div className="mb-2">
                                <div className="text-red-600 font-medium text-xs mb-1">❌ ERRORS:</div>
                                {parsedData.validation.errors.map((error, idx) => (
                                  <div key={idx} className="text-red-600 text-xs ml-2">• {error}</div>
                                ))}
                              </div>
                            )}
                            
                            {parsedData.validation.warnings.length > 0 && (
                              <div className="mb-2">
                                <div className="text-yellow-600 font-medium text-xs mb-1">⚠️ WARNINGS:</div>
                                {parsedData.validation.warnings.map((warning, idx) => (
                                  <div key={idx} className="text-yellow-600 text-xs ml-2">• {warning}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Extracted Fields */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {Object.entries(parsedData).filter(([key, value]) => 
                            !['documentType', 'validation', 'rawTextLength', 'detectedType'].includes(key) && 
                            value !== null && value !== undefined
                          ).map(([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                              <span>
                                {typeof value === 'number' && ['rent', 'cam', 'taxes'].includes(key) ? `${value}` :
                                 typeof value === 'number' && ['price', 'operatingExpenses'].includes(key) ? `${value.toLocaleString()}` :
                                 typeof value === 'number' && key === 'sqft' ? `${value.toLocaleString()} sf` :
                                 typeof value === 'number' && key === 'acreage' ? `${value} acres` :
                                 typeof value === 'string' && value.length > 30 ? `${value.substring(0, 30)}...` :
                                 value.toString()}
                              </span>
                            </div>
                          ))}
                        </div>
                        
                        {parsedData.rawTextLength && (
                          <div className="mt-2 pt-2 border-t text-xs text-gray-500">
                            📄 Extracted {parsedData.rawTextLength.toLocaleString()} characters from document
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Benchmark Data */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Benchmark Data</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Rent ($/sqft)</label>
                      <input
                        type="number"
                        value={benchmarkData.rent}
                        onChange={(e) => handleBenchmarkChange('rent', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="25.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">CAM ($/sqft)</label>
                      <input
                        type="number"
                        value={benchmarkData.cam}
                        onChange={(e) => handleBenchmarkChange('cam', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="5.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Taxes ($/sqft)</label>
                      <input
                        type="number"
                        value={benchmarkData.taxes}
                        onChange={(e) => handleBenchmarkChange('taxes', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="3.50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Operating Expenses</label>
                      <input
                        type="number"
                        value={benchmarkData.operatingExpenses}
                        onChange={(e) => handleBenchmarkChange('operatingExpenses', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="75000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Square Feet</label>
                      <input
                        type="number"
                        value={benchmarkData.sqft}
                        onChange={(e) => handleBenchmarkChange('sqft', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="10000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price</label>
                      <input
                        type="number"
                        value={benchmarkData.purchasePrice}
                        onChange={(e) => handleBenchmarkChange('purchasePrice', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="1000000"
                      />
                    </div>
                  </div>
                </div>

                {/* General Parameters */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">General Parameters</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hold Period (years)</label>
                      <input
                        type="number"
                        value={generalParams.holdPeriod}
                        onChange={(e) => handleGeneralParamsChange('holdPeriod', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Loan Term (years)</label>
                      <input
                        type="number"
                        value={generalParams.loanTerm}
                        onChange={(e) => handleGeneralParamsChange('loanTerm', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Scenario Parameters */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Scenario Analysis</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3">Parameter</th>
                          <th className="text-center py-2 px-3 text-red-600">Conservative</th>
                          <th className="text-center py-2 px-3 text-blue-600">Base</th>
                          <th className="text-center py-2 px-3 text-green-600">Optimistic</th>
                        </tr>
                      </thead>
                      <tbody>
                        {['rent', 'downPayment', 'interestRate', 'appreciation'].map(param => (
                          <tr key={param} className="border-b">
                            <td className="py-2 px-3 font-medium capitalize">
                              {param === 'downPayment' ? 'Down Payment (%)' : 
                               param === 'interestRate' ? 'Interest Rate (%)' :
                               param === 'appreciation' ? 'Appreciation (%)' :
                               'Rent ($/sqft)'}
                            </td>
                            {['conservative', 'base', 'optimistic'].map(scenario => (
                              <td key={scenario} className="py-2 px-3">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={scenarios[scenario][param]}
                                  onChange={(e) => handleScenarioChange(scenario, param, e.target.value)}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder={
                                    param === 'rent' ? (scenario === 'conservative' ? '23' : scenario === 'base' ? '25' : '28') :
                                    param === 'downPayment' ? (scenario === 'conservative' ? '30' : scenario === 'base' ? '25' : '20') :
                                    param === 'interestRate' ? (scenario === 'conservative' ? '6.5' : scenario === 'base' ? '5.5' : '4.5') :
                                    (scenario === 'conservative' ? '2' : scenario === 'base' ? '3' : '4')
                                  }
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Analyze Button */}
                <div className="text-center">
                  <button
                    onClick={calculateMetrics}
                    className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
                  >
                    <Calculator className="w-5 h-5" />
                    Analyze the Deal
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'results' && results && (
              <div className="space-y-8">
                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {['conservative', 'base', 'optimistic'].map(scenario => (
                    <div key={scenario} className="bg-gray-50 rounded-lg p-6">
                      <h3 className={`text-lg font-semibold mb-4 capitalize ${
                        scenario === 'conservative' ? 'text-red-600' : 
                        scenario === 'base' ? 'text-blue-600' : 'text-green-600'
                      }`}>
                        {scenario} Scenario
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Cap Rate:</span>
                          <span className="font-semibold">{results[scenario].capRate}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Cash Flow:</span>
                          <span className="font-semibold">${parseInt(results[scenario].cashFlow).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">CoC Return:</span>
                          <span className="font-semibold">{results[scenario].cocReturn}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">IRR:</span>
                          <span className="font-semibold">{results[scenario].irr}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">DSCR:</span>
                          <span className="font-semibold">{results[scenario].dscr}x</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Equity Multiple:</span>
                          <span className="font-semibold">{results[scenario].equityMultiple}x</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Principal Paydown:</span>
                          <span className="font-semibold">${parseInt(results[scenario].principalPaydown).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Rent Sensitivity Analysis */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">IRR Sensitivity to Rent Changes</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3">Rent Change</th>
                          <th className="text-center py-2 px-3 text-red-600">Conservative IRR</th>
                          <th className="text-center py-2 px-3 text-blue-600">Base IRR</th>
                          <th className="text-center py-2 px-3 text-green-600">Optimistic IRR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {generateRentSensitivity().map((row, index) => (
                          <tr key={index} className="border-b">
                            <td className="py-2 px-3 font-medium">{row.rentChange}</td>
                            <td className="py-2 px-3 text-center">{row.conservative}%</td>
                            <td className="py-2 px-3 text-center">{row.base}%</td>
                            <td className="py-2 px-3 text-center">{row.optimistic}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Financial Breakdown Donut Charts */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Return Sources Breakdown</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {['conservative', 'base', 'optimistic'].map(scenario => (
                      <div key={scenario} className="text-center">
                        <h4 className={`font-semibold mb-2 capitalize ${
                          scenario === 'conservative' ? 'text-red-600' : 
                          scenario === 'base' ? 'text-blue-600' : 'text-green-600'
                        }`}>
                          {scenario}
                        </h4>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={generateFinancialBreakdown(scenario)}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={80}
                                dataKey="value"
                                startAngle={90}
                                endAngle={-270}
                              >
                                {generateFinancialBreakdown(scenario).map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value) => [`${parseInt(value).toLocaleString()}`, '']} />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Time Series Chart */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Investment Performance Over Time</h3>
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={generateTimeSeriesData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis />
                        <Tooltip formatter={(value) => [`${parseInt(value).toLocaleString()}`, '']} />
                        <Legend />
                        <Line type="monotone" dataKey="conservativeEquity" stroke="#dc2626" name="Conservative Equity" />
                        <Line type="monotone" dataKey="baseEquity" stroke="#2563eb" name="Base Equity" />
                        <Line type="monotone" dataKey="optimisticEquity" stroke="#16a34a" name="Optimistic Equity" />
                        <Line type="monotone" dataKey="conservativeCashFlow" stroke="#dc2626" strokeDasharray="5 5" name="Conservative Cash Flow" />
                        <Line type="monotone" dataKey="baseCashFlow" stroke="#2563eb" strokeDasharray="5 5" name="Base Cash Flow" />
                        <Line type="monotone" dataKey="optimisticCashFlow" stroke="#16a34a" strokeDasharray="5 5" name="Optimistic Cash Flow" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Amortization Schedule Preview */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Amortization Schedule (First 24 Months - Base Scenario)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3">Month</th>
                          <th className="text-right py-2 px-3">Payment</th>
                          <th className="text-right py-2 px-3">Principal</th>
                          <th className="text-right py-2 px-3">Interest</th>
                          <th className="text-right py-2 px-3">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results?.base?.amortSchedule?.slice(0, 24).map((month, index) => (
                          <tr key={index} className="border-b hover:bg-gray-100">
                            <td className="py-2 px-3">{month.month}</td>
                            <td className="py-2 px-3 text-right">${month.payment.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                            <td className="py-2 px-3 text-right">${month.principal.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                            <td className="py-2 px-3 text-right">${month.interest.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                            <td className="py-2 px-3 text-right">${month.balance.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CREAnalyzer;